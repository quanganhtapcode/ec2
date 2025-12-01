# Fix VPS Gunicorn Service
# This script will update the systemd service file and restart the service
# Author: quanganhdeptrai
# Date: 2025-12-01

param(
    [string]$CommitMessage = "Fix VPS service configuration"
)

# Configuration
$ProjectPath = "C:\Users\PC\Downloads\Valuation"
$SSHKey = "~/Desktop/key.pem"
$VPSHost = "root@203.55.176.10"
$VPSPath = "~/apps/ec2"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   FIX VPS GUNICORN SERVICE" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $ProjectPath)) {
    Write-Host "ERROR: Project path not found: $ProjectPath" -ForegroundColor Red
    exit 1
}

Set-Location $ProjectPath

# Step 1: Deploy current code
Write-Host "Step 1: Deploying current code..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Syncing backend folder..." -NoNewline
scp -i $SSHKey -r backend "${VPSHost}:${VPSPath}/" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "Syncing frontend folder..." -NoNewline
scp -i $SSHKey -r frontend "${VPSHost}:${VPSPath}/" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
}

Write-Host "Uploading package.json..." -NoNewline
scp -i $SSHKey package.json "${VPSHost}:${VPSPath}/package.json" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
}

Write-Host ""

# Step 2: Update systemd service file
Write-Host "Step 2: Updating systemd service file..." -ForegroundColor Yellow
Write-Host ""

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

# Create temporary file locally
$tempFile = Join-Path $env:TEMP "gunicorn-ec2.service"
$serviceFileContent | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

Write-Host "Uploading service file..." -NoNewline
scp -i $SSHKey $tempFile "${VPSHost}:/tmp/gunicorn-ec2.service" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
    Remove-Item $tempFile -Force
    exit 1
}

Remove-Item $tempFile -Force

# Step 3: Install service file and restart
Write-Host "Installing service file..." -NoNewline
ssh -i $SSHKey $VPSHost "sudo mv /tmp/gunicorn-ec2.service /etc/systemd/system/gunicorn-ec2.service" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "Reloading systemd daemon..." -NoNewline
ssh -i $SSHKey $VPSHost "sudo systemctl daemon-reload" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "Enabling service..." -NoNewline
ssh -i $SSHKey $VPSHost "sudo systemctl enable gunicorn-ec2.service" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " ALREADY ENABLED" -ForegroundColor Yellow
}

Write-Host "Stopping service (if running)..." -NoNewline
ssh -i $SSHKey $VPSHost "sudo systemctl stop gunicorn-ec2.service" 2>$null
Write-Host " OK" -ForegroundColor Green

Write-Host "Starting service..." -NoNewline
ssh -i $SSHKey $VPSHost "sudo systemctl start gunicorn-ec2.service" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Checking service logs:" -ForegroundColor Yellow
    ssh -i $SSHKey $VPSHost "sudo journalctl -u gunicorn-ec2.service -n 50 --no-pager"
    exit 1
}

Write-Host ""

# Step 4: Check service status
Write-Host "Step 3: Checking service status..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Service status..." -NoNewline
$serviceStatus = ssh -i $SSHKey $VPSHost "sudo systemctl is-active gunicorn-ec2.service" 2>$null
if ($serviceStatus -eq "active") {
    Write-Host " ACTIVE" -ForegroundColor Green
} else {
    Write-Host " $serviceStatus" -ForegroundColor Red
    Write-Host ""
    Write-Host "Service logs:" -ForegroundColor Yellow
    ssh -i $SSHKey $VPSHost "sudo journalctl -u gunicorn-ec2.service -n 50 --no-pager"
    exit 1
}

Write-Host ""
Write-Host "Process check..." -ForegroundColor Yellow
ssh -i $SSHKey $VPSHost "ps aux | grep gunicorn | grep -v grep"

Write-Host ""
Write-Host "Testing API endpoint..." -NoNewline
$testResult = ssh -i $SSHKey $VPSHost "curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/api/app-data/VCB?period=year"
if ($testResult -eq "200") {
    Write-Host " OK (HTTP $testResult)" -ForegroundColor Green
} else {
    Write-Host " FAILED (HTTP $testResult)" -ForegroundColor Red
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "   SERVICE FIX COMPLETED!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  - Code deployed to VPS" -ForegroundColor Green
Write-Host "  - Service file updated (backend.server:app)" -ForegroundColor Green
Write-Host "  - Service restarted and active" -ForegroundColor Green
Write-Host ""
Write-Host "API URL: https://api.quanganh.org" -ForegroundColor Cyan
Write-Host "Test: https://api.quanganh.org/api/app-data/VCB?period=year" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Test the web app: https://valuation.quanganh.org" -ForegroundColor White
Write-Host "  2. If issues persist, check nginx logs: sudo tail -f /var/log/nginx/error.log" -ForegroundColor White
Write-Host ""

# Optional: Deploy to GitHub
$deployToGithub = Read-Host "Deploy to GitHub? (y/N)"
if ($deployToGithub -eq "y" -or $deployToGithub -eq "Y") {
    Write-Host ""
    Write-Host "Deploying to GitHub..." -ForegroundColor Yellow
    git add .
    git commit -m $CommitMessage
    git push origin master
    Write-Host "GitHub deployment completed!" -ForegroundColor Green
}

Set-Location $ProjectPath
