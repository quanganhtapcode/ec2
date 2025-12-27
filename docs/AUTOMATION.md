# Tài Liệu Vận Hành Hệ Thống Tự Động (Automation Guide)

Tài liệu này giải thích chi tiết cách hệ thống tự động cập nhật dữ liệu chứng khoán, cách đồng bộ dữ liệu giữa VPS và Máy Local, và quy trình deploy lên Web.

---

## 1. Tổng Quan Kiến Trúc

Hệ thống hoạt động dựa trên nguyên tắc: **"VPS là máy sản xuất dữ liệu - Local là nơi phân phối"**.

*   **VPS (Máy chủ)**: Chịu trách nhiệm chạy các tác vụ nặng (tải data, tính toán chỉ số) theo lịch định kỳ.
*   **Local (Máy tính cá nhân)**: Tải dữ liệu thành phẩm từ VPS về, sau đó đẩy lên GitHub/Vercel để cập nhật cho người dùng Web.

---

## 2. Services Trên VPS

### 📦 Danh sách Services
| Service | Mục đích | Timer |
| :--- | :--- | :--- |
| `gunicorn-ec2.service` | Web server cho API backend | Always running |
| `val-updater.service` | Cập nhật dữ liệu JSON cho stocks | Ngày 1, 15 lúc 2:00 AM |

### 🔧 val-updater Service

**Vị trí file service:**
```
/etc/systemd/system/val-updater.service
/etc/systemd/system/val-updater.timer
```

**Nội dung val-updater.service:**
```ini
[Unit]
Description=Valuation Stock Data Updater Service
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/root/apps/ec2
ExecStart=/root/apps/ec2/.venv/bin/python automation/update_json_data.py
User=root
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

**Nội dung val-updater.timer:**
```ini
[Unit]
Description=Run val-updater on 1st and 15th of each month

[Timer]
OnCalendar=*-*-01 02:00:00
OnCalendar=*-*-15 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

**Các lệnh quản lý:**
```bash
# Xem trạng thái
systemctl status val-updater.service
systemctl status val-updater.timer

# Chạy thủ công (nếu cần)
systemctl start val-updater.service

# Xem log
journalctl -u val-updater.service -n 100 -f

# Restart timer
systemctl restart val-updater.timer
```

---

## 3. Quy Trình Tự Động Trên VPS (The Automation Pipeline)

### 🕒 Lịch chạy:
*   **Thời gian**: 02:00 sáng.
*   **Ngày chạy**: Ngày **01** và ngày **15** hàng tháng.
*   **Cơ chế**: Systemd Timer (`val-updater.timer`) kích hoạt script chủ.

### 🔗 Dây Chuyền Xử Lý (Chain of Command)
Khi đến giờ hẹn, script `automation/update_json_data.py` sẽ được kích hoạt và tự động điều phối các bước liên tiếp:

#### **Bước 1: Cập Nhật Danh Sách Hiển Thị (`update_tickers.py`)**
*   **Hành động**: Quét toàn bộ thị trường (HOSE, HNX, UPCOM).
*   **Đầu ra**: File `frontend/ticker_data.json`.
*   **Mục đích**: Cung cấp danh sách mã đầy đủ nhất (1500+ mã) cho thanh Tìm Kiếm trên Website.

#### **Bước 2: Lọc Danh Sách Cổ Phiếu (`generate_stock_list.py`)**
*   **Hành động**: Từ dữ liệu thị trường, lọc bỏ các mã rác, chứng quyền, ETF.
*   **Đầu ra**: File `stock_list.json` (Khoảng 700+ mã).
*   **Mục đích**: Tạo danh sách "sạch" để tải báo cáo tài chính.

#### **Bước 3: Tải Dữ Liệu Tài Chính (Core Logic - `update_json_data.py`)**
*   **Hành động**: Dựa trên `stock_list.json`, tải dữ liệu chi tiết cho từng mã.
*   **API Calls (6 calls/mã)**:
  1. `listing.symbols_by_exchange()` - Danh sách symbols
  2. `listing.symbols_by_industries()` - Ngành
  3. `company.overview()` - Thông tin công ty
  4. `finance.income_statement()` - BCKQKD
  5. `finance.balance_sheet()` - BCĐKT
  6. `Company.ratio_summary()` - Tất cả chỉ số tài chính (EPS, P/E, P/B, ROE, ROA, margins, liquidity, leverage...)
  7. `trading.price_board()` - Giá hiện tại
*   **Đầu ra**: Cập nhật hơn 700 file trong thư mục `stocks/*.json`.
*   **Rate Limiting**: Tự động phát hiện và chờ khi bị limit.

#### **Bước 4: Tính Toán Chỉ Số Ngành (`update_peers.py`)**
*   **Hành động**: Đọc toàn bộ dữ liệu, tính P/E và P/B trung vị cho từng ngành.
*   **Đầu ra**: File `sector_peers.json`.

