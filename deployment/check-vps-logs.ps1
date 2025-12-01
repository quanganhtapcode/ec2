# Check VPS Service Logs and Status
# Quick diagnostic script for troubleshooting
# Author: quanganhdeptrai

$SSHKey = "~/Desktop/key.pem"
$VPSHost = "root@203.55.176.10"

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
Write-Host "5. Test Local Connection:" -ForegroundColor Yellow
ssh -i $SSHKey $VPSHost "curl -v http://localhost:5000/api/app-data/VCB?period=year 2>&1 | head -n 20"

Write-Host ""
Write-Host "6. Gunicorn Error Log:" -ForegroundColor Yellow
ssh -i $SSHKey $VPSHost "sudo tail -n 30 /var/log/gunicorn-error.log"

Write-Host ""
Write-Host "7. Nginx Error Log:" -ForegroundColor Yellow
ssh -i $SSHKey $VPSHost "sudo tail -n 20 /var/log/nginx/error.log"
