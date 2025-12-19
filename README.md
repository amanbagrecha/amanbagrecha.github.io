# Aman Bagrecha's Personal Website

Self-hosted Quarto website with FastAPI photo search integration.

## Architecture

```
User Browser
    ↓
Nginx (port 80/443)
    ├─→ Production (amanbagrecha.com)
    │   ├─→ Static files: /root/work/amanbagrecha.github.io/docs/
    │   ├─→ API proxy: /api/* → http://localhost:8000
    │   └─→ Tool proxy: /tools/mask-labeler/* → http://localhost:8001
    │
    └─→ Staging (staging.amanbagrecha.com)
        ├─→ Static files: /root/work/amanbagrecha.github.io/docs-staging/
        ├─→ API proxy: /api/* → http://localhost:8000 (shared)
        └─→ Tool proxy: /tools/mask-labeler/* → http://localhost:8001 (shared)
                                   ↓                                  ↓
                             FastAPI (port 8000)              Flask (port 8001)
                             /root/work/photos-index-search   Image Mask Labeler
```

## Setup Instructions

### Prerequisites

- Ubuntu/Debian server
- Python 3.12+ with uv or virtualenv
- Nginx
- Quarto 1.8.26+

### Initial Setup

#### 1. Install Dependencies

```bash
# Install Nginx
sudo apt update
sudo apt install nginx

# Install Quarto
cd /tmp
wget https://github.com/quarto-dev/quarto-cli/releases/download/v1.8.26/quarto-1.8.26-linux-amd64.deb
sudo dpkg -i quarto-1.8.26-linux-amd64.deb

# Install Certbot for SSL (optional but recommended)
sudo apt install certbot python3-certbot-nginx
```

#### 2. Configure FastAPI Service

**Create systemd service file:**

```bash
sudo nano /etc/systemd/system/photo-search-api.service
```

**Content:**
```ini
[Unit]
Description=Photo Search FastAPI Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/work/photos-index-search
ExecStart=/root/work/photos-index-search/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable photo-search-api
sudo systemctl start photo-search-api
sudo systemctl status photo-search-api
```

**Test API:**
```bash
curl http://localhost:8000/api/health
# Should return: {"status":"healthy","message":"Image search API is running"}
```

#### 3. Configure Nginx

**Create site configuration:**

```bash
sudo nano /etc/nginx/sites-available/amanbagrecha.conf
```

**Content:**
```nginx
server {
    listen 80;
    server_name amanbagrecha.com www.amanbagrecha.com;

    # Serve Quarto static site
    root /root/work/amanbagrecha.github.io/docs;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Proxy API requests to FastAPI
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static file caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Enable site and set permissions:**
```bash
# Enable site
sudo ln -sf /etc/nginx/sites-available/amanbagrecha.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Fix permissions for Nginx to read /root/work
sudo chmod +x /root
sudo chmod +x /root/work
sudo chmod +x /root/work/amanbagrecha.github.io
sudo chmod -R +r /root/work/amanbagrecha.github.io/docs

# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx
```

**Test Nginx:**
```bash
curl http://localhost/
curl http://localhost/api/health
```

#### 4. Configure Staging Environment

**Create staging Nginx configuration:**

```bash
sudo nano /etc/nginx/sites-available/staging.amanbagrecha.conf
```

See `/etc/nginx/sites-available/staging.amanbagrecha.conf` for full config.

**Enable staging site:**
```bash
sudo ln -s /etc/nginx/sites-available/staging.amanbagrecha.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**Install SSL for staging:**
```bash
sudo certbot certonly --nginx -d staging.amanbagrecha.com
```

#### 5. Configure SSL (Production)

```bash
# Install SSL certificate
sudo certbot --nginx -d amanbagrecha.com -d www.amanbagrecha.com

# Certbot will automatically:
# - Update Nginx config with SSL settings
# - Redirect HTTP to HTTPS
# - Set up auto-renewal
```

**Verify auto-renewal:**
```bash
sudo certbot renew --dry-run
```

#### 6. DNS Configuration

Point your domains to the server:

```
# Production
Type: A
Name: @
Value: <your-server-ip>

Type: A
Name: www
Value: <your-server-ip>

# Staging
Type: A
Name: staging
Value: <your-server-ip>
```

## Content Workflow

### Staging & Preview System

This site uses a **three-tier preview workflow** for safe content deployment:

1. **Local Preview** - Test changes on your machine
2. **Staging** - Preview on staging.amanbagrecha.com before going live
3. **Production** - Live site at amanbagrecha.com

### Creating New Content

#### New Blog Post with Draft

```bash
cd /root/work/amanbagrecha.github.io/posts
mkdir my-new-post

cat > my-new-post/index.qmd << 'EOF'
---
title: My New Post Title
date: 2025-12-19
draft: true
categories: [category1, category2]
description: "Brief description"
---

## Your content here
EOF
```

#### New Project

Edit `projects/gallery.yaml`:
```yaml
- path: https://github.com/user/project
  image: /projects/project-slug/featured.png
  title: "Project Title"
  description: "Description"
  date: 2025-12-19
  categories: [Python]
```

