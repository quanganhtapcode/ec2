# Script to rename financial statement files from {TICKER}_financial_statement.xlsx to {TICKER}.xlsx
# Author: quanganhdeptrai
# Date: 2024-11-26

$sourceDir = "vietcap_financial_statements"

if (-not (Test-Path $sourceDir)) {
    Write-Host "Error: Directory '$sourceDir' not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Starting file renaming in '$sourceDir'..." -ForegroundColor Cyan
Write-Host ""

$files = Get-ChildItem -Path $sourceDir -Filter "*_financial_statement.xlsx"
$totalFiles = $files.Count
$renamed = 0
$errors = 0

Write-Host "Found $totalFiles files to rename" -ForegroundColor Yellow
Write-Host ""

foreach ($file in $files) {
    try {
        # Extract ticker from filename (e.g., VCB_financial_statement.xlsx -> VCB)
        $ticker = $file.BaseName -replace '_financial_statement$', ''
        $newName = "$ticker.xlsx"
        
        # Rename file
        Rename-Item -Path $file.FullName -NewName $newName -ErrorAction Stop
        $renamed++
        
        # Progress indicator
        if ($renamed % 50 -eq 0) {
            Write-Host "Progress: $renamed / $totalFiles renamed..." -ForegroundColor Green
        }
    }
    catch {
        Write-Host "Error renaming '$($file.Name)': $($_.Exception.Message)" -ForegroundColor Red
        $errors++
    }
}

Write-Host ""
Write-Host "================== SUMMARY ==================" -ForegroundColor Cyan
Write-Host "Total files found:    $totalFiles" -ForegroundColor White
Write-Host "Successfully renamed: $renamed" -ForegroundColor Green
Write-Host "Errors:               $errors" -ForegroundColor $(if ($errors -gt 0) { "Red" } else { "White" })
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

if ($errors -eq 0) {
    Write-Host "All files renamed successfully!" -ForegroundColor Green
} else {
    Write-Host "Completed with $errors errors." -ForegroundColor Yellow
}
