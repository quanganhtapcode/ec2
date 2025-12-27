# 🚀 Hướng dẫn Deploy

## Tổng quan

| Môi trường | URL |
|------------|-----|
| **Production** | https://valuation.quanganh.org |
| **API** | https://api.quanganh.org |
| **VPS** | 203.55.176.10 (root@10.66.66.1) |

---

## 1. Deploy Code (Hàng ngày)

Sử dụng script tự động:

```powershell
# Từ thư mục project
cd C:\Users\PC\Downloads\Valuation

# Deploy với commit message
.\automation\deploy.ps1 -CommitMessage "Mô tả thay đổi"
```

**Script sẽ tự động:**
1. ✅ Commit & push code lên GitHub
2. ✅ Sync files lên VPS qua SCP
3. ✅ Restart gunicorn service

---

## 2. SSH vào VPS (Khi cần debug)

```powershell
ssh -i "$env:USERPROFILE\Desktop\key.pem" root@10.66.66.1
```

**Các lệnh hữu ích:**
```bash
# Xem logs
journalctl -u gunicorn-ec2 -f

# Restart service
systemctl restart gunicorn-ec2

# Check status
systemctl status gunicorn-ec2
```

---

## 3. Cấu trúc trên VPS

```
/root/apps/ec2/
├── backend/
│   ├── server.py
│   ├── models.py
│   └── r2_client.py
├── frontend/
├── .venv/              # Virtual environment
├── .env                # R2 credentials
└── stocks/             # Stock JSON data
```

---

## 4. Cập nhật Dependencies trên VPS

```bash
cd /root/apps/ec2
source .venv/bin/activate
pip install -r requirements.txt
systemctl restart gunicorn-ec2
```

---

## 5. Troubleshooting

### Lỗi 502 Bad Gateway
```bash
# Xem log lỗi
journalctl -u gunicorn-ec2 --since "10 min ago"

# Restart service
systemctl restart gunicorn-ec2
```

### Lỗi Permission denied (SSH)
- Kiểm tra file `key.pem` tại `~/Desktop/key.pem`
- Đảm bảo quyền: `chmod 400 key.pem`

### Service không start
```bash
# Kiểm tra syntax Python
cd /root/apps/ec2
source .venv/bin/activate
python -c "from backend.server import app; print('OK')"
```

---

## 6. Backup & Rollback

```bash
# Trên VPS - backup trước khi thay đổi lớn
cp -r /root/apps/ec2 /root/apps/ec2_backup_$(date +%Y%m%d)

# Rollback nếu có lỗi
rm -rf /root/apps/ec2
mv /root/apps/ec2_backup_YYYYMMDD /root/apps/ec2
systemctl restart gunicorn-ec2
```
