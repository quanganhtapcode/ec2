# Full Deployment Script (WITH stock_data folder - 694 JSON files)
# Use this ONLY when stock data needs to be updated (slower)
# For daily code updates, use deploy-quick.ps1 instead
# Author: quanganhdeptrai
# Date: 2025-11-19

param(
    [string]$CommitMessage = "Auto update: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

# Configuration
$ProjectPath = "C:\Users\PC\Downloads\Valuation"
$SSHKey = "~/Desktop/key.pem"
$VPSHost = "root@203.55.176.10"
$VPSPath = "~/apps/ec2"
$GitRemote = "https://github.com/quanganhtapcode/ec2.git"

$FilesToDeploy = @(
    "valuation_models.py",
    "backend_server.py",
    "app.js",
    "index.html",
    "style.css",
    "translations.js",
    "requirements.txt",
    "Procfile",
    "package.json"
)

$FoldersToSync = @(
    "stock_data"
)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   FULL DEPLOYMENT (Code + Stock Data)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Deployment Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
Write-Host "Commit Message: $CommitMessage" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path $ProjectPath)) {
    Write-Host "ERROR: Project path not found: $ProjectPath" -ForegroundColor Red
    exit 1
}

Set-Location $ProjectPath

# STEP 1: DEPLOY TO VPS
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "STEP 1: DEPLOYING TO VPS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Uploading files to VPS..." -ForegroundColor Yellow
foreach ($file in $FilesToDeploy) {
    $filePath = Join-Path $ProjectPath $file
    if (Test-Path $filePath) {
        Write-Host "  -> Uploading $file..." -NoNewline
        scp -i $SSHKey $filePath "${VPSHost}:${VPSPath}/$file" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host " OK" -ForegroundColor Green
        } else {
            Write-Host " FAILED" -ForegroundColor Red
        }
    } else {
        Write-Host "  -> File not found: $file" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Syncing folders to VPS..." -ForegroundColor Yellow
foreach ($folder in $FoldersToSync) {
    $folderPath = Join-Path $ProjectPath $folder
    if (Test-Path $folderPath) {
        Write-Host "  -> Syncing $folder/..." -NoNewline
        scp -i $SSHKey -r $folderPath "${VPSHost}:${VPSPath}/" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host " OK" -ForegroundColor Green
        } else {
            Write-Host " FAILED" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "Restarting Gunicorn service..." -NoNewline
ssh -i $SSHKey $VPSHost "cd $VPSPath; sudo systemctl restart gunicorn-ec2.service" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
}

Write-Host "Checking service status..." -NoNewline
$serviceStatus = ssh -i $SSHKey $VPSHost "sudo systemctl is-active gunicorn-ec2.service" 2>$null
if ($serviceStatus -eq "active") {
    Write-Host " ACTIVE" -ForegroundColor Green
} else {
    Write-Host " INACTIVE" -ForegroundColor Red
    Write-Host "  Check logs: journalctl -u gunicorn-ec2.service -n 50" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "VPS deployment completed!" -ForegroundColor Green
Write-Host "API URL: https://api.quanganh.org" -ForegroundColor Cyan

# STEP 2: DEPLOY TO GITHUB/VERCEL
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "STEP 2: DEPLOYING TO GITHUB/VERCEL" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$gitInstalled = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitInstalled) {
    Write-Host "ERROR: Git not installed" -ForegroundColor Red
    Write-Host "Download Git at: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path (Join-Path $ProjectPath ".git"))) {
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    git init
    git remote add origin $GitRemote
    Write-Host "Git initialized" -ForegroundColor Green
}

Write-Host ""
Write-Host "Git status..." -ForegroundColor Yellow
git status --short

Write-Host ""
Write-Host "Git add..." -NoNewline
git add .
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "Git commit..." -NoNewline
git commit -m $CommitMessage 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} elseif ($LASTEXITCODE -eq 1) {
    Write-Host " Nothing to commit" -ForegroundColor Yellow
} else {
    Write-Host " FAILED" -ForegroundColor Red
}

Write-Host "Git push..." -NoNewline
git push origin master 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
} else {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "  Check Git credentials or run manually: git push origin master" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "GitHub deployment completed!" -ForegroundColor Green
Write-Host "GitHub Repo: https://github.com/quanganhtapcode/ec2" -ForegroundColor Cyan
Write-Host "Vercel URL: https://valuation.quanganh.org" -ForegroundColor Cyan
Write-Host "Vercel will auto-deploy in ~1-2 minutes" -ForegroundColor Yellow

# SUMMARY
Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "   FULL DEPLOYMENT COMPLETED!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  - All code files deployed to VPS" -ForegroundColor Green
Write-Host "  - Stock data folder synced (694 files)" -ForegroundColor Green
Write-Host "  - Service restarted" -ForegroundColor Green
Write-Host "  - GitHub updated: '$CommitMessage'" -ForegroundColor Green
Write-Host "  - Vercel auto-deployment triggered" -ForegroundColor Green
Write-Host ""
Write-Host "NOTE: This was a FULL deployment (slower)" -ForegroundColor Yellow
Write-Host "Use deploy-quick.ps1 for faster code-only updates" -ForegroundColor Yellow
Write-Host ""

Set-Location $ProjectPath
