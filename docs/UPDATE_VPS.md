# Hướng dẫn Cập nhật & Sửa lỗi VPS

Sau khi thay đổi cấu trúc thư mục hoặc nếu Web gặp lỗi (502 Bad Gateway), bạn **KHÔNG CẦN** làm thủ công nữa.

## ✅ Cách nhanh nhất: Dùng Script Tự Động

Chúng tôi đã tạo một công cụ tự động để sửa chữa và cập nhật mọi cấu hình trên VPS.

### Bước 1: Chạy Script
Mở PowerShell tại thư mục dự án và chạy:

```powershell
.\scripts\manage_vps.ps1
```

### Bước 2: Chọn Menu "4. Fix Service"
*   Chọn số **4** và nhấn Enter.
*   Công cụ sẽ tự động:
    1.  Upload toàn bộ code mới nhất (backend/frontend).
    2.  Tạo lại file cấu hình service chuẩn xác.
    3.  Cài đặt và khởi động lại system trên VPS.
    4.  Kiểm tra kết quả.

---

## 🔍 Kiểm tra kết quả
Sau khi chạy xong, bạn có thể chọn số **1. Check Status** để đảm bảo mọi thứ đã xanh (OK).

---
*File cấu hình systemd được script tạo ra nằm ở:* `/etc/systemd/system/gunicorn-ec2.service`
