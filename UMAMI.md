# Umami Analytics - Setup & Reference Guide

Self-hosted privacy-friendly analytics for amanbagrecha.com.

## Table of Contents

- [Overview](#overview)
- [Access & Credentials](#access--credentials)
- [Architecture](#architecture)
- [Service Management](#service-management)
- [Configuration](#configuration)
- [Backup & Maintenance](#backup--maintenance)
- [Monitoring & Logs](#monitoring--logs)
- [Troubleshooting](#troubleshooting)
- [Updating Umami](#updating-umami)

---

## Overview

**What:** Umami v2.13.2 - Open-source, privacy-focused web analytics
**Installed:** December 2024
**Purpose:** Track website metrics without third-party data sharing

### Metrics Tracked

- Page views & unique visitors
- Photo-search tool usage
- Traffic sources (direct, search, referral, social)
- Device breakdown (desktop, mobile, tablet)
- Browser & OS distribution
- Geographic location (country-level)
- Session metrics (duration, bounce rate, new vs returning)

### Privacy Features

- No cookies required
- GDPR compliant
- Self-hosted (all data stays on our server)
- No third-party data sharing
- Anonymous by default

---

## Access & Credentials

### Dashboard Access

**URL:** `https://amanbagrecha.com/umami`

**Login:**
- Username: `admin`
- Password: *[You set this during initial setup]*

**Important:** Change the default password immediately after first login via Settings → Profile → Change Password.

### Website Tracking

**Production:** `https://amanbagrecha.com` - **Tracking ENABLED**
**Staging:** `https://staging.amanbagrecha.com` - **Tracking DISABLED**

**Website ID:** `5298ff92-3c09-41df-9551-85c6f5f961b4`

---

## Architecture

```
User Browser (amanbagrecha.com)
    ↓
Tracking Script (/umami/script.js)
    ↓
Nginx (port 443)
    ↓ proxy /umami → localhost:8002
Umami (Next.js app on port 8002)
    ↓
PostgreSQL Database (port 5432)
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Umami App | `/opt/umami` | Next.js application |
| Database | PostgreSQL `umami` db | Analytics data storage |
| Service | systemd `umami.service` | Keeps Umami running |
| Proxy | Nginx `/umami` location | Public access via SSL |

### Network

- **Umami:** `localhost:8002` (internal only)
- **PostgreSQL:** `localhost:5432` (internal only)
- **Public Access:** `https://amanbagrecha.com/umami` (via Nginx)
- **Tracking Script:** `https://amanbagrecha.com/umami/script.js`

---

## Service Management

### Umami Service

**Check status:**
```bash
sudo systemctl status umami
```

**Start/Stop/Restart:**
```bash
sudo systemctl start umami
sudo systemctl stop umami
sudo systemctl restart umami
```

**Enable/Disable auto-start:**
```bash
sudo systemctl enable umami   # Start on boot
sudo systemctl disable umami  # Don't start on boot
```

**View logs:**
```bash
# Follow logs in real-time
sudo journalctl -u umami -f

# View last 100 lines
sudo journalctl -u umami -n 100

# View logs since today
sudo journalctl -u umami --since today

# View logs with errors only
sudo journalctl -u umami -p err
```

### PostgreSQL Database

**Check database status:**
```bash
systemctl status postgresql
```

**Connect to database:**
```bash
sudo -u postgres psql umami
```

**Check database size:**
```bash
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('umami'));"
```

**Manual vacuum (optimization):**
```bash
sudo -u postgres psql umami -c "VACUUM ANALYZE;"
```

---

## Configuration

### Environment Variables

**File:** `/opt/umami/.env`

```bash
DATABASE_URL=postgresql://umami_user:PASSWORD@localhost:5432/umami
APP_SECRET=RANDOM_SECRET_KEY
BASE_PATH=/umami
DISABLE_TELEMETRY=1
TIMEZONE=Asia/Kolkata
```

**Important:** Never commit `.env` file to git. Contains sensitive credentials.

**After changing `.env`:**
```bash
sudo systemctl restart umami
```

### Nginx Configuration

**File:** `/etc/nginx/sites-available/amanbagrecha.conf`

**Relevant sections:**
```nginx
# Tracking script (exact match has priority)
location = /umami/script.js {
    proxy_pass http://127.0.0.1:8002/umami/script.js;
    # ... proxy headers ...
}

# Dashboard and API
location /umami {
    proxy_pass http://127.0.0.1:8002/umami;
    # ... proxy headers with WebSocket support ...
}
```

**After changing Nginx config:**
```bash
sudo nginx -t              # Test configuration
sudo systemctl reload nginx # Apply changes
```

### Quarto Integration

**Tracking script:** `/root/work/amanbagrecha.github.io/_umami-tracking.html`
```html
<script defer src="https://amanbagrecha.com/umami/script.js"
        data-website-id="5298ff92-3c09-41df-9551-85c6f5f961b4"></script>
```

**Production profile:** `/root/work/amanbagrecha.github.io/_quarto-production.yml`
```yaml
format:
  html:
    include-in-header: _umami-tracking.html
```

**Staging profile:** `/root/work/amanbagrecha.github.io/_quarto-staging.yml`
- Does NOT include `include-in-header` (no tracking on staging)

**After changing tracking:**
```bash
cd /root/work/amanbagrecha.github.io
./build-production.sh  # Rebuild production site
```

---

## Backup & Maintenance

### Automated Backups

**Schedule:** Daily at 2:00 AM
**Retention:** 30 days
**Location:** `/var/backups/umami/`

**Backup script:** `/root/scripts/backup-umami.sh`
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/umami"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"
sudo -u postgres pg_dump umami | gzip > "$BACKUP_DIR/umami-$TIMESTAMP.sql.gz"
find "$BACKUP_DIR" -name "umami-*.sql.gz" -mtime +30 -delete
```

**Cron schedule:** (view with `crontab -l`)
```bash
# Daily backup at 2 AM
0 2 * * * /root/scripts/backup-umami.sh

# Weekly database optimization on Sunday at 3 AM
0 3 * * 0 sudo -u postgres psql umami -c "VACUUM ANALYZE;"
```

### Manual Backup

**Create backup now:**
```bash
/root/scripts/backup-umami.sh
```

**List backups:**
```bash
ls -lh /var/backups/umami/
```

### Restore from Backup

**Restore specific backup:**
```bash
# Stop Umami service
sudo systemctl stop umami

# Restore database
gunzip -c /var/backups/umami/umami-YYYYMMDD-HHMMSS.sql.gz | sudo -u postgres psql umami

# Start Umami service
sudo systemctl start umami
```

### Database Maintenance

**Automatic:** Weekly vacuum on Sunday at 3 AM (via cron)

**Manual optimization:**
```bash
sudo -u postgres psql umami -c "VACUUM ANALYZE;"
```

**Check table sizes:**
```bash
sudo -u postgres psql umami -c "
  SELECT schemaname, tablename,
         pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

---

## Monitoring & Logs

### Service Health

**Quick health check:**
```bash
# Check if Umami is running
sudo systemctl is-active umami

# Check if port 8002 is listening
ss -tlnp | grep 8002

# Test local access
curl -I http://localhost:8002/umami
```

**Full status check:**
```bash
# Umami service status
sudo systemctl status umami

# Recent logs
sudo journalctl -u umami -n 50

# Database connection
sudo -u postgres psql umami -c "SELECT version();"

# Nginx proxy
curl -I https://amanbagrecha.com/umami/
curl -I https://amanbagrecha.com/umami/script.js
```

### Log Files

**Umami application logs:**
```bash
sudo journalctl -u umami -f          # Follow in real-time
sudo journalctl -u umami --since "1 hour ago"
sudo journalctl -u umami --since today
```

**Nginx access logs:**
```bash
sudo tail -f /var/log/nginx/access.log | grep umami
```

**Nginx error logs:**
```bash
sudo tail -f /var/log/nginx/error.log | grep umami
```

**PostgreSQL logs:**
```bash
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

### Monitoring Database Growth

**Database size over time:**
```bash
sudo -u postgres psql -c "
  SELECT datname, pg_size_pretty(pg_database_size(datname))
  FROM pg_database
  WHERE datname = 'umami';
"
```

**Monitor disk usage:**
```bash
df -h /var/lib/postgresql  # Database storage
df -h /var/backups         # Backup storage
```

---

## Troubleshooting

### Umami Service Won't Start

**Check logs for errors:**
```bash
sudo journalctl -u umami -n 100 --no-pager
```

**Common issues:**

1. **Database connection failed**
   ```bash
   # Verify PostgreSQL is running
   systemctl status postgresql

   # Test database connection
   PGPASSWORD='PASSWORD' psql -U umami_user -d umami -h localhost -c "SELECT 1;"

   # Check credentials in .env file
   cat /opt/umami/.env | grep DATABASE_URL
   ```

2. **Port 8002 already in use**
   ```bash
   # Check what's using the port
   sudo ss -tlnp | grep 8002

   # Kill the process if needed
   sudo kill <PID>
   ```

3. **Missing dependencies**
   ```bash
   cd /opt/umami
   npm install --legacy-peer-deps
   ```

### Tracking Script Not Loading

**Verify script is accessible:**
```bash
curl https://amanbagrecha.com/umami/script.js
```

**If 404 error:**
```bash
# Check Nginx config
sudo nginx -t
sudo cat /etc/nginx/sites-available/amanbagrecha.conf | grep -A 10 "umami"

# Check Nginx error log
sudo tail -20 /var/log/nginx/error.log | grep umami

# Reload Nginx
sudo systemctl reload nginx
```

**Check production HTML includes script:**
```bash
grep "umami/script.js" /root/work/amanbagrecha.github.io/docs/index.html
```

**If missing, rebuild site:**
```bash
cd /root/work/amanbagrecha.github.io
./build-production.sh
```

### No Data in Dashboard

**Possible causes:**

1. **Wrong Website ID**
   ```bash
   # Check Website ID in tracking script
   grep "data-website-id" /root/work/amanbagrecha.github.io/_umami-tracking.html

   # Compare with dashboard (login to https://amanbagrecha.com/umami)
   # Settings → Websites → Check Website ID
   ```

2. **Browser blocking (ad blockers)**
   - Test in incognito mode without extensions
   - Check browser console for errors (F12 → Console)

3. **Tracking script not loaded**
   - Open browser DevTools → Network tab
   - Visit your site
   - Look for request to `umami/script.js` (should be 200 OK)
   - Look for POST to `umami/api/send` (should be 200 OK)

4. **Clock skew**
   ```bash
   # Check server time
   date
   timedatectl status
   ```

### Staging Site Tracking (Unintended)

**Verify staging doesn't include tracking:**
```bash
grep "umami" /root/work/amanbagrecha.github.io/docs-staging/index.html
# Should return nothing

# Check staging config
cat /root/work/amanbagrecha.github.io/_quarto-staging.yml | grep "include-in-header"
# Should NOT have include-in-header for tracking
```

**If staging has tracking, rebuild:**
```bash
cd /root/work/amanbagrecha.github.io
./build-staging.sh
```

### High Database Size

**Check database size:**
```bash
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('umami'));"
```

**Cleanup old data (if needed):**
```sql
-- Connect to database
sudo -u postgres psql umami

-- Delete data older than 90 days
DELETE FROM event WHERE created_at < NOW() - INTERVAL '90 days';

-- Vacuum to reclaim space
VACUUM FULL;
```

### Performance Issues

**Check resource usage:**
```bash
# CPU and memory
top -bn1 | grep -E "(umami|postgres)"

# Database connections
sudo -u postgres psql umami -c "SELECT count(*) FROM pg_stat_activity;"
```

**Optimize queries:**
```bash
# Run vacuum
sudo -u postgres psql umami -c "VACUUM ANALYZE;"

# Restart Umami
sudo systemctl restart umami
```

---

## Updating Umami

**Before updating:**
1. Create backup: `/root/scripts/backup-umami.sh`
2. Note current version: `cd /opt/umami && cat package.json | grep version`

**Update process:**

```bash
# Stop service
sudo systemctl stop umami

# Backup current installation
cd /opt
sudo cp -r umami umami-backup-$(date +%Y%m%d)

# Download new version
cd /opt/umami
wget https://github.com/umami-software/umami/archive/refs/tags/vX.X.X.tar.gz
tar -xzf vX.X.X.tar.gz

# Copy environment file
cp /opt/umami-backup-*/. env /opt/umami/.env

# Install dependencies and build
npm install --legacy-peer-deps
npm run build

# Apply database migrations (if any)
npm run build-db

# Start service
sudo systemctl start umami

# Check status
sudo systemctl status umami
sudo journalctl -u umami -f

# Test access
curl -I https://amanbagrecha.com/umami/

# If successful, clean up
# sudo rm -rf /opt/umami-backup-*
```

**Check for updates:**
- GitHub releases: https://github.com/umami-software/umami/releases
- Security advisories: https://github.com/umami-software/umami/security

---

## Important File Locations

### Configuration Files

| File | Purpose |
|------|---------|
| `/opt/umami/.env` | Environment variables (DATABASE_URL, APP_SECRET) |
| `/etc/systemd/system/umami.service` | Systemd service definition |
| `/etc/nginx/sites-available/amanbagrecha.conf` | Nginx proxy configuration |
| `/root/work/amanbagrecha.github.io/_umami-tracking.html` | Tracking script HTML |
| `/root/work/amanbagrecha.github.io/_quarto-production.yml` | Production Quarto config |
| `/root/work/amanbagrecha.github.io/_quarto-staging.yml` | Staging Quarto config |

### Application Files

| Directory/File | Purpose |
|----------------|---------|
| `/opt/umami/` | Umami application root |
| `/opt/umami/public/script.js` | Tracking script (2.6KB) |
| `/opt/umami/.next/` | Built Next.js application |
| `/opt/umami/prisma/` | Database schema and migrations |
| `/opt/umami/node_modules/` | NPM dependencies |

### Data & Backups

| Directory | Purpose |
|-----------|---------|
| `/var/lib/postgresql/16/main/` | PostgreSQL data directory |
| `/var/backups/umami/` | Database backup files |
| `/root/scripts/backup-umami.sh` | Backup script |

### Logs

| Location | Purpose |
|----------|---------|
| `journalctl -u umami` | Umami application logs |
| `/var/log/nginx/access.log` | Nginx access logs |
| `/var/log/nginx/error.log` | Nginx error logs |
| `/var/log/postgresql/` | PostgreSQL logs |

---

## Database Credentials

**IMPORTANT:** Keep these credentials secure and never commit to git.

**PostgreSQL:**
- Database: `umami`
- User: `umami_user`
- Password: *Stored in `/opt/umami/.env`*
- Host: `localhost`
- Port: `5432`

**Umami Admin:**
- Username: `admin`
- Password: *Set during initial setup*
- Change via: Settings → Profile → Change Password

---

## Quick Reference Commands

### Daily Operations

```bash
# Check if everything is running
sudo systemctl status umami
curl -I https://amanbagrecha.com/umami/

# View recent activity
sudo journalctl -u umami -n 20

# Create manual backup
/root/scripts/backup-umami.sh

# Restart after changes
sudo systemctl restart umami
```

### Maintenance

```bash
# Weekly optimization (runs automatically)
sudo -u postgres psql umami -c "VACUUM ANALYZE;"

# Check database size
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('umami'));"

# List backups
ls -lh /var/backups/umami/

# View cron schedule
crontab -l
```

### Troubleshooting

```bash
# Full diagnostic
sudo systemctl status umami
sudo journalctl -u umami -n 50
curl -I http://localhost:8002/umami
curl -I https://amanbagrecha.com/umami/script.js
grep "umami" /root/work/amanbagrecha.github.io/docs/index.html

# Restart all components
sudo systemctl restart umami
sudo systemctl reload nginx
```

---

## Support & Resources

- **Umami Documentation:** https://umami.is/docs
- **GitHub Repository:** https://github.com/umami-software/umami
- **Community Forum:** https://github.com/umami-software/umami/discussions
- **Security Issues:** https://github.com/umami-software/umami/security

---

**Last Updated:** December 2024
**Version:** Umami v2.13.2
**Maintainer:** Aman Bagrecha
