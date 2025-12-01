# Hướng dẫn cập nhật VPS sau khi reorganize cấu trúc

## ⚠️ CẦN CẬP NHẬT TRÊN VPS

Sau khi đổi cấu trúc thư mục, bạn cần cập nhật các file sau trên VPS:

### 1. Systemd Service File

**File:** `/etc/systemd/system/gunicorn-ec2.service`

**Cần sửa:**
```ini
[Unit]
Description=Gunicorn instance for ec2 valuation app
After=network.target

[Service]
User=root
WorkingDirectory=/root/apps/ec2
Environment="PATH=/root/apps/ec2/venv/bin"

# SỬA DÒNG NÀY:
# CŨ: ExecStart=/root/apps/ec2/venv/bin/gunicorn --workers 3 --bind unix:ec2.sock backend_server:app
# MỚI:
ExecStart=/root/apps/ec2/venv/bin/gunicorn --workers 3 --bind unix:ec2.sock backend.server:app

Restart=always

[Install]
WantedBy=multi-user.target
```

**Lệnh cập nhật:**
```bash
# SSH vào VPS
ssh -i ~/Desktop/key.pem root@203.55.176.10

# Sửa file service
sudo nano /etc/systemd/system/gunicorn-ec2.service

# Tìm dòng ExecStart và sửa từ:
#   backend_server:app
# thành:
#   backend.server:app

# Lưu file (Ctrl+O, Enter, Ctrl+X)

# Reload systemd và restart service
sudo systemctl daemon-reload
sudo systemctl restart gunicorn-ec2.service
sudo systemctl status gunicorn-ec2.service
```

### 2. Cấu trúc thư mục trên VPS cũng cần thay đổi

**Trước khi deploy lần đầu sau khi reorganize, cần:**

```bash
# SSH vào VPS
ssh -i ~/Desktop/key.pem root@203.55.176.10

# Đi vào thư mục project
cd ~/apps/ec2

# Tạo cấu trúc thư mục mới
mkdir -p frontend backend scripts deployment docs

# Di chuyển file cũ sang cấu trúc mới (nếu chưa deploy)
# Hoặc đơn giản: xóa hết và deploy lại từ đầu
rm -rf *.py *.js *.html *.css *.json Procfile

# Sau đó chạy deploy script từ local:
# .\deployment\deploy.ps1
```

### 3. Cấu trúc mới trên VPS sẽ như thế này:

```
~/apps/ec2/
├── backend/
│   ├── server.py           # (cũ: backend_server.py)
│   ├── models.py           # (cũ: valuation_models.py)
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── translations.js
├── stocks/                 # (cũ: stock_data/)
│   └── *.json (694 files)
├── data/                   # (cũ: vietcap_financial_statements/)
│   └── *.xlsx files
├── deployment/
│   └── Procfile
├── venv/
└── package.json
```

### 4. Nginx config (nếu có)

**File:** `/etc/nginx/sites-available/ec2` hoặc tương tự

**Không cần sửa gì** vì Nginx chỉ proxy tới socket file, không quan tâm tên file Python.

### 5. Checklist sau khi cập nhật

- [ ] Sửa file `/etc/systemd/system/gunicorn-ec2.service`
- [ ] Chạy `sudo systemctl daemon-reload`
- [ ] Deploy lại toàn bộ từ local: `.\deployment\deploy.ps1`
- [ ] Kiểm tra service: `sudo systemctl status gunicorn-ec2.service`
- [ ] Test API: `curl https://api.quanganh.org/api/health`

### 6. Lệnh nhanh để update

```bash
# 1. SSH vào VPS
ssh -i ~/Desktop/key.pem root@203.55.176.10

# 2. Sửa service file
sudo nano /etc/systemd/system/gunicorn-ec2.service
# Đổi: backend_server:app → backend.server:app

# 3. Reload và restart
sudo systemctl daemon-reload
sudo systemctl restart gunicorn-ec2.service
sudo systemctl status gunicorn-ec2.service

# 4. Thoát VPS
exit

# 5. Từ local, deploy lại
cd C:\Users\PC\Downloads\Valuation
.\deployment\deploy.ps1 "Reorganize folder structure"
```

## ✅ Xong!

Sau các bước trên, VPS sẽ hoạt động bình thường với cấu trúc mới.
