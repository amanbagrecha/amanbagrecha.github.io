// DOM Elements
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const browseButton = document.getElementById('browseButton');
const cameraButton = document.getElementById('cameraButton');
const previewSection = document.getElementById('previewSection');
const previewImage = document.getElementById('previewImage');
const clearButton = document.getElementById('clearButton');
const searchButton = document.getElementById('searchButton');
const resultsSection = document.getElementById('resultsSection');
const resultsGrid = document.getElementById('resultsGrid');
const resultsCount = document.getElementById('resultsCount');
const cameraModal = document.getElementById('cameraModal');
const cameraVideo = document.getElementById('cameraVideo');
const cameraCanvas = document.getElementById('cameraCanvas');
const captureButton = document.getElementById('captureButton');
const cancelCameraButton = document.getElementById('cancelCameraButton');
const closeCameraButton = document.getElementById('closeCameraButton');

// State
let uploadedImageData = null;
let allResults = [];
let cameraStream = null;

// Initialize
function init() {
    setupEventListeners();
}

// Event Listeners
function setupEventListeners() {
    // Browse button click
    if (browseButton) {
        browseButton.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }

    // Camera button click
    if (cameraButton) {
        cameraButton.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            openCamera();
        });
    } else {
        console.warn('Camera button not found in DOM');
    }

    // Upload zone click
    uploadZone.addEventListener('click', (e) => {
        // Don't trigger if clicking on buttons
        if (!e.target.closest('button')) {
            fileInput.click();
        }
    });

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop events
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);

    // Clear button
    clearButton.addEventListener('click', clearUpload);

    // Search button
    searchButton.addEventListener('click', performSearch);

    // Camera controls
    if (captureButton) {
        captureButton.addEventListener('click', capturePhoto);
    }
    if (cancelCameraButton) {
        cancelCameraButton.addEventListener('click', closeCamera);
    }
    if (closeCameraButton) {
        closeCameraButton.addEventListener('click', closeCamera);
    }
}

// Drag and Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            handleImageFile(file);
        } else {
            alert('Please upload an image file');
        }
    }
}

// File Selection Handler
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        handleImageFile(file);
    } else {
        alert('Please upload an image file');
    }
}

// Image File Handler
function handleImageFile(file) {
    const reader = new FileReader();

    reader.onload = function(e) {
        uploadedImageData = e.target.result;
        previewImage.src = uploadedImageData;

        // Hide upload zone and show preview
        uploadZone.style.display = 'none';
        previewSection.style.display = 'block';

        // Hide results if they were shown before
        resultsSection.style.display = 'none';
    };

    reader.readAsDataURL(file);
}

// Clear Upload
function clearUpload() {
    uploadedImageData = null;
    previewImage.src = '';
    fileInput.value = '';

    // Show upload zone and hide preview
    uploadZone.style.display = 'block';
    previewSection.style.display = 'none';
    resultsSection.style.display = 'none';
}

// Perform Search
async function performSearch() {
    if (!uploadedImageData) {
        alert('Please upload an image first');
        return;
    }

    // Add loading state
    searchButton.textContent = 'Searching...';
    searchButton.disabled = true;
    searchButton.classList.add('loading');

    try {
        // Call the backend API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image_data: uploadedImageData,
                top_k: 5000  // Increased limit to show all matches
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorMessage = 'Search failed';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorMessage;
            } catch (e) {
                errorMessage = `Server error (${response.status})`;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();

        if (!data || !data.results) {
            throw new Error('Invalid response from server');
        }

        displayResults(data);

        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (error) {
        console.error('Search error:', error);

        let errorMsg = 'Search failed';
        if (error.name === 'AbortError') {
            errorMsg = 'Search timed out. Please try again or use a smaller image.';
        } else if (error.message.includes('No face detected')) {
            errorMsg = error.message;
        } else if (error.message.includes('Failed to fetch')) {
            errorMsg = 'Cannot connect to server. Please check if the backend is running.';
        } else {
            errorMsg = error.message;
        }

        alert(errorMsg);
    } finally {
        // Reset button state
        searchButton.textContent = 'Search Similar Images';
        searchButton.disabled = false;
        searchButton.classList.remove('loading');
    }
}

// Display Results
let currentDisplayCount = 20;
let previousDisplayCount = 0;

function displayResults(data) {
    resultsGrid.innerHTML = '';

    if (!data || !data.results || data.results.length === 0) {
        resultsCount.textContent = 'No similar faces found';
        resultsSection.style.display = 'block';
        resultsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #b0aea5;">No matches found. Try a different image with a clear face.</p>';
        return;
    }

    allResults = data.results.sort((a, b) => {
        const maxSimA = Math.max(...a.faces.map(f => f.similarity));
        const maxSimB = Math.max(...b.faces.map(f => f.similarity));
        return maxSimB - maxSimA;
    });

    previousDisplayCount = 0;
    currentDisplayCount = 20;
    renderResults(true);

    resultsSection.style.display = 'block';
}

function renderResults(isInitial = true) {
    const totalCount = allResults.length;
    const displayCount = Math.min(currentDisplayCount, totalCount);

    resultsCount.textContent = `${totalCount} match${totalCount !== 1 ? 'es' : ''} found`;

    if (isInitial) {
        // Initial render: clear and render all
        resultsGrid.innerHTML = '';

        allResults.slice(0, displayCount).forEach((result) => {
            const card = createResultCard(result);
            resultsGrid.appendChild(card);
        });
    } else {
        // Incremental render: remove "Show More" button and add only new cards
        const showMoreContainer = resultsGrid.querySelector('.show-more-container');
        if (showMoreContainer) {
            showMoreContainer.remove();
        }

        // Add only the new results from previousDisplayCount to displayCount
        const newResults = allResults.slice(previousDisplayCount, displayCount);

        newResults.forEach((result) => {
            const card = createResultCard(result);
            resultsGrid.appendChild(card);
        });
    }

    if (displayCount < totalCount) {
        const showMoreBtn = document.createElement('div');
        showMoreBtn.className = 'show-more-container';
        showMoreBtn.innerHTML = `
            <button class="btn-secondary" onclick="showMoreResults()">
                Show More (${totalCount - displayCount} remaining)
            </button>
        `;
        resultsGrid.appendChild(showMoreBtn);
    }
}

// Create Result Card
function createResultCard(result) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.dataset.loading = 'true';

    const maxSimilarity = result.faces.reduce((max, face) =>
        Math.max(max, face.similarity), 0);
    const similarityPercent = (maxSimilarity * 100).toFixed(1);

    const confidenceClass = maxSimilarity > 0.85 ? 'high' : maxSimilarity > 0.75 ? 'medium' : 'low';

    card.innerHTML = `
        <div class="loading-placeholder" style="width: 100%; height: 250px; background: #f0f0f0; display: flex; align-items: center; justify-content: center;">
            <span style="color: #999;">Loading...</span>
        </div>
        <div class="result-card-footer">
            <span class="confidence ${confidenceClass}">${similarityPercent}% match</span>
        </div>
    `;

    loadImageForCard(card, result.image_path);

    card.addEventListener('click', () => {
        // Open the raw image using the /api/image/raw endpoint
        const rawImageUrl = `/api/image/raw?path=${encodeURIComponent(result.image_path)}`;
        window.open(rawImageUrl, '_blank');
    });

    return card;
}

