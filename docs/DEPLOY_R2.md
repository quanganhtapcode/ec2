# 🚀 Hướng dẫn Deploy R2 Storage lên VPS

## Tổng quan
Hệ thống đã được cập nhật để sử dụng **Cloudflare R2** thay vì lưu file Excel trên VPS local.

### Lợi ích:
- ✅ **Giảm tải VPS**: File Excel không còn lưu trên VPS
- ✅ **Tốc độ nhanh hơn**: R2 có CDN toàn cầu
- ✅ **Bảo mật**: Pre-signed URLs với thời hạn 15 phút
- ✅ **Tiết kiệm dung lượng**: ~80MB Excel files → Cloud storage

---

## Các bước Deploy lên VPS

### 1. Push code lên GitHub
```powershell
# Từ máy local
cd C:\Users\PC\Downloads\Valuation
git add .
git commit -m "feat: migrate Excel storage to Cloudflare R2"
git push origin main
```

### 2. SSH vào VPS và pull code
```bash
ssh -i ~/Desktop/key.pem admin@203.55.176.10

cd ~/Valuation
git pull origin main
```

### 3. Cài đặt dependencies mới
```bash
source venv/bin/activate
pip install boto3 python-dotenv
```

### 4. Tạo file .env trên VPS
```bash
# Tạo file .env với R2 credentials
cat > ~/Valuation/.env << 'EOF'
R2_ACCOUNT_ID=2fe56347256799c77191fc809ebdac8a
R2_ACCESS_KEY_ID=588e8168b31e88d845383124fd89d0c5
R2_SECRET_ACCESS_KEY=e0778bfe8ff619ed406f04712be4ac9027e1843610774146a09ba1fe190189a4
R2_BUCKET_NAME=data
R2_ENDPOINT_URL=https://2fe56347256799c77191fc809ebdac8a.r2.cloudflarestorage.com
R2_EXCEL_FOLDER=excel
EOF

# Bảo vệ file
chmod 600 ~/Valuation/.env
```

### 5. Restart service
```bash
sudo systemctl restart valuation
sudo systemctl status valuation
```

### 6. Test endpoint
```bash
# Test download endpoint
curl -I "https://api.quanganh.org/api/download/VCB" 

# Nếu thấy redirect 302 → R2 đang hoạt động
```

---

## Cấu trúc file mới

```
Valuation/
├── .env                    # R2 credentials (KHÔNG COMMIT)
├── requirements.txt        # Thêm boto3, python-dotenv
├── backend/
│   ├── server.py          # Đã cập nhật download endpoint
│   └── r2_client.py       # NEW: R2 storage client
├── automation/
│   ├── update_excel_data.py    # Upload trực tiếp lên R2
│   └── migrate_excel_to_r2.py  # Migration script (đã chạy)
└── data/                   # Có thể xóa sau khi verify R2
```

---

## Cập nhật Excel Data định kỳ

Trên VPS, script `update_excel_data.py` giờ sẽ:
1. Download từ VietCap API
2. Upload **trực tiếp lên R2** (không lưu local)

```bash
# Test thủ công
cd ~/Valuation
source venv/bin/activate
python automation/update_excel_data.py
```

---

## Xử lý sự cố

### Lỗi: R2 client not configured
```bash
# Kiểm tra file .env tồn tại
cat ~/Valuation/.env

# Kiểm tra biến môi trường được load
python -c "import os; from dotenv import load_dotenv; load_dotenv('.env'); print(os.getenv('R2_BUCKET_NAME'))"
```

### Lỗi: 403 Forbidden từ R2
- Kiểm tra API Token còn hạn không
- Kiểm tra Token có quyền Read/Write bucket "data" không
- Tạo token mới tại: Cloudflare Dashboard → R2 → Manage API Tokens

### Fallback sang Local
Nếu R2 gặp sự cố, server sẽ tự động fallback sang folder `data/` local (nếu có file).

---

## Bảo mật

⚠️ **QUAN TRỌNG**: 
- File `.env` **KHÔNG ĐƯỢC COMMIT** lên Git
- R2 Secret Access Key chỉ hiển thị **MỘT LẦN** khi tạo
- Nếu lộ key, vào Cloudflare Dashboard → R2 → Manage API Tokens → Revoke và tạo mới