### Testing & Deployment

#### 1. Local Preview (Fastest)

```bash
cd /root/work/amanbagrecha.github.io
quarto preview

# Opens at http://localhost:4848
# Live reload on file changes
# Drafts rendered but not linked
# Press Ctrl+C to stop
```

#### 2. Build to Staging

```bash
# Build staging version
quarto render --profile staging
# Or use helper script:
./build-staging.sh

# Visit: https://staging.amanbagrecha.com
# - Orange banner shows "STAGING ENVIRONMENT"
# - Drafts ARE visible in listings
# - Test all functionality before production
```

#### 3. Deploy to Production

```bash
# First, publish draft content
vim posts/my-new-post/index.qmd
# Change: draft: true → draft: false

# Build production
quarto render --profile production
# Or use helper script:
./build-production.sh

# Visit: https://amanbagrecha.com
# - Changes live immediately
# - Only published content visible
# - Production auto-backed up before build
```

### Quick Commands

| Task | Command |
|------|---------|
| Local preview | `quarto preview` |
| Build staging | `quarto render --profile staging` |
| Build production | `quarto render --profile production` |
| Production (default) | `quarto render` |

### Quarto Profiles

The site uses Quarto profiles for environment-specific configurations:

**Files:**
- `_quarto.yml` - Main configuration (default/production)
- `_quarto-staging.yml` - Staging overrides
- `_quarto-production.yml` - Production overrides (explicit)

**Key Differences:**

| Setting | Staging | Production |
|---------|---------|------------|
| Output directory | `docs-staging/` | `docs/` |
| Draft mode | `visible` | `unlinked` |
| Site URL | staging.amanbagrecha.com | amanbagrecha.com |
| CSS | Includes `staging.css` (banner) | Standard only |

### Updating Photo Search

```bash
# Navigate to photo search app
cd /root/work/photos-index-search

# Make changes to image_search_app/app.py or other files

# Restart the service
sudo systemctl restart photo-search-api
```

## Service Management

### FastAPI Service

```bash
# Check status
sudo systemctl status photo-search-api

# Start/Stop/Restart
sudo systemctl start photo-search-api
sudo systemctl stop photo-search-api
sudo systemctl restart photo-search-api

# View logs
sudo journalctl -u photo-search-api -f
sudo journalctl -u photo-search-api --since today
```

### Nginx

```bash
# Check status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# Reload config (without downtime)
sudo systemctl reload nginx

# Restart
sudo systemctl restart nginx

# View logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Site Not Loading

1. **Check Nginx is running:**
   ```bash
   sudo systemctl status nginx
   ```

2. **Check permissions:**
   ```bash
   sudo chmod +x /root /root/work /root/work/amanbagrecha.github.io
   sudo chmod -R +r /root/work/amanbagrecha.github.io/docs
   ```

3. **Check Nginx logs:**
   ```bash
   sudo tail -50 /var/log/nginx/error.log
   ```

### API Not Working

1. **Check FastAPI service:**
   ```bash
   sudo systemctl status photo-search-api
   ```

2. **Check API directly:**
   ```bash
   curl http://localhost:8000/api/health
   ```

3. **Check API logs:**
   ```bash
   sudo journalctl -u photo-search-api -n 50
   ```

4. **Check CORS settings:**
   - Edit `/root/work/photos-index-search/image_search_app/app.py`
   - Ensure your domain is in `allow_origins` list

### Photo Search Page Issues

1. **Check if files exist:**
   ```bash
   ls -la /root/work/amanbagrecha.github.io/docs/tools/photo-search/
   ```

2. **Re-render Quarto:**
   ```bash
   cd /root/work/amanbagrecha.github.io
   quarto render
   ```

3. **Check browser console** for JavaScript errors

### Permission Denied Errors

```bash
# Fix Nginx permissions
sudo chmod +x /root /root/work /root/work/amanbagrecha.github.io
sudo chmod -R +r /root/work/amanbagrecha.github.io/docs

# Restart Nginx
sudo systemctl restart nginx
```

## Directory Structure

```
/root/work/
├── amanbagrecha.github.io/          # Quarto website
│   ├── _quarto.yml                  # Main site configuration
│   ├── _quarto-staging.yml          # Staging profile configuration
│   ├── _quarto-production.yml       # Production profile configuration
│   ├── staging.css                  # Staging banner styles
│   ├── build-staging.sh             # Staging build helper script
│   ├── build-production.sh          # Production build helper script
│   ├── index.qmd                    # Home page
│   ├── posts/                       # Blog posts
│   ├── projects/                    # Projects
│   ├── tools/                       # Tools
│   │   ├── photo-search.qmd         # Photo search page
│   │   └── photo-search/            # Static assets
│   │       ├── app.js               # Frontend JavaScript
│   │       └── style.css            # Styles
│   ├── docs/                        # Production build (served by Nginx)
│   └── docs-staging/                # Staging build (served by Nginx, gitignored)
│
└── photos-index-search/             # FastAPI photo search app
    ├── image_search_app/
    │   ├── app.py                   # FastAPI application
    │   ├── funcs.py                 # Face recognition functions
    │   ├── index.html               # Original standalone HTML
    │   ├── app.js                   # Original JS (copied to Quarto)
    │   └── style.css                # Original CSS (copied to Quarto)
    ├── main.py                      # Entry point
    ├── face_db.parquet              # Face embeddings database
    └── .venv/                       # Python virtual environment
