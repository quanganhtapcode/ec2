# Vietnam Stock Valuation Tool

Ứng dụng định giá cổ phiếu Việt Nam đơn giản và hiệu quả. Tự động tính toán các chỉ số FCFE, FCFF, P/E, P/B và đưa ra khuyến nghị đầu tư.

## 🚀 Tính năng chính

*   **Định giá tự động:** Nhập mã cổ phiếu (ví dụ: VCB, HPG), app tự tính giá trị thực.
*   **Dữ liệu Real-time:** Kết nối trực tiếp với thị trường chứng khoán Việt Nam.
*   **Biểu đồ trực quan:** Xem xu hướng tài chính và biến động giá.
*   **Khuyến nghị:** Mua/Bán/Giữ dựa trên biên an toàn 15%.

## 🛠️ Hướng dẫn cài đặt & Chạy Local

### 1. Backend (Python)
Cài đặt thư viện và chạy server định giá:

```bash
# Vào thư mục
cd C:\Users\PC\Downloads\Valuation

# Cài đặt thư viện (chỉ làm lần đầu)
pip install flask flask-cors vnstock pandas numpy requests

# Chạy server
python backend/server.py
```
*Server sẽ chạy tại: `http://localhost:5000`*

### 2. Frontend (Giao diện)
Đơn giản là mở file `frontend/index.html` bằng trình duyệt (hoặc dùng Live Server trong VS Code).

---

## ☁️ Quản lý VPS & Deploy (Dành cho Admin)

Chúng tôi cung cấp 2 công cụ (script) tự động hóa mọi việc. Bạn không cần nhớ lệnh phức tạp.

### 1. Deploy Code Mới (`scripts/deploy.ps1`)
Dùng khi bạn vừa sửa code backend/frontend xong và muốn đưa lên VPS.

```powershell
.\scripts\deploy.ps1
```
*Script sẽ tự động:*
*   Commit code lên GitHub.
*   Upload file thay đổi lên VPS.
*   Khởi động lại server.

### 2. Quản lý & Sửa Lỗi VPS (`scripts/manage_vps.ps1`)
Dùng khi:
*   Web bị lỗi 502, không vào được.
*   Muốn xem server đang chạy thế nào.
*   Cài đặt lại toàn bộ cấu hình server (Option "Fix Service").

```powershell
.\scripts\manage_vps.ps1
```
*Chọn các số 1, 2, 3... tương ứng trên menu để thực hiện.*

---

## 📚 Tài liệu chi tiết
*   [Hướng dẫn Deploy chi tiết](docs/deploy-guide.md)
*   [Update cấu hình VPS](docs/UPDATE_VPS.md)

---
© 2025 quanganhdeptrai.
