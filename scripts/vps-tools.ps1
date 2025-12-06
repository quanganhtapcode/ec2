# VPS Management Tools
# Combined script for checking logs and fixing VPS service
# Author: quanganhdeptrai
# Date: 2025-12-06

param(
    [ValidateSet('logs', 'fix', 'status', 'restart')]
    [string]$Action = ''
)

# Configuration
$SSHKey = "$HOME\Desktop\key.pem"
$VPSHost = "root@203.55.176.10"
$VPSPath = "~/apps/ec2"

function Show-Menu {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "   VPS MANAGEMENT TOOLS" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  1. Check Status    - Quick service status" -ForegroundColor White
    Write-Host "  2. View Logs       - Full diagnostic logs" -ForegroundColor White
    Write-Host "  3. Restart Service - Restart gunicorn" -ForegroundColor White
    Write-Host "  4. Fix Service     - Full service fix + deploy" -ForegroundColor White
    Write-Host "  5. Exit" -ForegroundColor Gray
    Write-Host ""
}

function Check-Status {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "   QUICK STATUS CHECK" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Service Status:" -ForegroundColor Yellow
    ssh -i $SSHKey $VPSHost "systemctl is-active gunicorn-ec2"
    
    Write-Host ""
    Write-Host "API Test:" -ForegroundColor Yellow
    $result = ssh -i $SSHKey $VPSHost "curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/api/app-data/VCB?period=year"
    if ($result -eq "200") {
        Write-Host "  API: OK (HTTP 200)" -ForegroundColor Green
    }
    else {
        Write-Host "  API: FAILED (HTTP $result)" -ForegroundColor Red
    }
}

function View-Logs {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "   VPS SERVICE DIAGNOSTICS" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "1. Service Status:" -ForegroundColor Yellow
    ssh -i $SSHKey $VPSHost "sudo systemctl status gunicorn-ec2.service --no-pager"
    
    Write-Host ""
    Write-Host "2. Recent Service Logs:" -ForegroundColor Yellow
    ssh -i $SSHKey $VPSHost "sudo journalctl -u gunicorn-ec2.service -n 30 --no-pager"
    
    Write-Host ""
    Write-Host "3. Running Processes:" -ForegroundColor Yellow
    ssh -i $SSHKey $VPSHost "ps aux | grep gunicorn | grep -v grep"
    
    Write-Host ""
    Write-Host "4. Port Check (5000):" -ForegroundColor Yellow
    ssh -i $SSHKey $VPSHost "sudo netstat -tulpn | grep 5000 || sudo ss -tulpn | grep 5000"
    
    Write-Host ""
    Write-Host "5. Gunicorn Error Log:" -ForegroundColor Yellow
    ssh -i $SSHKey $VPSHost "sudo tail -n 30 /var/log/gunicorn-error.log"
    
    Write-Host ""
    Write-Host "6. Nginx Error Log:" -ForegroundColor Yellow
    ssh -i $SSHKey $VPSHost "sudo tail -n 20 /var/log/nginx/error.log"
}

function Restart-Service {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "   RESTART SERVICE" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Restarting gunicorn-ec2..." -NoNewline
    ssh -i $SSHKey $VPSHost "systemctl restart gunicorn-ec2"
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    }
    else {
        Write-Host " FAILED" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 2
    Check-Status
}

function Fix-Service {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "   FIX VPS GUNICORN SERVICE" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Step 1: Deploy current code
    Write-Host "Step 1: Deploying current code..." -ForegroundColor Yellow
    
    Write-Host "  Syncing backend..." -NoNewline
    scp -i $SSHKey -r backend "${VPSHost}:${VPSPath}/" 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host " OK" -ForegroundColor Green } 
    else { Write-Host " FAILED" -ForegroundColor Red; return }
    
    Write-Host "  Syncing frontend..." -NoNewline
    scp -i $SSHKey -r frontend "${VPSHost}:${VPSPath}/" 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host " OK" -ForegroundColor Green }
    else { Write-Host " FAILED" -ForegroundColor Red }
    
    Write-Host ""
    
    # Step 2: Update systemd service
    Write-Host "Step 2: Updating service..." -ForegroundColor Yellow
    
    $serviceFileContent = @'
[Unit]
Description=Gunicorn instance to serve EC2 Flask app
After=network.target

[Service]
User=root
Group=root
WorkingDirectory=/root/apps/ec2
Environment="PATH=/root/apps/ec2/.venv/bin"
Environment="PYTHONPATH=/root/apps/ec2"
ExecStart=/root/apps/ec2/.venv/bin/gunicorn --workers 4 --bind 0.0.0.0:8000 --timeout 120 --access-logfile /var/log/gunicorn-access.log --error-logfile /var/log/gunicorn-error.log backend.server:app

[Install]
WantedBy=multi-user.target
'@
    
    $tempFile = Join-Path $env:TEMP "gunicorn-ec2.service"
    $serviceFileContent | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
    
    Write-Host "  Uploading service file..." -NoNewline
    scp -i $SSHKey $tempFile "${VPSHost}:/tmp/gunicorn-ec2.service" 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host " OK" -ForegroundColor Green }
    else { Write-Host " FAILED" -ForegroundColor Red; Remove-Item $tempFile -Force; return }
    
    Remove-Item $tempFile -Force
    
    Write-Host "  Installing service..." -NoNewline
    ssh -i $SSHKey $VPSHost "sudo mv /tmp/gunicorn-ec2.service /etc/systemd/system/gunicorn-ec2.service" 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host " OK" -ForegroundColor Green }
    else { Write-Host " FAILED" -ForegroundColor Red; return }
    
    Write-Host "  Reloading daemon..." -NoNewline
    ssh -i $SSHKey $VPSHost "sudo systemctl daemon-reload" 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host " OK" -ForegroundColor Green }
    else { Write-Host " FAILED" -ForegroundColor Red; return }
    
    Write-Host ""
    
    # Step 3: Restart service
    Write-Host "Step 3: Restarting service..." -ForegroundColor Yellow
    ssh -i $SSHKey $VPSHost "sudo systemctl restart gunicorn-ec2.service" 2>$null
    
    Start-Sleep -Seconds 2
    
    # Step 4: Verify
    Write-Host ""
    Write-Host "Step 4: Verifying..." -ForegroundColor Yellow
    Check-Status
    
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "   FIX COMPLETED!" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
}

# Main
if (-not (Test-Path $SSHKey)) {
    Write-Host "Error: SSH Key not found at $SSHKey" -ForegroundColor Red
    exit 1
}

# Handle command-line arguments
if ($Action) {
    switch ($Action) {
        'status' { Check-Status }
        'logs' { View-Logs }
        'restart' { Restart-Service }
        'fix' { Fix-Service }
    }
    exit 0
}

# Interactive menu
while ($true) {
    Show-Menu
    $choice = Read-Host "Choose an option (1-5)"
    
    switch ($choice) {
        '1' { Check-Status }
        '2' { View-Logs }
        '3' { Restart-Service }
        '4' { Fix-Service }
        '5' { Write-Host "Goodbye!" -ForegroundColor Cyan; exit 0 }
        default { Write-Host "Invalid choice" -ForegroundColor Red }
    }
    
    Write-Host ""
    Read-Host "Press Enter to continue..."
}
