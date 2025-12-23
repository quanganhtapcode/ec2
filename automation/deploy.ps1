# Deploy Script - Run from PROJECT ROOT (c:\Users\PC\Downloads\Valuation)
# Usage: .\automation\deploy.ps1 [-CommitMessage "your message"]

param(
    [string]$CommitMessage = "Quick deploy update"
)

# Configuration
$SSHKey = "$HOME\Downloads\key.pem"
$VPSHost = "root@10.66.66.1"
$VPSPath = "/root/apps/ec2"

# Get project root (parent of automation folder if running from there)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Change to project root
Push-Location $ProjectRoot
Write-Host "Working directory: $ProjectRoot" -ForegroundColor Gray

try {
    # ========================================
    # 1. GITHUB DEPLOYMENT (Frontend + All code)
    # ========================================
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   1. GITHUB DEPLOYMENT" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    # Check for changes
    $gitStatus = git status --porcelain 2>&1
    if ($gitStatus) {
        Write-Host "Changes detected:" -ForegroundColor Yellow
        git status --short
        Write-Host ""
        
        # Add all tracked and new files (respecting .gitignore)
        git add .
        
        $staged = git diff --cached --name-only
        if ($staged) {
            Write-Host "Staged files:" -ForegroundColor Green
            Write-Host $staged
            
            git commit -m $CommitMessage
            git push origin master
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[OK] Successfully pushed to GitHub." -ForegroundColor Green
            }
            else {
                Write-Host "[FAIL] Failed to push to GitHub." -ForegroundColor Red
                exit 1
            }
        }
        else {
            Write-Host "No staged changes to commit." -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "No changes to commit." -ForegroundColor Yellow
    }

    # ========================================
    # 2. VPS DEPLOYMENT (Backend + Frontend)
    # ========================================
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   2. VPS DEPLOYMENT ($VPSHost)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    # Check if SSH key exists
    if (-not (Test-Path $SSHKey)) {
        Write-Host "[FAIL] SSH Key not found at $SSHKey" -ForegroundColor Red
        exit 1
    }

    # Sync backend
    Write-Host "Syncing backend..." -ForegroundColor Yellow
    scp -i $SSHKey -r backend "${VPSHost}:${VPSPath}/"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] Failed to sync backend" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Backend synced" -ForegroundColor Green

    # Sync frontend (exclude ticker_data.json which is VPS source of truth)
    Write-Host "Syncing frontend..." -ForegroundColor Yellow
    
    # Create temp directory and copy frontend
    $TempDeploy = Join-Path $env:TEMP "ValuationDeploy_$(Get-Random)"
    New-Item -ItemType Directory -Force -Path $TempDeploy | Out-Null
    
    Copy-Item -Path "frontend" -Destination $TempDeploy -Recurse
    
    # Remove ticker_data.json from temp (preserve VPS version)
    $tickerFile = Join-Path $TempDeploy "frontend\ticker_data.json"
    if (Test-Path $tickerFile) {
        Remove-Item $tickerFile -Force
    }
    
    # Upload from temp
    scp -i $SSHKey -r "$TempDeploy\frontend" "${VPSHost}:${VPSPath}/"
    $scpResult = $LASTEXITCODE
    
    # Clean up temp
    Remove-Item $TempDeploy -Recurse -Force -ErrorAction SilentlyContinue
    
    if ($scpResult -ne 0) {
        Write-Host "[FAIL] Failed to sync frontend" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Frontend synced" -ForegroundColor Green

    # Sync automation (update_json_data.py, etc.)
    Write-Host "Syncing automation..." -ForegroundColor Yellow
    scp -i $SSHKey -r automation "${VPSHost}:${VPSPath}/"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] Failed to sync automation" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Automation synced" -ForegroundColor Green

    # Sync other files
    Write-Host "Syncing config files..." -ForegroundColor Yellow
    scp -i $SSHKey package.json "${VPSHost}:${VPSPath}/" 2>$null
    scp -i $SSHKey sector_peers.json "${VPSHost}:${VPSPath}/" 2>$null
    Write-Host "[OK] Config files synced" -ForegroundColor Green

    # ========================================
    # 3. RESTART SERVICE
    # ========================================
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   3. RESTART SERVICE" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    Write-Host "Restarting gunicorn-ec2..." -ForegroundColor Yellow
    ssh -i $SSHKey $VPSHost "systemctl restart gunicorn-ec2"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Service restarted successfully" -ForegroundColor Green
    }
    else {
        Write-Host "[FAIL] Failed to restart service" -ForegroundColor Red
        exit 1
    }

    # Check service status
    Write-Host ""
    Write-Host "Service Status:" -ForegroundColor Yellow
    $status = ssh -i $SSHKey $VPSHost "systemctl is-active gunicorn-ec2"
    if ($status -eq "active") {
        Write-Host "  gunicorn-ec2: $status [OK]" -ForegroundColor Green
    }
    else {
        Write-Host "  gunicorn-ec2: $status [FAIL]" -ForegroundColor Red
    }

    # ========================================
    # DONE
    # ========================================
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   DEPLOYMENT COMPLETE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "GitHub:  https://github.com/quanganhtapcode/ec2" -ForegroundColor Gray
    Write-Host "Website: https://valuation.quanganh.org" -ForegroundColor Gray
    Write-Host ""

}
finally {
    # Return to original directory
    Pop-Location
}
