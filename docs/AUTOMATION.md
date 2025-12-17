# Tài Liệu Vận Hành Hệ Thống Tự Động (Automation Guide)

Tài liệu này giải thích chi tiết cách hệ thống tự động cập nhật dữ liệu chứng khoán, cách đồng bộ dữ liệu giữa VPS và Máy Local, và quy trình deploy lên Web.

---

## 1. Tổng Quan Kiến Trúc

Hệ thống hoạt động dựa trên nguyên tắc: **"VPS là máy sản xuất dữ liệu - Local là nơi phân phối"**.

*   **VPS (Máy chủ)**: Chịu trách nhiệm chạy các tác vụ nặng (tải data, tính toán chỉ số) theo lịch định kỳ.
*   **Local (Máy tính cá nhân)**: Tải dữ liệu thành phẩm từ VPS về, sau đó đẩy lên GitHub/Vercel để cập nhật cho người dùng Web.

---

## 2. Quy Trình Tự Động Trên VPS (The Automation Pipeline)

Hiện tại, hệ thống **CHỈ CÓ 1 LỊCH CHẠY DUY NHẤT** để đảm bảo tính nhất quán và tiết kiệm tài nguyên.

### 🕒 Lịch chạy:
*   **Thời gian**: 02:00 sáng.
*   **Ngày chạy**: Ngày **01** và ngày **15** hàng tháng.
*   **Cơ chế**: Systemd Timer (`val-updater.timer`) kích hoạt script chủ.

### 🔗 Dây Chuyền Xử Lý (Chain of Command)
Khi đến giờ hẹn, script `automation/update_json_data.py` sẽ được kích hoạt và tự động điều phối 4 bước liên tiếp sau đây:

#### **Bước 1: Cập Nhật Danh Sách Hiển Thị (`update_tickers.py`)**
*   **Hành động**: Quét toàn bộ thị trường (HOSE, HNX, UPCOM).
*   **Đầu ra**: File `frontend/ticker_data.json`.
*   **Mục đích**: Cung cấp danh sách mã đầy đủ nhất (1500+ mã) cho thanh Tìm Kiếm (Search Bar) trên Website.

#### **Bước 2: Lọc Danh Sách Cổ Phiếu (`generate_stock_list.py`)**
*   **Hành động**: Từ dữ liệu thị trường, lọc bỏ các mã rác, chứng quyền, ETF không cần thiết. Chỉ giữ lại cổ phiếu HOSE và HNX.
*   **Đầu ra**: File `stock_list.json` (Khoảng 700+ mã).
*   **Mục đích**: Tạo danh sách "sạch" để chuẩn bị tải báo cáo tài chính (tránh tải rác làm nặng server).

#### **Bước 3: Tải Dữ Liệu Tài Chính (Core Logic)**
*   **Hành động**: Dựa trên `stock_list.json`, hệ thống đi tải dữ liệu chi tiết (Giá, PE, PB, Doanh thu, Lợi nhuận...) cho từng mã.
*   **Đầu ra**: Cập nhật hơn 700 file trong thư mục `stocks/*.json`.
*   **Mục đích**: Đây là dữ liệu gốc dùng để hiển thị biểu đồ và bảng phân tích trên Web.

#### **Bước 4: Tính Toán Chỉ Số Ngành (`update_peers.py`)**
*   **Hành động**: Đọc toàn bộ dữ liệu vừa tải ở Bước 3, tính toán P/E và P/B trung vị (Median) cho từng ngành.
*   **Đầu ra**: File `sector_peers.json`.
*   **Mục đích**: Phục vụ tính năng định giá so sánh (Valuation Models).

=> **Kết quả**: Sau khoảng 20-30 phút, toàn bộ dữ liệu trên VPS đã tươi mới hoàn toàn.

---

## 3. Quy Trình Cập Nhật Lên Website (Manual Sync)

Vì Website Frontend chạy trên Vercel (để tiết kiệm băng thông VPS), nó KHÔNG tự động nhận dữ liệu mới từ VPS. Bạn cần thực hiện quy trình "Cầu Nối" thủ công sau khi VPS chạy xong (ví dụ: sáng ngày 2 hoặc 16).

### 🛠 Cách Thực Hiện (Trên máy Local):

**Bước 1: Tải dữ liệu từ VPS về máy (`pull_data.ps1`)**
Chạy script này để đồng bộ hóa dữ liệu. Nó sẽ:
1.  Tải danh sách mã `ticker_data.json` mới nhất.
2.  Tải `stock_list.json`.
3.  Tải toàn bộ folder `stocks/` data.
-> Lúc này máy Local của bạn đã có dữ liệu y hệt VPS.

**Bước 2: Đẩy lên Web (`deploy.ps1`)**
Script này sẽ:
1.  Upload code và các file dữ liệu (vừa tải ở Bước 1) lên GitHub.
2.  **Vercel** sẽ tự động phát hiện thay đổi trên GitHub và Build lại trang web.
3.  Sau khoảng 2-3 phút, người dùng truy cập web sẽ thấy dữ liệu mới.

---

## 4. Bảng Tóm Tắt File Script

| Tên File | Vị Trí | Chạy Tự Động? | Chức Năng |
| :--- | :--- | :--- | :--- |
| `automation/update_json_data.py` | VPS | ✅ (Ngày 1, 15) | **Tổng Chỉ Huy**. Điều phối cả quy trình. |
| `automation/update_tickers.py` | VPS | (Được gọi) | Tạo data cho Search Bar. |
| `automation/generate_stock_list.py` | VPS | (Được gọi) | Tạo danh sách mã cần tải data. |
| `automation/update_peers.py` | VPS | (Được gọi) | Tính toán chỉ số ngành. |
| `automation/pull_data.ps1` | **Local** | ❌ (Chạy tay) | Kéo data từ VPS về Local. |
| `automation/deploy.ps1` | **Local** | ❌ (Chạy tay) | Đẩy data từ Local lên GitHub/Vercel. |

---

## 5. Lưu Ý Quan Trọng

*   **File `frontend/ticker_data.json`**: Đây là file quan trọng nhất cho trải nghiệm tìm kiếm. VPS tạo ra nó, nhưng bạn phải Pull về và Deploy lên thì người dùng mới thấy mã mới.
*   **Đừng sửa tay data**: Hạn chế sửa tay các file JSON trong thư mục `stocks/` ở Local, vì ở lần chạy `pull_data` tiếp theo, chúng sẽ bị ghi đè bởi dữ liệu gốc từ VPS.
