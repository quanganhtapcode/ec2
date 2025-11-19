# 🚀 Auto Deployment Scripts

2 scripts tự động deploy code lên VPS và GitHub/Vercel:

- **`deploy-quick.ps1`** ⚡ - Deploy nhanh (chỉ code, không có stock_data) - **Dùng hàng ngày**
- **`deploy.ps1`** 📦 - Deploy đầy đủ (code + 694 JSON files) - **Dùng khi cần update data**

## 📋 Yêu cầu

- PowerShell 5.1 trở lên
- **Git** đã cài đặt ([Download tại đây](https://git-scm.com/download/win))
- SSH key tại: `~/Desktop/key.pem`
- Git đã được config (user.name, user.email)
- Quyền truy cập SSH vào VPS: `root@203.55.176.10`
- Folder Valuation sẽ được khởi tạo thành Git repository tự động

## 🎯 Sử dụng

### ⚡ Deploy nhanh (Khuyên dùng hàng ngày)

```powershell
# Deploy code thôi - NHANH (không upload stock_data)
.\deploy-quick.ps1

# Hoặc với custom message
.\deploy-quick.ps1 -CommitMessage "Fix: Race condition"
```

### 📦 Deploy đầy đủ (Khi cần update stock data)

```powershell
# Deploy code + 694 JSON files - CHẬM HƠN
.\deploy.ps1

# Hoặc với custom message
.\deploy.ps1 -CommitMessage "Update: Stock data for Q4 2025"
```

### 📊 So sánh tốc độ:

| Script | Files Upload | VPS Upload Time | Use Case |
|--------|--------------|-----------------|----------|
| **deploy-quick.ps1** | 9 files | ~5-10 giây | Code updates hàng ngày |
| **deploy.ps1** | 9 files + 694 JSONs | ~2-5 phút | Cập nhật stock data |

### Ví dụ:

```powershell
# === DEPLOY NHANH (Hàng ngày) ===
.\deploy-quick.ps1 -CommitMessage "Fix: Update API endpoint"
.\deploy-quick.ps1 -CommitMessage "Bugfix: Resolve race condition"
.\deploy-quick.ps1 -CommitMessage "Feature: Add request cancellation"

# === DEPLOY ĐẦY ĐỦ (Khi cần update data) ===
.\deploy.ps1 -CommitMessage "Update: Stock data for November 2025"
.\deploy.ps1 -CommitMessage "Data: Add new stocks to database"
```

## 📦 Files và Folders được deploy

Script sẽ tự động deploy các files sau:

### Python Backend:
1. `valuation_models.py` - Core valuation models (FCFE, FCFF, P/E, P/B)
2. `backend_server.py` - Flask API server với endpoints
3. `requirements.txt` - Python dependencies
4. `Procfile` - Gunicorn configuration

### Frontend:
5. `app.js` - Frontend JavaScript logic
6. `index.html` - HTML template
7. `style.css` - CSS styling
8. `translations.js` - Vietnamese/English translations

### Configuration:
9. `package.json` - Project metadata

### Data Folder:
10. `stock_data/` - 694 individual JSON files (VCB.json, VSC.json, etc.)

## 🔄 Quy trình deployment

### Bước 1: Deploy lên VPS (Backend API)
1. ✅ Upload 9 files chính qua SCP
2. ✅ Sync folder `stock_data/` (694 JSON files)
3. ✅ Restart Gunicorn service tự động
4. ✅ Kiểm tra service status (active/inactive)
5. ✅ Hiển thị logs nếu có lỗi

**VPS sẽ reload code ngay lập tức!**

### Bước 2: Deploy lên GitHub/Vercel
1. ✅ Kiểm tra Git đã cài đặt
2. ✅ Khởi tạo Git repository (nếu chưa có)
3. ✅ Git add tất cả thay đổi
4. ✅ Git commit với message tùy chỉnh
5. ✅ Git push lên GitHub
6. ✅ Vercel tự động trigger deployment

**Vercel sẽ deploy trong ~1-2 phút!**

## 🌐 Deployment Targets

| Platform | URL | Purpose | Auto-Deploy |
|----------|-----|---------|-------------|
| **VPS** | https://api.quanganh.org | Backend API chính | ✅ Tức thì |
| **GitHub** | https://github.com/quanganhtapcode/ec2 | Source code repository | ✅ Script tự động |
| **Vercel** | https://valuation.quanganh.org | Website production | ✅ Auto từ GitHub |

## ⚙️ Cấu hình

Nếu cần thay đổi cấu hình, sửa các biến trong file `deploy.ps1`:

```powershell
# Đường dẫn project hiện tại (source code + Git repo)
$ProjectPath = "C:\Users\PC\Downloads\Valuation"

# SSH key để kết nối VPS
$SSHKey = "~/Desktop/key.pem"

# VPS host và đường dẫn deploy
$VPSHost = "root@203.55.176.10"
$VPSPath = "~/apps/ec2"

# GitHub remote URL
$GitRemote = "https://github.com/quanganhtapcode/ec2.git"

# Files cần deploy (tự động sync)
$FilesToDeploy = @(
    "valuation_models.py",
    "backend_server.py",
    "app.js",
    "index.html",
    "style.css",
    "translations.js",
    "requirements.txt",
    "Procfile",
    "package.json"
)

# Folders cần sync
$FoldersToSync = @(
    "stock_data"  # 694 JSON files
)
```

### Quan trọng:
- ⚠️ **ProjectPath**: Thư mục chứa code đang làm việc (LÀ Git repository luôn)
- ⚠️ **GitRemote**: URL của GitHub repository
- ⚠️ **stock_data**: Folder chứa 694 file JSON (VCB.json, VSC.json, etc.)

## 📁 Cấu trúc Project

```
Valuation/                          # Project + Git repository
├── .git/                           # Git metadata
├── .gitignore                      # Git ignore rules
├── deploy.ps1                      # ← Deploy script
├── DEPLOY_README.md                # ← Hướng dẫn deploy
├── README.md                       # Project documentation
├── backend_server.py               # Flask API
├── valuation_models.py             # Valuation logic
├── app.js                          # Frontend JS
├── index.html                      # HTML
├── style.css                       # CSS
├── translations.js                 # i18n
├── requirements.txt                # Python deps
├── Procfile                        # Gunicorn config
├── package.json                    # Metadata
├── LICENSE                         # MIT License
├── venv/                           # Virtual environment (ignored)
├── __pycache__/                    # Python cache (ignored)
└── stock_data/                     # 694 JSON files
    ├── VCB.json
    ├── VSC.json
    ├── VNM.json
    └── ... (691 more files)
```

**Lưu ý**: Folder `Valuation/` vừa là workspace LÀ Git repository, không cần folder riêng.

## 🛠️ Troubleshooting

### ❌ Lỗi: "Permission denied (publickey)"
**Nguyên nhân**: SSH key không đúng hoặc không có quyền truy cập

**Giải pháp**:
```powershell
# Kiểm tra SSH key tồn tại
Test-Path ~/Desktop/key.pem

# Thử kết nối VPS thủ công
ssh -i ~/Desktop/key.pem root@203.55.176.10

# Nếu trên Linux/Mac, set quyền cho key
chmod 600 ~/Desktop/key.pem
```

### ❌ Lỗi: "Git push failed"
**Nguyên nhân**: Git credentials chưa được cấu hình hoặc sai

**Giải pháp**:
```powershell
# Kiểm tra Git config
git config user.name
git config user.email

# Cấu hình lại nếu cần
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# Kiểm tra remote URL
git remote -v

# Thử push thủ công
cd C:\Users\PC\Downloads\Valuation
git push origin main
```

### ❌ Lỗi: "Gunicorn service failed"
**Nguyên nhân**: Backend code có lỗi syntax hoặc dependency thiếu

**Giải pháp**:
```powershell
# SSH vào VPS
ssh -i ~/Desktop/key.pem root@203.55.176.10

# Kiểm tra service status
sudo systemctl status gunicorn-ec2.service

# Xem logs chi tiết (50 dòng cuối)
journalctl -u gunicorn-ec2.service -n 50

# Restart thủ công nếu cần
sudo systemctl restart gunicorn-ec2.service

# Kiểm tra Python dependencies
cd ~/apps/ec2
pip install -r requirements.txt
```

### ⚠️ Lỗi: "Nothing to commit"
**Không phải lỗi!** Nghĩa là không có thay đổi mới so với lần deploy trước.

### ❌ Lỗi: "Git is not recognized"
**Nguyên nhân**: Git chưa được cài đặt

**Giải pháp**:
```powershell
# Download và cài đặt Git
# https://git-scm.com/download/win

# Sau khi cài, mở lại PowerShell và kiểm tra
git --version
```

### 🔍 Debug Mode
Nếu muốn xem chi tiết quá trình deploy:

```powershell
# Chạy từng lệnh trong deploy.ps1 thủ công
# Xem output chi tiết của mỗi bước

# Ví dụ: Upload 1 file
scp -i ~/Desktop/key.pem backend_server.py root@203.55.176.10:~/apps/ec2/

# Ví dụ: Restart service
ssh -i ~/Desktop/key.pem root@203.55.176.10 "cd ~/apps/ec2 && sudo systemctl restart gunicorn-ec2.service"
```

## 📝 Logs và Monitoring

Script sẽ hiển thị output với màu sắc:

| Icon | Ý nghĩa | Màu |
|------|---------|-----|
| ✅ | Thành công | Green |
| ❌ | Lỗi | Red |
| ⚠️ | Cảnh báo | Yellow |
| ℹ️ | Thông tin | Yellow |
| 📤 | Uploading | Yellow |
| 🔄 | Restarting | Yellow |
| 🔍 | Checking | Yellow |

### Output mẫu khi deploy thành công:

```
╔════════════════════════════════════════════════╗
║   🚀 VALUATION PROJECT DEPLOYMENT SCRIPT      ║
╚════════════════════════════════════════════════╝

📅 Deployment Time: 2025-11-19 14:30:25
💬 Commit Message: Fix: Prevent race condition on symbol switch

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 STEP 1: DEPLOYING TO VPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 Uploading files to VPS...
  → Uploading valuation_models.py... ✅
  → Uploading backend_server.py... ✅
  → Uploading app.js... ✅
  → Uploading index.html... ✅
  → Uploading style.css... ✅
  → Uploading translations.js... ✅
  → Uploading requirements.txt... ✅
  → Uploading Procfile... ✅
  → Uploading package.json... ✅

📂 Syncing folders to VPS...
  → Syncing stock_data/... ✅

🔄 Restarting Gunicorn service... ✅
🔍 Checking service status... ✅ ACTIVE

✅ VPS deployment completed!
🌐 API URL: https://api.quanganh.org

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 STEP 2: DEPLOYING TO GITHUB/VERCEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Git status...
 M app.js
 M backend_server.py

➕ Git add... ✅
💾 Git commit... ✅
🚀 Git push... ✅

✅ GitHub deployment completed!
🌐 GitHub Repo: https://github.com/quanganhtapcode/ec2
🌐 Vercel URL: https://valuation.quanganh.org
   ℹ️  Vercel sẽ tự động deploy trong ~1-2 phút

╔════════════════════════════════════════════════╗
║   🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!       ║
╚════════════════════════════════════════════════╝

📊 Summary:
  ✅ VPS deployed and service restarted
  ✅ GitHub updated with commit: 'Fix: Prevent race condition on symbol switch'
  ✅ Vercel auto-deployment triggered

🔗 URLs:
  → VPS API: https://api.quanganh.org
  → Website: https://valuation.quanganh.org
  → GitHub: https://github.com/quanganhtapcode/ec2
```

## 🚀 Quick Start Guide

### Lần đầu tiên setup:

```powershell
# 1. Cài đặt Git (nếu chưa có)
winget install --id Git.Git -e --source winget
# Hoặc download tại: https://git-scm.com/download/win

# 2. Kiểm tra SSH key
Test-Path ~/Desktop/key.pem

# 3. Test kết nối VPS
ssh -i ~/Desktop/key.pem root@203.55.176.10

# 4. Cấu hình Git (nếu chưa)
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# 5. Chạy deploy lần đầu (full deployment)
cd C:\Users\PC\Downloads\Valuation
.\deploy.ps1
```

### Những lần sau:

```powershell
# Hàng ngày - Deploy code nhanh (5-10 giây)
.\deploy-quick.ps1 -CommitMessage "Your changes"

# Khi cần update stock data (2-5 phút)
.\deploy.ps1 -CommitMessage "Update stock data"
```

## 💡 Best Practices

✅ **Nên làm:**
- Dùng `deploy-quick.ps1` cho code updates hàng ngày
- Dùng `deploy.ps1` khi thêm/sửa file JSON trong stock_data
- Commit message rõ ràng: "Fix:", "Feature:", "Update:"

❌ **Không nên:**
- Dùng `deploy.ps1` khi chỉ sửa code (lãng phí thời gian)
- Upload stock_data liên tục khi không cần thiết