// Load image from backend
async function loadImageForCard(card, imagePath) {
    try {
        const response = await fetch(`/api/image/serve?path=${encodeURIComponent(imagePath)}&thumbnail=true&max_width=600`);

        if (!response.ok) {
            throw new Error('Failed to load image');
        }

        const data = await response.json();

        // Replace placeholder with actual image
        const placeholder = card.querySelector('.loading-placeholder');
        if (placeholder) {
            const img = document.createElement('img');
            img.src = data.data_uri;
            img.alt = 'Similar face';
            img.style.width = '100%';
            img.style.height = '250px';
            img.style.objectFit = 'cover';
            placeholder.replaceWith(img);
        }

        card.dataset.loading = 'false';
    } catch (error) {
        console.error('Error loading image:', error);
        const placeholder = card.querySelector('.loading-placeholder');
        if (placeholder) {
            placeholder.innerHTML = `
                <div style="text-align: center; padding: 1rem;">
                    <p style="color: #999;">Failed to load</p>
                    <p style="font-size: 0.75rem; color: #ccc; margin-top: 0.5rem;">${imagePath}</p>
                </div>
            `;
        }
    }
}

// Show More Results
function showMoreResults() {
    previousDisplayCount = currentDisplayCount;
    currentDisplayCount += 20;
    renderResults(false);
}

// Download All functionality
async function downloadAll() {
    const downloadBtn = document.getElementById('downloadButton');
    const originalText = downloadBtn.textContent;

    try {
        downloadBtn.textContent = 'Preparing download...';
        downloadBtn.disabled = true;

        const imagePaths = allResults.map(result => result.image_path);

        console.log('Downloading paths:', imagePaths);

        const response = await fetch('/api/download/matched', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image_paths: imagePaths
            })
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            throw new Error(`Download failed: ${response.statusText}`);
        }

        const blob = await response.blob();
        console.log('Blob size:', blob.size, 'bytes');

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wedding_matches_${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);

        console.log('Download triggered');

    } catch (error) {
        console.error('Download error:', error);
        alert('Download failed: ' + error.message);
    } finally {
        downloadBtn.textContent = originalText;
        downloadBtn.disabled = false;
    }
}

// Camera Functions
async function openCamera() {
    try {
        // Request camera with user-facing camera (front camera for selfies)
        const constraints = {
            video: {
                facingMode: 'user', // Use front camera for selfies
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraVideo.srcObject = cameraStream;
        cameraModal.style.display = 'flex';
    } catch (error) {
        console.error('Error accessing camera:', error);
        let errorMsg = 'Unable to access camera. ';

        if (error.name === 'NotAllowedError') {
            errorMsg += 'Please allow camera access in your browser settings.';
        } else if (error.name === 'NotFoundError') {
            errorMsg += 'No camera found on your device.';
        } else if (error.name === 'NotReadableError') {
            errorMsg += 'Camera is already in use by another application.';
        } else {
            errorMsg += 'Please check your camera permissions.';
        }

        alert(errorMsg);
    }
}

function closeCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    cameraVideo.srcObject = null;
    cameraModal.style.display = 'none';
}

function capturePhoto() {
    const canvas = cameraCanvas;
    const video = cameraVideo;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame to canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to data URL
    uploadedImageData = canvas.toDataURL('image/jpeg', 0.9);

    // Display preview
    previewImage.src = uploadedImageData;
    uploadZone.style.display = 'none';
    previewSection.style.display = 'block';
    resultsSection.style.display = 'none';

    // Close camera
    closeCamera();
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for future backend integration
window.ImageSearch = {
    uploadedImageData,
    performSearch,
    displayResults
};
