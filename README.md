# 🇻🇳 Vietnam Stock Valuation Tool

Ứng dụng định giá cổ phiếu Việt Nam - tự động tính toán giá trị nội tại dựa trên các phương pháp FCFE, FCFF, P/E, P/B.

🌐 **Website:** [valuation.quanganh.org](https://valuation.quanganh.org)

---

## 🚀 Tính năng chính

| Tính năng | Mô tả |
|-----------|-------|
| **Định giá tự động** | Nhập mã cổ phiếu → Tính giá trị thực (FCFE, FCFF, P/E, P/B) |
| **Dữ liệu Real-time** | Kết nối vnstock API, giá cập nhật liên tục |
| **Sector Comparable** | So sánh P/E, P/B với top 10 công ty cùng ngành |
| **Biểu đồ TradingView** | Xem biến động giá, volume, chỉ báo kỹ thuật |
| **Export Excel** | Tải báo cáo định giá chi tiết |
| **Khuyến nghị** | Mua/Bán/Giữ dựa trên margin of safety 15% |

---

## � Cấu trúc Project

```
Valuation/
├── frontend/           # Giao diện web (HTML/CSS/JS)
├── backend/            # API Flask + Valuation Models
│   ├── server.py       # Main API server
│   ├── models.py       # FCFE, FCFF, P/E, P/B calculations
│   └── r2_client.py    # Cloudflare R2 storage client
├── automation/         # Scripts tự động hóa
│   ├── deploy.ps1      # Deploy code lên GitHub + VPS
│   ├── update_excel_data.py    # Cập nhật Excel → R2
│   ├── update_json_data.py     # Cập nhật stock JSON data
│   └── update_peers.py         # Cập nhật sector peers
├── data/               # Excel files (local backup)
├── stocks/             # Stock JSON data
├── docs/               # Tài liệu hướng dẫn
├── .env                # R2 credentials (gitignored)
├── requirements.txt    # Python dependencies
└── stock_list.json     # Danh sách mã cổ phiếu
```

---

## 🛠️ Cài đặt Local

### 1. Clone & Setup
```bash
git clone https://github.com/quanganhtapcode/ec2.git
cd ec2

# Tạo virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
source venv/bin/activate     # Linux/Mac

# Cài đặt dependencies
pip install -r requirements.txt
```

### 2. Chạy Backend
```bash
python backend/server.py
```
Server chạy tại: `http://localhost:5000`

### 3. Chạy Frontend
Mở `frontend/index.html` bằng browser hoặc dùng Live Server (VS Code).

---

## ☁️ Cloud Storage (Cloudflare R2)

Excel files được lưu trên **Cloudflare R2** thay vì VPS để:
- ✅ Giảm tải VPS
- ✅ Tốc độ download nhanh hơn (CDN)
- ✅ Tiết kiệm dung lượng VPS

Chi tiết: [docs/STORAGE.md](docs/STORAGE.md)

---

## 📚 Tài liệu

| Tài liệu | Nội dung |
|----------|----------|
| [docs/DEPLOY.md](docs/DEPLOY.md) | Hướng dẫn deploy code lên VPS |
| [docs/STORAGE.md](docs/STORAGE.md) | Cấu hình Cloudflare R2 storage |
| [docs/AUTOMATION.md](docs/AUTOMATION.md) | Scripts tự động hóa |

---

## 🔧 Dành cho Admin

### Deploy code mới
```powershell
.\automation\deploy.ps1 -CommitMessage "Mô tả thay đổi"
```

### Cập nhật dữ liệu
```powershell
# Cập nhật Excel (upload lên R2)
python automation/update_excel_data.py

# Cập nhật JSON data
python automation/update_json_data.py

# Cập nhật sector peers
python automation/update_peers.py
```

---

## � License

MIT License - © 2025 Quang Anh
