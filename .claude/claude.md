# Claude Context: Aman Bagrecha's Website

## Project Overview

This is a self-hosted personal website combining:
- **Quarto** (static site generator) for blog/portfolio content
- **FastAPI** (Python) for dynamic photo search functionality
- **Nginx** as reverse proxy serving static files and proxying API requests

## Architecture

```
Browser → Nginx (port 80/443)
          ├─→ Static Quarto site (docs/)
          └─→ /api/* → FastAPI (localhost:8000)
                       └─→ Photo search app
```

## Key Locations

### Quarto Website
- **Root**: `/root/work/amanbagrecha.github.io/`
- **Config**: `_quarto.yml`
- **Source**: `.qmd` files (index.qmd, posts/, projects/, tools/, etc.)
- **Output**: `docs/` (served by Nginx)
- **Build**: `quarto render` (run from project root)

### Photo Search App (FastAPI)
- **Root**: `/root/work/photos-index-search/`
- **Main app**: `image_search_app/app.py`
- **Entry point**: `main.py`
- **Functions**: `search_faces.py` (face recognition logic)
- **Database**: `face_db.parquet` (face embeddings)
- **Virtual env**: `.venv/` (use this Python interpreter)

### System Configuration
- **Nginx config**: `/etc/nginx/sites-available/amanbagrecha.conf`
- **FastAPI service**: `/etc/systemd/system/photo-search-api.service`
- **SSL certs**: `/etc/letsencrypt/live/amanbagrecha.com/`

## Important Notes

### Permissions
The `/root/work/` directory requires special permissions for Nginx (www-data user) to access:
```bash
chmod +x /root /root/work /root/work/amanbagrecha.github.io
chmod -R +r /root/work/amanbagrecha.github.io/docs
```
**Do this after every `quarto render` if you see permission errors.**

### Services
Two services must be running:

1. **photo-search-api.service** (FastAPI)
   - Port: 8000 (localhost only)
   - User: root
   - Working dir: `/root/work/photos-index-search`
   - Command: `.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2`
   - Logs: `journalctl -u photo-search-api -f`

2. **nginx.service**
   - Ports: 80, 443
   - Serves: `/root/work/amanbagrecha.github.io/docs/`
   - Proxies: `/api/*` to `http://localhost:8000`
   - Logs: `/var/log/nginx/error.log`, `/var/log/nginx/access.log`

### CORS Configuration
FastAPI app has CORS middleware configured for:
- `https://amanbagrecha.com`
- `https://www.amanbagrecha.com`
- `http://localhost` (for testing)
- `http://localhost:8080` (for testing)

Location: `/root/work/photos-index-search/image_search_app/app.py` lines 18-30

### Photo Search Integration

The photo search is integrated into Quarto via:

1. **Source files** (copied from photos-index-search):
   - `/root/work/amanbagrecha.github.io/tools/photo-search/app.js`
   - `/root/work/amanbagrecha.github.io/tools/photo-search/style.css`

2. **Quarto page**:
   - `/root/work/amanbagrecha.github.io/tools/photo-search.qmd`
   - Includes CSS/JS from `photo-search/` subfolder
   - Contains HTML structure for upload/search interface

3. **Navigation**:
   - Defined in `_quarto.yml` under navbar → left → Tools menu

4. **API URLs**:
   - JavaScript uses **relative URLs**: `/api/search`, `/api/image/serve`
   - Nginx proxies these to FastAPI on localhost:8000

### Workflow

**To update website content:**
```bash
cd /root/work/amanbagrecha.github.io
# Edit .qmd files
quarto render
# Changes live immediately (Nginx serves from docs/)
```

**To update photo search:**
```bash
cd /root/work/photos-index-search
# Edit image_search_app/app.py or other files
sudo systemctl restart photo-search-api
# If you change HTML/CSS/JS, also update Quarto:
cp image_search_app/app.js /root/work/amanbagrecha.github.io/tools/photo-search/
cp image_search_app/style.css /root/work/amanbagrecha.github.io/tools/photo-search/
cd /root/work/amanbagrecha.github.io
quarto render
```

## Common Tasks

### Adding a New Blog Post
```bash
cd /root/work/amanbagrecha.github.io/posts
mkdir yyyy-mm-dd-post-title
cd yyyy-mm-dd-post-title
# Create index.md or index.qmd
quarto render  # from project root
```

