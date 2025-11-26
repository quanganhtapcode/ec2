# VietCap Financial Statements Downloader

Script tự động tải financial statements từ VietCap IQ cho tất cả 694 cổ phiếu trong `stock_data/`.

## 📋 Yêu cầu

```bash
pip install requests
```

## 🔑 Cách lấy Bearer Token mới

**Token hết hạn sau ~2 giờ, cần cập nhật thường xuyên.**

### Các bước:

1. Mở trình duyệt Chrome
2. Truy cập: https://iq.vietcap.com.vn/
3. Đăng nhập tài khoản VietCap
4. Nhấn **F12** để mở Developer Tools
5. Chuyển sang tab **Network**
6. Click vào bất kỳ cổ phiếu nào → Click nút **Download** financial statement
7. Trong Network tab, tìm request có tên: `export?language=1`
8. Click vào request đó → Tab **Headers**
9. Cuộn xuống phần **Request Headers**
10. Tìm dòng `Authorization: Bearer eyJhbGc...`
11. **Copy toàn bộ chuỗi** sau từ `Bearer` (không bao gồm chữ "Bearer ")
12. Paste vào file `download_vietcap_financials.py` dòng 11:

```python
BEARER_TOKEN = 'eyJhbGc...'  # ← Paste token vào đây
```

## 🚀 Cách chạy

### Bước 1: Cập nhật token
```bash
# Mở file trong editor
notepad download_vietcap_financials.py

# Hoặc
code download_vietcap_financials.py
```

Tìm dòng:
```python
BEARER_TOKEN = 'eyJhbGc...'
```

Thay bằng token mới bạn vừa copy.

### Bước 2: Chạy script

**Trong PowerShell:**
```powershell
# Kích hoạt virtual environment
.\venv\Scripts\Activate.ps1

# Chạy script
python download_vietcap_financials.py
```

**Hoặc nếu không dùng venv:**
```powershell
python download_vietcap_financials.py
```

### Bước 3: Xác nhận

Script sẽ hỏi:
```
⚠️  Sẽ tải 694 files Excel (có thể mất ~12 phút)
Tiếp tục? (y/n):
```

Gõ `y` và nhấn Enter.

## 📊 Output

Files sẽ được lưu vào folder:
```
vietcap_financial_statements/
├── AAA_financial_statement.xlsx
├── AAM_financial_statement.xlsx
├── AAT_financial_statement.xlsx
├── ...
└── YEG_financial_statement.xlsx
```

## ⏱️ Thời gian dự kiến

- **694 cổ phiếu** × **1 giây delay** = ~**12 phút**
- Pause 5 giây sau mỗi 50 requests
- Tổng thời gian: **~15 phút**

## 📝 Tính năng

✅ **Auto-resume**: Lưu progress mỗi 10 files vào `download_progress.json`  
✅ **Error handling**: Skip files lỗi, tiếp tục download  
✅ **Token expiry detection**: Dừng ngay khi phát hiện token hết hạn  
✅ **Progress display**: Hiển thị real-time progress  
✅ **File validation**: Kiểm tra file Excel hợp lệ  
✅ **Batch pause**: Tránh rate limiting  

## 🛠️ Troubleshooting

### Lỗi: "401 - Token expired"

**Nguyên nhân**: Token đã hết hạn (thường sau 2 giờ)

**Giải pháp**: Lấy token mới theo hướng dẫn trên, cập nhật vào `BEARER_TOKEN`

### Lỗi: "404 - Not found"

**Nguyên nhân**: Cổ phiếu không có financial statement trên VietCap IQ

**Giải pháp**: Bình thường, script sẽ skip và tiếp tục

### Lỗi: Connection timeout

**Nguyên nhân**: Mạng chậm hoặc VietCap server quá tải

**Giải pháp**: 
- Chạy lại script (sẽ resume từ chỗ dừng)
- Tăng `REQUEST_DELAY` lên 2-3 giây

### Script bị dừng giữa chừng

**Giải pháp**: 
- Kiểm tra `download_progress.json` để xem đã tải được bao nhiêu
- Chạy lại script, nó sẽ skip các file đã tải

## 📈 Kết quả mẫu

```
======================================================================
  📊 VIETCAP FINANCIAL STATEMENT DOWNLOADER
======================================================================

✓ Output folder: C:\Users\PC\Downloads\Valuation\vietcap_financial_statements
✓ Tìm thấy 694 cổ phiếu trong stock_data/

⚠️  Sẽ tải 694 files Excel (có thể mất ~12 phút)
Tiếp tục? (y/n): y

======================================================================
BẮT ĐẦU DOWNLOAD...
======================================================================

[  1/694] AAA    ... ✓    45.2 KB
[  2/694] AAM    ... ✓    52.1 KB
[  3/694] AAT    ... ✓    48.9 KB
...
[694/694] YEG    ... ✓    51.3 KB

======================================================================
KẾT QUẢ
======================================================================
✓ Thành công: 680/694 cổ phiếu
✗ Thất bại:   14/694 cổ phiếu
⏱️  Thời gian:   14.2 phút

📁 Files: 680 files, 34.5 MB
📂 Location: C:\Users\PC\Downloads\Valuation\vietcap_financial_statements

✅ HOÀN THÀNH!
======================================================================
```

## ⚙️ Tuỳ chỉnh

Mở file `download_vietcap_financials.py` và chỉnh sửa:

```python
# Delay giữa các requests (giây)
REQUEST_DELAY = 1  # Tăng lên 2-3 nếu bị rate limit

# Pause sau mỗi X requests
BATCH_SIZE = 50  # Giảm xuống 20-30 nếu cần safer

# Ngôn ngữ (1 = Tiếng Việt, 0 = English)
params = {'language': '1'}
```

## 🔒 Bảo mật

⚠️ **QUAN TRỌNG**: 
- **KHÔNG commit** file này lên GitHub (có token)
- Token là thông tin nhạy cảm, giống như password
- Thêm vào `.gitignore`:
  ```
  download_vietcap_financials.py
  vietcap_financial_statements/
  download_progress.json
  ```

## 📚 Sử dụng tiếp

Sau khi tải xong, bạn có thể:

1. **Parse Excel files** bằng `pandas`:
   ```python
   import pandas as pd
   df = pd.read_excel('vietcap_financial_statements/VCB_financial_statement.xlsx')
   ```

2. **Convert sang JSON** để dùng cho backend
3. **Phân tích financial ratios** tự động
4. **Update stock_data** với dữ liệu mới nhất

## 📞 Support

Nếu có vấn đề, check:
1. Token còn hạn không? (mở https://iq.vietcap.com.vn/ test)
2. Internet connection ổn định không?
3. File `download_progress.json` để xem progress
