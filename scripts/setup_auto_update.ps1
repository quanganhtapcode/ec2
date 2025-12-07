# Script to SETUP Auto-Update Timer on VPS
# Author: quanganhdeptrai
# Date: 2025-12-07

$ErrorActionPreference = "Stop"
$SSHKey = "$HOME\Desktop\key.pem"
$VPSHost = "root@203.55.176.10"
$RemotePath = "/root/apps/ec2"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   SETUP AUTO-UPDATE TIMER (SYSTEMD)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 0. Upload các file cần thiết (Script + Stock List)
Write-Host "Uploading necessary files..." -ForegroundColor Yellow

# Tạo thư mục scripts trên VPS nếu chưa có
ssh -i $SSHKey $VPSHost "mkdir -p $RemotePath/scripts"

# Upload file update script
Write-Host "  -> Uploading scripts/update_json_data.py..." -NoNewline
scp -i $SSHKey "scripts/update_json_data.py" "${VPSHost}:${RemotePath}/scripts/"
if ($LASTEXITCODE -eq 0) { Write-Host " OK" -ForegroundColor Green } else { Write-Host " FAILED" -ForegroundColor Red; exit }

# Upload stock_list.json (Cần thiết để biết tải mã nào)
if (Test-Path "stock_list.json") {
    Write-Host "  -> Uploading stock_list.json..." -NoNewline
    scp -i $SSHKey "stock_list.json" "${VPSHost}:${RemotePath}/"
    if ($LASTEXITCODE -eq 0) { Write-Host " OK" -ForegroundColor Green } else { Write-Host " FAILED" -ForegroundColor Red }
}
else {
    Write-Host "  Warning: stock_list.json not found locally. Ensure it exists on VPS!" -ForegroundColor Yellow
}

Write-Host ""

# 1. Định nghĩa nội dung Service file (Nó làm gì?)
# Chạy script Python update_json_data.py
$serviceContent = @'
[Unit]
Description=Valuation Stock Data Updater Service
After=network.target

[Service]
Type=oneshot
User=root
WorkingDirectory=/root/apps/ec2
# Sử dụng python trong venv
ExecStart=/root/apps/ec2/venv/bin/python scripts/update_json_data.py
# Log output vào journal
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
'@

# 2. Định nghĩa nội dung Timer file (Khi nào chạy?)
# Chạy vào ngày 1 và 15 hàng tháng lúc 02:00 sáng
$timerContent = @'
[Unit]
Description=Run Stock Updater Bi-Monthly (1st and 15th)

[Timer]
# Vào ngày 1 và 15 của mỗi tháng, lúc 02:00:00
OnCalendar=*-*-01,15 02:00:00
Persistent=true
Unit=val-updater.service

[Install]
WantedBy=timers.target
'@

# Tạo file tạm trên local
$files = @{
    "val-updater.service" = $serviceContent
    "val-updater.timer"   = $timerContent
}

foreach ($name in $files.Keys) {
    $tempPath = Join-Path $env:TEMP $name
    $files[$name] | Out-File -FilePath $tempPath -Encoding UTF8 -NoNewline
    
    Write-Host "Uploading configuration $name to VPS..." -NoNewline
    scp -i $SSHKey $tempPath "${VPSHost}:/tmp/$name" 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
        
        # Di chuyển vào thư mục systemd
        ssh -i $SSHKey $VPSHost "mv /tmp/$name /etc/systemd/system/$name"
        Remove-Item $tempPath -Force
    }
    else {
        Write-Host " FAILED" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Configuring Systemd..." -ForegroundColor Yellow

# Enable và Start Timer
$cmds = @(
    "systemctl daemon-reload",
    "systemctl enable val-updater.timer",
    "systemctl start val-updater.timer",
    "systemctl status val-updater.timer --no-pager"
)

foreach ($cmd in $cmds) {
    Write-Host "  Exec: $cmd" -ForegroundColor Gray
    ssh -i $SSHKey $VPSHost "$cmd"
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "   SETUP COMPLETED!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Script update sẽ tự chạy vào ngày 1 và 15 lúc 2h sáng." -ForegroundColor White
Write-Host "Để chạy thử ngay lập tức (test), dùng lệnh trên VPS:" -ForegroundColor Gray
Write-Host "systemctl start val-updater.service" -ForegroundColor White