### Adding a New Tool
1. Create tool directory: `mkdir -p tools/new-tool`
2. Copy assets if needed: `tools/new-tool/app.js`, `style.css`
3. Create Quarto page: `tools/new-tool.qmd`
4. Update navigation in `_quarto.yml`:
   ```yaml
   - text: "Tools"
     menu:
       - text: "Photo Search"
         href: tools/photo-search.qmd
       - text: "New Tool"
         href: tools/new-tool.qmd
   ```
5. Render: `quarto render`

### Debugging

**Site not loading:**
```bash
# Check Nginx
sudo systemctl status nginx
sudo tail -50 /var/log/nginx/error.log

# Check permissions
ls -la /root/work/amanbagrecha.github.io/docs/
sudo chmod +x /root /root/work /root/work/amanbagrecha.github.io
sudo chmod -R +r /root/work/amanbagrecha.github.io/docs
```

**API not working:**
```bash
# Check service
sudo systemctl status photo-search-api
sudo journalctl -u photo-search-api -n 50

# Test API directly
curl http://localhost:8000/api/health

# Test via Nginx
curl http://localhost/api/health
```

**Photo search page issues:**
```bash
# Check files exist
ls -la /root/work/amanbagrecha.github.io/docs/tools/photo-search/

# Check browser console for JavaScript errors
# Check Network tab for failed requests
```

## Technology Stack

- **Quarto**: 1.8.26 (static site generator)
- **Python**: 3.12+ (FastAPI backend)
- **FastAPI**: Latest (web framework)
- **InsightFace**: Face recognition library
- **FAISS**: Vector similarity search
- **Nginx**: 1.24.0 (web server/reverse proxy)
- **Uvicorn**: ASGI server for FastAPI
- **Bootstrap**: CSS framework (via Quarto)

## Environment

- **OS**: Ubuntu/Debian Linux
- **Server**: VPS/bare metal
- **Domain**: amanbagrecha.com
- **SSL**: Let's Encrypt (via certbot)
- **Python env**: uv + virtualenv (`.venv`)

## Git Workflow

The project uses Git but **docs/ is committed** (for GitHub Pages backup):
- Do NOT add docs/ to .gitignore
- The docs/ directory contains the rendered site
- Source .qmd files are the source of truth

## Future Enhancements

Potential improvements to discuss with user:
- Add more interactive tools (follow photo-search pattern)
- Implement user authentication for private tools
- Add admin interface for photo search (upload photos, rebuild index)
- Set up automatic Quarto rendering on file changes
- Add monitoring/alerting for services
- Implement CDN for static assets
- Add database for storing user data
- Implement search functionality for blog posts

## Security Considerations

- **No authentication** on photo search API (consider adding if sensitive)
- **Rate limiting** not implemented (consider adding)
- **File upload validation** in place (FastAPI validates image types)
- **CORS** properly configured
- **SSL** enabled (certbot auto-renewal)
- **Firewall** should limit access to ports 22, 80, 443

## Performance Notes

- **FastAPI workers**: 2 (adjust based on CPU cores)
- **Nginx caching**: 30 days for static assets
- **Face recognition**: CPU-bound, consider GPU for better performance
- **FAISS index**: Loaded in memory, fast lookups
- **Thumbnails**: Generated on-demand, cached with @lru_cache

## Troubleshooting Quick Reference

| Issue | Check | Fix |
|-------|-------|-----|
| 404 on homepage | Nginx permissions | `chmod +x /root /root/work ...` |
| API timeout | FastAPI service | `systemctl restart photo-search-api` |
| CSS not loading | File paths in .qmd | Check `include-in-header` paths |
| CORS error | API origins list | Update `app.py` CORS middleware |
| SSL renewal failed | Certbot logs | `certbot renew --dry-run` |
| Out of memory | FastAPI workers | Reduce worker count |

## Contact/Context for User

- User is Aman Bagrecha
- Geospatial scientist
- Runs "Let's Talk Spatial" community
- Active in open source (QGIS, Xarray, etc.)
- Technical background, comfortable with CLI

---

**Last Updated**: December 2025
**Claude Session**: Initial setup and integration of photo search with Quarto site
