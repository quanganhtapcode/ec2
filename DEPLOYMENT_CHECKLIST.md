# Deployment Checklist - Vietnam Stock Valuation
**Last Updated:** November 26, 2025

## 📁 File Classification

### 🌐 FILES FOR VPS (Backend Server: 203.55.176.10)
Upload path: `~/apps/ec2/`

**Backend Core:**
- ✅ `backend_server.py` (151 KB) - Flask API server với CORS, compression
- ✅ `valuation_models.py` (28 KB) - Valuation calculation logic
- ✅ `requirements.txt` (0.07 KB) - Python dependencies
- ✅ `Procfile` - Gunicorn configuration

**Configuration:**
- ✅ `nginx-cache.conf` (1.81 KB) - Nginx caching rules
- ⚠️  `.htaccess` (1.67 KB) - NOT needed (VPS uses nginx, not Apache)

**Data Files:**
- ✅ `stock_data/` folder (19 industries × ~40 JSON files each = 694 files total)
- ✅ `vietcap_financial_statements/` (694 Excel files)

**DO NOT UPLOAD TO VPS:**
- ❌ Frontend files (index.html, style.css, app.js, translations.js) - hosted on Vercel
- ❌ Deployment scripts (deploy.ps1, deploy-quick.ps1)
- ❌ Documentation (README.md, DEPLOY_README.md)
- ❌ venv/ folder
- ❌ backup files

---

### 💻 FILES FOR GITHUB (Repository: quanganhtapcode/ec2)

**Frontend Files:**
- ✅ `index.html` (38.81 KB) - Main application
- ✅ `style.css` (55.40 KB) - Responsive styles with mobile optimizations
- ✅ `app.js` (83.96 KB) - Frontend logic with deferred library loading
- ✅ `translations.js` (14.32 KB) - i18n support

**Data & Metadata:**
- ✅ `vietcap_financial_statements/` (694 Excel files) - Public download files
- ✅ `package.json` (0.44 KB) - Project metadata
- ✅ `README.md` (2.96 KB) - Project documentation

**Configuration (for reference only):**
- ✅ `.gitignore` - Controls what's excluded from Git
- ⚠️  `nginx-cache.conf` - Reference for VPS configuration
- ⚠️  `.htaccess` - Reference (not used in deployment)

**EXCLUDED VIA .gitignore:**
- ❌ Backend files (backend_server.py, valuation_models.py, requirements.txt, Procfile)
- ❌ stock_data/ folder (694 JSON files - too large, VPS only)
- ❌ Deployment scripts (deploy.ps1, deploy-quick.ps1, DEPLOY_README.md)
- ❌ Sensitive files (download_vietcap_financials.py - contains Bearer token)
- ❌ Backup files (backup*.zip, *.backup)
- ❌ venv/, __pycache__/, *.log

---

### 🗑️ UNNECESSARY FILES (Safe to Delete)

**Backup Files:**
- ❌ `style.css.backup` - Just created, can delete after verification
- ❌ `backup-20251126.zip` - Old backup
- ❌ `backup.zip` - Old backup

**Obsolete Scripts:**
- ❌ `rename_files.ps1` (1.92 KB) - One-time use script (already executed)
- ⚠️  `download_vietcap_financials.py` (9.25 KB) - Keep if you need to re-download data

**Deployment Scripts (Keep for convenience):**
- ⚠️  `deploy.ps1` - Full deployment automation
- ⚠️  `deploy-quick.ps1` - Quick VPS-only deployment
- ⚠️  `DEPLOY_README.md` - Deployment instructions

**Server Config References (Keep for documentation):**
- ⚠️  `.htaccess` - Apache config (not used, but kept as reference)
- ⚠️  `nginx-cache.conf` - Nginx config reference

---

## 🚀 Deployment Commands

### Deploy to VPS:
```powershell
# Upload style.css only
scp -i ~/Desktop/key.pem style.css root@203.55.176.10:~/apps/ec2/

# Full backend deployment
scp -i ~/Desktop/key.pem backend_server.py valuation_models.py requirements.txt root@203.55.176.10:~/apps/ec2/
ssh -i ~/Desktop/key.pem root@203.55.176.10 "cd ~/apps/ec2 && .venv/bin/pip install -r requirements.txt && systemctl restart ec2"
```

### Deploy to GitHub:
```powershell
git add index.html style.css app.js translations.js
git commit -m "feat: Update frontend files"
git push origin master
```

---

## 📊 Current State Summary

**VPS Backend (203.55.176.10):**
- ✅ Flask + Gunicorn running on port 5000
- ✅ Nginx reverse proxy with CORS headers
- ✅ flask-compress enabled (60-80% size reduction)
- ✅ Security headers configured
- ✅ 694 JSON stock data files
- ✅ 694 Excel financial statements

**GitHub Repository:**
- ✅ Frontend files version controlled
- ✅ Excel files included (public download)
- ✅ Backend excluded via .gitignore
- ✅ Latest commit: Mobile header alignment fix

**Vercel Deployment:**
- ✅ Auto-deploys from GitHub main branch
- ✅ Serves frontend (HTML/CSS/JS)
- ✅ CDN-backed globally
- ✅ HTTPS by default

---

## ⚠️ Important Notes

1. **Never commit to GitHub:**
   - Backend Python files (contain API logic)
   - stock_data/ JSON files (too large)
   - .env files or sensitive tokens
   - SSH keys (*.pem)

2. **VPS-only files:**
   - Backend server code
   - JSON stock data (stock_data/)
   - nginx configuration

3. **Shared between VPS & GitHub:**
   - Excel files in vietcap_financial_statements/
   - Configuration references (nginx-cache.conf, .htaccess)

4. **Cache Management:**
   - VPS: nginx cache (1 year static, 5 min HTML)
   - Frontend: ?v=5 cache busting on style.css

---

## 🔄 Latest Changes (Nov 26, 2025)

**Completed:**
- ✅ Mobile header perfect alignment (label + dropdown)
- ✅ Deferred Chart.js/jsPDF loading
- ✅ flask-compress gzip compression
- ✅ CORS fixed for VPS backend
- ✅ 44px touch targets (WCAG compliance)
- ✅ Created style.css.backup

**Files Modified:**
- style.css (v5) - Mobile alignment fixes
- backend_server.py - CORS + compression
- requirements.txt - Added flask-compress

**Deployment Status:**
- VPS: ✅ Deployed (style.css + backend fixes)
- GitHub: ✅ Committed (all frontend changes)

---

## 🔧 Cleanup Recommendations

**Safe to Delete NOW:**
```powershell
# Remove backup files
Remove-Item backup*.zip
Remove-Item style.css.backup

# Optional: Remove one-time scripts
Remove-Item rename_files.ps1
```

**Keep for Future Use:**
- deploy.ps1 / deploy-quick.ps1 (deployment automation)
- download_vietcap_financials.py (if you need to refresh data)
- DEPLOY_README.md (deployment guide)
- nginx-cache.conf / .htaccess (configuration references)
