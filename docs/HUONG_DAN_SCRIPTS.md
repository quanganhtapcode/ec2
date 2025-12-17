# Hướng Dẫn Chi Tiết Các Script Tự Động Hóa (Automation)

Tài liệu này giải thích chi tiết chức năng, cách sử dụng và môi trường chạy của từng script trong thư mục `automation/`.

## Phân Loại Script

Tất cả các script hiện nằm trong thư mục `automation/`. Chúng được chia thành 2 nhóm chính:

1.  **Nhóm Xử Lý Dữ Liệu (Python)**: Chịu trách nhiệm tải, tính toán và cập nhật dữ liệu chứng khoán. Đây là "bộ não" của hệ thống data.
2.  **Nhóm Quản Trị & Deploy (PowerShell)**: Các công cụ giúp bạn thao tác với VPS từ máy tính cá nhân (Deploy code, cài đặt service, v.v.).

---

## 1. Nhóm Xử Lý Dữ Liệu (Python Scripts)

Các file này là lõi của hệ thống, thực hiện các công việc data cụ thể.

### `update_tickers.py`
*   **Chức năng**:
    *   Kết nối API `vnstock` để tải danh sách toàn bộ mã chứng khoán (HOSE, HNX, UPCOM).
    *   Lấy thông tin chi tiết: Tên công ty, Sàn, Ngành nghề.
    *   Lưu kết quả vào file `frontend/ticker_data.json`.
*   **Môi trường chạy**:
    *   **VPS**: Chạy tự động hàng ngày lúc 02:00 AM (qua Systemd Timer) để cập nhật search bar trên web.
    *   **Local**: Chạy thủ công khi bạn muốn test tính năng lấy list mới.
*   **Cách chạy**: `python automation/update_tickers.py`

### `update_peers.py`
*   **Chức năng**:
    *   Đọc dữ liệu tài chính của các công ty trong database local.
    *   Tính toán chỉ số P/E, P/B trung vị (Median) cho từng Ngành.
    *   Lưu kết quả vào `sector_peers.json` để phục vụ tính năng định giá so sánh.
*   **Môi trường chạy**:
    *   **VPS**: Chạy định kỳ hoặc tự kích hoạt sau khi nạp báo cáo tài chính mới.
    *   **Local**: Chạy tính toán thử nghiệm.
*   **Cách chạy**: `python automation/update_peers.py`

### `update_json_data.py`
*   **Chức năng**:
    *   Script đa năng dùng để cập nhật dữ liệu chi tiết cho từng mã cổ phiếu (Giá, Chỉ số tài chính, Báo cáo tài chính).
    *   Lưu vào thư mục `stocks/`.
*   **Môi trường chạy**:
    *   **Local**: Thường dùng để tải data về máy cá nhân phân tích.
    *   **VPS**: Có thể dùng để refresh data định kỳ.

### `update_excel_data.py`
*   **Chức năng**:
    *   Tạo hoặc cập nhật các file Excel từ dữ liệu JSON. Phục vụ việc download report dạng Excel.
*   **Môi trường chạy**:
    *   **Local**: Chạy khi cần tạo file Excel báo cáo.

---

## 2. Nhóm Quản Trị & Deploy (PowerShell Scripts)

Các file `.ps1` này chạy trên **Windows (Máy Local)** của bạn để điều khiển VPS từ xa.

### `manage_vps.ps1`
*   **Chức năng**:
    *   Đây là "Trung tâm điều khiển". Nó chứa menu chọn lựa để thực hiện nhiều tác vụ thường gặp như:
        *   Kết nối SSH vào VPS.
        *   Xem log (nhật ký) của server.
        *   Khởi động lại server backend.
        *   Kiểm tra trạng thái service.
*   **Nơi chạy**: **Local** (Windows).
*   **Cách dùng**: Right-click -> Run with PowerShell.

### `deploy.ps1`
*   **Chức năng**:
    *   Copy code từ máy bạn lên VPS.
    *   Thường dùng khi bạn sửa code Backend hoặc Frontend và muốn đẩy lên server.
*   **Nơi chạy**: **Local**.

### `deploy_sector_peers.ps1`
*   **Chức năng**:
    *   Chuyên biệt để deploy/copy file `sector_peers.json` hoặc các logic liên quan lên VPS. (Có thể gộp vào `deploy.ps1` nhưng hiện đang tách riêng).
*   **Nơi chạy**: **Local**.

### `setup_auto_update.ps1` & `pull_data.ps1`
*   **Chức năng**:
    *   `setup_auto_update.ps1`: Hỗ trợ tạo file service systemd trên VPS (cũ). Hiện tại bạn đang quản lý systemd thủ công trên VPS nên file này dùng để tham khảo.
    *   `pull_data.ps1`: Tải ngược dữ liệu từ VPS về máy Local (Backup data).
*   **Nơi chạy**: **Local**.

---

## 3. Tóm Tắt Quy Trình Vận Hành

### Hàng ngày (Tự động trên VPS):
Hệ thống tự chạy `update_tickers.py` lúc 2h sáng để website luôn có mã mới nhất. Bạn không cần làm gì cả.

### Khi bạn sửa code (Ví dụ sửa giao diện web):
1.  Sửa code ở máy Local.
2.  Chạy `deploy.ps1` để đẩy code lên VPS.
3.  Web tự cập nhật (hoặc cần restart server qua `manage_vps.ps1`).

### Khi bạn muốn cập nhật Logic tính toán Ngành:
1.  Sửa `update_peers.py` ở Local.
2.  Copy file này lên VPS (thủ công hoặc qua script deploy).
3.  SSH vào VPS và chạy thử để tạo file `sector_peers.json` mới.
