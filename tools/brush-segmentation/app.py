import numpy as np
import cv2
from pathlib import Path
from flask import Flask, request, jsonify, send_file
import base64
from io import BytesIO
import json
import rasterio
from rasterio.plot import reshape_as_image
import logging
from logging.handlers import RotatingFileHandler
import os

app = Flask(__name__)

# Production configuration
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max upload
app.config['UPLOAD_FOLDER'] = '/tmp/brush_segmentation_uploads'
app.config['MASK_FOLDER'] = '/tmp/brush_segmentation_masks'

# Setup logging
if not app.debug:
    log_dir = Path('/var/log/image-mask-labeler')
    log_dir.mkdir(exist_ok=True, parents=True)

    file_handler = RotatingFileHandler(
        log_dir / 'app.log',
        maxBytes=10485760,  # 10MB
        backupCount=10
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('Image Mask Labeler startup')

class ImageSegmenter:
    def __init__(self):
        self.image = None
        self.mask = None
        self.original_image = None

    def load_image(self, image_path):
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        if path.suffix.lower() in ['.tif', '.tiff']:
            with rasterio.open(image_path) as src:
                data = src.read()
                if data.shape[0] <= 3:
                    data = reshape_as_image(data)
                else:
                    data = reshape_as_image(data[:3])

                # Normalize to 0-255 if not already uint8
                if data.dtype != np.uint8:
                    data = ((data - data.min()) / (data.max() - data.min()) * 255).astype(np.uint8)

                self.image = data
        else:
            # Read image
            self.image = cv2.imread(str(image_path), cv2.IMREAD_UNCHANGED)
            if self.image is None:
                raise ValueError(f"Failed to load image: {image_path}")

            # Handle different image formats
            if self.image.ndim == 3 and self.image.shape[2] == 3:
                # BGR to RGB
                self.image = cv2.cvtColor(self.image, cv2.COLOR_BGR2RGB)
            elif self.image.ndim == 2:
                # Grayscale - convert to RGB for display
                self.image = cv2.cvtColor(self.image, cv2.COLOR_GRAY2RGB)
            elif self.image.ndim == 3 and self.image.shape[2] == 4:
                # RGBA to RGB
                self.image = cv2.cvtColor(self.image, cv2.COLOR_BGRA2RGB)

        # Keep a copy for redrawing
        self.original_image = self.image.copy()
        self.mask = np.zeros(self.image.shape[:2], dtype=np.uint8)

        # Encode image to base64
        success, buffer = cv2.imencode('.png', cv2.cvtColor(self.image, cv2.COLOR_RGB2BGR))
        if not success:
            raise ValueError("Failed to encode image")

        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return img_base64, self.image.shape[1], self.image.shape[0]

    def update_mask(self, strokes):
        self.mask = np.zeros(self.image.shape[:2], dtype=np.uint8)
        for stroke in strokes:
            points = stroke['points']
            mode = stroke['mode']
            brush_size = stroke['brushSize']

            for point in points:
                cv2.circle(self.mask,
                          (int(point['x']), int(point['y'])),
                          brush_size, mode * 255, -1)

    def save_mask(self, output_path):
        cv2.imwrite(str(output_path), self.mask)
        return True

segmenter = ImageSegmenter()

@app.route('/')
def index():
    return '''
<!DOCTYPE html>
<html>
<head>
    <title>Image Mask Labeler</title>
    <style>
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #1e1e1e; color: #fff; }
        #container { max-width: 100%; margin: 0 auto; }
        #controls {
            margin-bottom: 15px;
            display: flex;
            gap: 15px;
            align-items: center;
            flex-wrap: wrap;
            background: #2d2d2d;
            padding: 15px;
            border-radius: 8px;
        }
        button {
            padding: 10px 20px;
            cursor: pointer;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            transition: background 0.3s;
        }
        button:hover { background: #005a9e; }
        button:disabled { background: #555; cursor: not-allowed; }
        #canvasContainer {
            position: relative;
            display: inline-block;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        #canvas {
            border: 2px solid #333;
            cursor: crosshair;
            background: #000;
            display: block;
            max-width: 100%;
            height: auto;
        }
        input[type="range"] { width: 200px; }
        input[type="file"] {
            color: #fff;
            padding: 8px;
            background: #2d2d2d;
            border: 1px solid #555;
            border-radius: 4px;
        }
        label { margin-right: 10px; }
        #brushSize { color: #007acc; font-weight: bold; }
        #status { color: #00ff00; font-weight: bold; }
        .error { color: #ff4444; }
        .info { color: #ffaa00; }
    </style>
</head>
<body>
    <div id="container">
        <h1>Image Mask Labeler</h1>
        <div id="controls">
            <input type="file" id="fileInput" accept=".tif,.tiff,.png,.jpg,.jpeg">
            <button onclick="clearMask()" id="clearBtn" disabled>Clear</button>
            <button onclick="saveMask()" id="saveBtn" disabled>Save Mask</button>
            <label>Brush Size: <span id="brushSize">15</span></label>
            <input type="range" id="brushSlider" min="1" max="100" value="15" oninput="updateBrushSize(this.value)">
            <span id="mode">Mode: Draw</span>
            <span id="status"></span>
        </div>
        <div id="canvasContainer">
            <canvas id="canvas"></canvas>
        </div>
        <div style="margin-top: 20px; color: #aaa;">
            <p><strong>Instructions:</strong></p>
            <ul>
                <li>Left click and drag to draw (mark as foreground)</li>
                <li>Right click and drag to erase</li>
                <li>Use the slider to adjust brush size</li>
                <li>Click "Save Mask" to download the mask as PNG</li>
            </ul>
        </div>
    </div>

    <script>
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        let drawing = false;
        let brushSize = 15;
        let mode = 1;
        let currentStroke = [];
        let strokes = [];
        let img = new Image();
        let imageLoaded = false;

        function getCanvasCoordinates(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        }

        function setStatus(message, type = 'info') {
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            statusEl.className = type;
        }

        function enableButtons() {
            document.getElementById('clearBtn').disabled = false;
            document.getElementById('saveBtn').disabled = false;
        }

        document.getElementById('fileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            setStatus('Loading...', 'info');

            fetch('/upload_image', {method: 'POST', body: formData})
                .then(r => {
                    if (!r.ok) throw new Error('Upload failed');
                    return r.json();
                })
                .then(data => {
                    img.onload = () => {
                        canvas.width = data.width;
                        canvas.height = data.height;
                        ctx.drawImage(img, 0, 0);
                        strokes = [];
                        imageLoaded = true;
                        enableButtons();
                        setStatus('Ready - Start drawing!', 'info');
                    };
                    img.onerror = () => {
                        setStatus('Failed to load image', 'error');
                    };
                    img.src = 'data:image/png;base64,' + data.image;
                })
                .catch(err => {
                    setStatus('Error: ' + err.message, 'error');
                    console.error(err);
                });
        });

        canvas.addEventListener('mousedown', (e) => {
            if (!imageLoaded) return;
            drawing = true;
            if (e.button === 2) mode = 0;
            else mode = 1;
            document.getElementById('mode').textContent = mode ? 'Mode: Draw' : 'Mode: Erase';
            const coords = getCanvasCoordinates(e);
            currentStroke = [coords];

            ctx.globalAlpha = 0.5;
            ctx.fillStyle = mode ? '#00ff00' : '#000000';
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!drawing) return;
            const coords = getCanvasCoordinates(e);
            currentStroke.push(coords);

            ctx.globalAlpha = 0.5;
            ctx.fillStyle = mode ? '#00ff00' : '#000000';
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, brushSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });

        canvas.addEventListener('mouseup', () => {
            if (drawing && currentStroke.length > 0) {
                strokes.push({points: currentStroke, mode: mode, brushSize: brushSize});
            }
            drawing = false;
        });

        canvas.addEventListener('mouseleave', () => {
            if (drawing && currentStroke.length > 0) {
                strokes.push({points: currentStroke, mode: mode, brushSize: brushSize});
            }
            drawing = false;
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        function updateBrushSize(value) {
            brushSize = parseInt(value);
            document.getElementById('brushSize').textContent = brushSize;
        }

        function clearMask() {
            if (!imageLoaded) return;
            strokes = [];
            ctx.drawImage(img, 0, 0);
            setStatus('Mask cleared', 'info');
        }

        function saveMask() {
            if (!imageLoaded) return;
            if (strokes.length === 0) {
                setStatus('No strokes to save!', 'error');
                return;
            }

            setStatus('Saving...', 'info');
            fetch('/save_mask', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({strokes: strokes})
            })
            .then(r => {
                if (!r.ok) throw new Error('Save failed');
                return r.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'mask.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                setStatus('Mask saved!', 'info');
            })
            .catch(err => {
                setStatus('Error saving: ' + err.message, 'error');
                console.error(err);
            });
        }
    </script>
</body>
</html>
'''

@app.route('/upload_image', methods=['POST'])
def upload_image():
    try:
        if 'file' not in request.files:
            app.logger.warning('Upload attempt with no file')
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            app.logger.warning('Upload attempt with empty filename')
            return jsonify({'error': 'No file selected'}), 400

        # Validate file extension
        allowed_extensions = {'.tif', '.tiff', '.png', '.jpg', '.jpeg'}
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in allowed_extensions:
            app.logger.warning(f'Invalid file type: {file_ext}')
            return jsonify({'error': f'Invalid file type. Allowed: {", ".join(allowed_extensions)}'}), 400

        temp_path = Path(app.config['UPLOAD_FOLDER'])
        temp_path.mkdir(exist_ok=True)
        file_path = temp_path / file.filename
        file.save(file_path)

        app.logger.info(f'Image uploaded: {file.filename}')
        img_base64, width, height = segmenter.load_image(file_path)

        # Clean up temp file
        file_path.unlink()

        return jsonify({'image': img_base64, 'width': width, 'height': height})
    except Exception as e:
        app.logger.error(f'Upload error: {str(e)}', exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/save_mask', methods=['POST'])
def save_mask():
    try:
        data = request.json
        if not data or 'strokes' not in data:
            app.logger.warning('Save mask attempt with no stroke data')
            return jsonify({'error': 'No stroke data provided'}), 400

        segmenter.update_mask(data['strokes'])

        output_path = Path(app.config['MASK_FOLDER']) / 'mask.png'
        output_path.parent.mkdir(exist_ok=True)
        segmenter.save_mask(output_path)

        app.logger.info('Mask saved successfully')
        return send_file(str(output_path), mimetype='image/png', as_attachment=True, download_name='mask.png')
    except Exception as e:
        app.logger.error(f'Save mask error: {str(e)}', exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'image-mask-labeler'}), 200

if __name__ == '__main__':
    # Create temp directories in /tmp (outside repo)
    Path('/tmp/brush_segmentation_uploads').mkdir(exist_ok=True)
    Path('/tmp/brush_segmentation_masks').mkdir(exist_ok=True)

    # Only run dev server if explicitly in development
    is_dev = os.environ.get('FLASK_ENV') == 'development'
    if is_dev:
        app.run(debug=True, port=5000, host='0.0.0.0')
    else:
        # Production mode - will be run by Gunicorn
        app.logger.info('Running in production mode with Gunicorn')
