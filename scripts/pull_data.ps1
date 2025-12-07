# Script to PULL data from VPS to Local
# Author: quanganhdeptrai
# Date: 2025-12-07

$ErrorActionPreference = "Stop"
$SSHKey = "$HOME\Desktop\key.pem"
$VPSHost = "root@203.55.176.10"
$RemotePath = "/root/apps/ec2/stocks"
$LocalPath = "$PSScriptRoot\..\stocks" # Thư mục stocks ở local

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   PULL DATA FROM VPS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Syncing JSON files from VPS to Local machine..." -ForegroundColor Yellow
Write-Host "From: $VPSHost:$RemotePath"
Write-Host "To:   $LocalPath"
Write-Host ""

# Tạo thư mục local nếu chưa có
if (-not (Test-Path $LocalPath)) {
    New-Item -ItemType Directory -Path $LocalPath | Out-Null
}

# Dùng SCP để tải về (Recurse)
scp -i $SSHKey -r "${VPSHost}:${RemotePath}/*" "$LocalPath/"

if ($LASTEXITCODE -eq 0) {
    $count = (Get-ChildItem $LocalPath *.json).Count
    Write-Host ""
    Write-Host "SUCCESS! Synced $count files." -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "FAILED to sync data." -ForegroundColor Red
}

Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host