=> **Kết quả**: Sau khoảng 20-30 phút, toàn bộ dữ liệu trên VPS đã được cập nhật.

---

## 4. Cấu Trúc JSON Output

### stocks/{SYMBOL}.json
```json
{
  "symbol": "VIC",
  "name": "Tập đoàn Vingroup - Công ty CP",
  "exchange": "HSX",
  "sector": "Bất động sản",
  
  // Per-share metrics (từ ratio_summary)
  "eps_ttm": 1147.27,          // EPS Trailing Twelve Months (quan trọng nhất)
  "bvps": 18908.57,            // Book Value Per Share
  "dividend_per_share": 0,
  
  // Valuation ratios
  "pe_ratio": 129.44,
  "pb_ratio": 7.85,
  "ps_ratio": 4.94,
  "ev_ebitda": 111.15,
  
  // Profitability
  "roe": 6.20,
  "roa": 0.96,
  "roic": -3.08,
  "net_profit_margin": 1.64,
  "gross_profit_margin": -18.63,
  "net_profit_growth": 15.5,   // Tăng trưởng lợi nhuận (NEW)
  
  // Liquidity
  "current_ratio": 1.06,
  "quick_ratio": 0.73,
  "interest_coverage": 1.89,
  
  // Leverage
  "debt_to_equity": 5.72,
  
  // Other
  "current_price": 158800,
  "market_cap": 1144345607064000,
  "shares_outstanding": 7706031024,
  "last_updated": "2025-12-23T01:53:13"
}
```

### Lưu ý quan trọng:
- **`eps_ttm`**: EPS TTM đã điều chỉnh cho stock split (từ `ratio_summary`), KHÔNG PHẢI EPS quý.
- **`bvps`**: Book Value Per Share duy nhất (không còn duplicate `book_value_per_share`).
- **`net_profit_growth`**: Tăng trưởng lợi nhuận (mới thêm từ 23/12/2024).

---

## 5. Quy Trình Cập Nhật Lên Website (Manual Sync)

Vì Website Frontend chạy trên Vercel, bạn cần thực hiện quy trình "Cầu Nối" thủ công sau khi VPS chạy xong.

### 🛠 Cách Thực Hiện (Trên máy Local):

**Bước 1: Tải dữ liệu từ VPS về máy (`pull_data.ps1`)**
```powershell
.\automation\pull_data.ps1
```

**Bước 2: Đẩy lên Web (`deploy.ps1`)**
```powershell
.\automation\deploy.ps1 -CommitMessage "Update stock data"
```

Script `deploy.ps1` sẽ:
1. Git add, commit, push tất cả changes lên GitHub
2. Sync `backend/`, `frontend/`, `automation/` lên VPS
3. Sync `package.json`, `sector_peers.json`
4. Restart `gunicorn-ec2` service

---

## 6. Bảng Tóm Tắt File Script

| Tên File | Vị Trí | Chạy Tự Động? | Chức Năng |
| :--- | :--- | :--- | :--- |
| `automation/update_json_data.py` | VPS | ✅ (Ngày 1, 15) | **Tổng Chỉ Huy**. Điều phối cả quy trình. |
| `automation/update_tickers.py` | VPS | (Được gọi) | Tạo data cho Search Bar. |
| `automation/generate_stock_list.py` | VPS | (Được gọi) | Tạo danh sách mã cần tải data. |
| `automation/update_peers.py` | VPS | (Được gọi) | Tính toán chỉ số ngành. |
| `automation/update_excel_data.py` | **Local** | ❌ (Chạy tay) | Tải Excel từ VietCap → Upload R2. |
| `automation/pull_data.ps1` | **Local** | ❌ (Chạy tay) | Kéo data từ VPS về Local. |
| `automation/deploy.ps1` | **Local** | ❌ (Chạy tay) | Đẩy data từ Local lên GitHub/VPS. |

---

## 7. Troubleshooting

### Xem log val-updater
```bash
ssh root@VPS_IP "journalctl -u val-updater.service -n 50"
```

### Kiểm tra rate limit
Nếu thấy log có `Rate limit! Wait Xs...`, đây là bình thường. Script tự động chờ và retry.

### Chạy lại thủ công
```bash
ssh root@VPS_IP "systemctl restart val-updater.service"
```

### Kiểm tra dữ liệu mới
```bash
ssh root@VPS_IP "cat /root/apps/ec2/stocks/VIC.json | head -20"
```

---

## 8. Lưu Ý Quan Trọng

*   **File `frontend/ticker_data.json`**: Đây là file quan trọng nhất cho trải nghiệm tìm kiếm.
*   **Đừng sửa tay data**: Hạn chế sửa tay các file JSON trong thư mục `stocks/`, vì lần chạy tiếp theo sẽ bị ghi đè.
*   **API Optimization**: Script đã tối ưu từ 9 xuống 6 API calls/mã (giảm 33%) bằng cách dùng `Company.ratio_summary()`.
