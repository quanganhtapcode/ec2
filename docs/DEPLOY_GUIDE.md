# 🚀 Hướng dẫn Deploy & Vận hành

Chúng tôi cung cấp 2 công cụ chính giúp việc vận hành server trở nên đơn giản.

## 1. Deploy Code (`scripts/deploy.ps1`)

Dùng để **cập nhật tính năng mới** hàng ngày.

*   **Chức năng:** Upload code lên GitHub và VPS, sau đó restart server.
*   **Khi nào dùng:** Khi bạn vừa code xong một tính năng hoặc sửa lỗi code.

**Cách dùng:**
```powershell
# Chạy script
.\scripts\deploy.ps1

# Hoặc kèm tin nhắn commit
.\scripts\deploy.ps1 -CommitMessage "Sửa lỗi hiển thị biểu đồ"
```

---

## 2. Quản lý Server (`scripts/manage_vps.ps1`)

Dùng để **chẩn đoán và cứu hộ**.

*   **Chức năng:** Xem logs, kiểm tra trạng thái, và đặc biệt là **TỰ ĐỘNG SỬA LỖI (Fix Service)**.
*   **Khi nào dùng:**
    *   Khi web không vào được.
    *   Khi `deploy.ps1` chạy xong nhưng web vẫn lỗi.
    *   Khi bạn muốn xem log lỗi chi tiết.

**Cách dùng:**
```powershell
.\scripts\manage_vps.ps1
```

**Các Menu chính:**
*   `1. Check Status`: Kiểm tra nhanh xem Server sống hay chết.
*   `2. View Logs`: Xem nhật ký lỗi (đỡ phải SSH vào gõ lệnh).
*   `4. Fix Service`: **Quan trọng nhất.** Chức năng này sẽ cài đặt lại toàn bộ cấu hình service trên VPS chuẩn theo code mới nhất. Dùng khi cấu trúc project thay đổi hoặc bị lỗi cấu hình.

---

## 📋 Yêu cầu môi trường
*   Windows PowerShell.
*   SSH Key nằm tại: `~/Desktop/key.pem`.
*   Quyền truy cập VPS IP: `203.55.176.10`.

## ⚠️ Khắc phục sự cố thường gặp

### Lỗi: "Permission denied (publickey)"
*   Kiểm tra xem file `key.pem` có đúng vị trí `Desktop/key.pem` không.

### Lỗi: Web báo "502 Bad Gateway"
1.  Chạy `.\scripts\manage_vps.ps1`.
2.  Chọn **2. View Logs** để xem lỗi gì.
3.  Nếu không rõ, chọn **4. Fix Service** để cài đặt lại sạch sẽ từ đầu.

### Lỗi: "Access blocked" khi chạy Deploy
*   Đảm bảo bạn đang đứng đúng thư mục gốc của dự án.