```

## Key Files

### Configuration Files

- **Nginx config (production)**: `/etc/nginx/sites-available/amanbagrecha.conf`
- **Nginx config (staging)**: `/etc/nginx/sites-available/staging.amanbagrecha.conf`
- **FastAPI service**: `/etc/systemd/system/photo-search-api.service`
- **Quarto main config**: `/root/work/amanbagrecha.github.io/_quarto.yml`
- **Quarto staging profile**: `/root/work/amanbagrecha.github.io/_quarto-staging.yml`
- **Quarto production profile**: `/root/work/amanbagrecha.github.io/_quarto-production.yml`
- **SSL certificates (production)**: `/etc/letsencrypt/live/amanbagrecha.com/`
- **SSL certificates (staging)**: `/etc/letsencrypt/live/staging.amanbagrecha.com/`

### Application Files

- **FastAPI app**: `/root/work/photos-index-search/image_search_app/app.py`
- **Photo search page**: `/root/work/amanbagrecha.github.io/tools/photo-search.qmd`
- **Face DB**: `/root/work/photos-index-search/face_db.parquet`
- **Staging banner CSS**: `/root/work/amanbagrecha.github.io/staging.css`
- **Build scripts**: `/root/work/amanbagrecha.github.io/build-{staging,production}.sh`

## Backup

### Important directories to backup:

```bash
# Quarto source files
/root/work/amanbagrecha.github.io/
  (exclude docs/ and docs-staging/ - they're generated)

# Photo search app
/root/work/photos-index-search/
  (exclude .venv/ - it's rebuilable)

# Nginx configs
/etc/nginx/sites-available/amanbagrecha.conf
/etc/nginx/sites-available/staging.amanbagrecha.conf

# Service config
/etc/systemd/system/photo-search-api.service

# SSL certificates (handled by certbot)
/etc/letsencrypt/
```

### Backup script:

```bash
#!/bin/bash
BACKUP_DIR="/backup/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Backup Quarto source (exclude generated docs)
rsync -av --exclude='docs/' --exclude='docs-staging/' /root/work/amanbagrecha.github.io/ $BACKUP_DIR/quarto/

# Backup photo search app (exclude venv)
rsync -av --exclude='.venv/' /root/work/photos-index-search/ $BACKUP_DIR/photo-search/

# Backup configs
cp /etc/nginx/sites-available/amanbagrecha.conf $BACKUP_DIR/
cp /etc/nginx/sites-available/staging.amanbagrecha.conf $BACKUP_DIR/
cp /etc/systemd/system/photo-search-api.service $BACKUP_DIR/
```

## Updating Dependencies

### Update Quarto

```bash
cd /tmp
wget https://github.com/quarto-dev/quarto-cli/releases/download/vX.X.X/quarto-X.X.X-linux-amd64.deb
sudo dpkg -i quarto-X.X.X-linux-amd64.deb
```

### Update Python Dependencies (Photo Search)

```bash
cd /root/work/photos-index-search
source .venv/bin/activate
pip install --upgrade pip
pip install --upgrade -r requirements.txt  # if you have one
# or with uv:
uv pip sync pyproject.toml

sudo systemctl restart photo-search-api
```

## Performance Optimization

### Nginx Caching

Already configured in the Nginx config:
- Static files cached for 30 days
- Proper cache headers set

### FastAPI Workers

Adjust worker count based on server resources:
```bash
sudo nano /etc/systemd/system/photo-search-api.service
# Change --workers 2 to desired number
sudo systemctl daemon-reload
sudo systemctl restart photo-search-api
```

### Quarto Build Performance

For faster builds, render only changed files:
```bash
quarto render --to html  # Only render to HTML
quarto render posts/new-post.qmd  # Render specific file
quarto render --profile staging posts/  # Render only posts to staging
```

### Helper Scripts

Use the provided build scripts for common tasks:
```bash
# Build staging (creates docs-staging/)
./build-staging.sh

# Build production (creates docs/, auto-backs up previous version)
./build-production.sh
```

These scripts provide:
- Automatic error handling
- Production backup before build
- Clear success messages with URLs
- Backup cleanup (keeps last 3 backups)

## Security Checklist

- [ ] SSL certificate installed and auto-renewal configured
- [ ] Firewall configured (allow ports 80, 443, 22)
- [ ] Regular system updates: `sudo apt update && sudo apt upgrade`
- [ ] CORS properly configured in FastAPI
- [ ] File permissions set correctly (read-only for Nginx)
- [ ] Regular backups configured
- [ ] Monitor logs for suspicious activity

## Resources

- [Quarto Documentation](https://quarto.org)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org)

## Support

For issues:
1. Check logs (Nginx, FastAPI service)
2. Review troubleshooting section above
3. Check GitHub issues if using third-party components

---

**Last Updated**: December 2025
