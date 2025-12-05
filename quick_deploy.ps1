param(
    [string]$CommitMessage = "Quick deploy update"
)

$SSHKey = "$HOME\Desktop\key.pem"
$VPSHost = "root@203.55.176.10"
$VPSPath = "~/apps/ec2"

# 1. GitHub Deployment
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   1. GITHUB DEPLOYMENT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "Changes detected. Committing and pushing..." -ForegroundColor Yellow
    git add .
    git commit -m $CommitMessage
    git push origin master
    if ($?) {
        Write-Host "Successfully pushed to GitHub." -ForegroundColor Green
    }
    else {
        Write-Host "Failed to push to GitHub." -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "No changes to commit." -ForegroundColor Yellow
}

# 2. VPS Deployment
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   2. VPS DEPLOYMENT ($VPSHost)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if key exists
if (-not (Test-Path $SSHKey)) {
    Write-Host "Error: SSH Key not found at $SSHKey" -ForegroundColor Red
    exit 1
}

Write-Host "Syncing backend..."
scp -i $SSHKey -r backend "${VPSHost}:${VPSPath}/"
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to sync backend" -ForegroundColor Red; exit 1 }

Write-Host "Syncing frontend..."
scp -i $SSHKey -r frontend "${VPSHost}:${VPSPath}/"
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to sync frontend" -ForegroundColor Red; exit 1 }

Write-Host "Syncing package.json..."
scp -i $SSHKey package.json "${VPSHost}:${VPSPath}/package.json"
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to sync package.json" -ForegroundColor Red; exit 1 }

# Restart Service
Write-Host "Restarting service..."
ssh -i $SSHKey $VPSHost "systemctl restart gunicorn-ec2"
if ($LASTEXITCODE -eq 0) {
    Write-Host "Service restarted successfully." -ForegroundColor Green
}
else {
    Write-Host "Failed to restart service." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Active Status:" -ForegroundColor Yellow
ssh -i $SSHKey $VPSHost "systemctl is-active gunicorn-ec2"

Write-Host ""
Write-Host "Done! Application Deployed." -ForegroundColor Green
