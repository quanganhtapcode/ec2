# Build script for production - Minify and optimize assets
# Author: quanganhdeptrai
# Date: 2025-12-02

param(
    [switch]$Deploy
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   BUILD & OPTIMIZE FRONTEND ASSETS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Check if UglifyJS and CleanCSS are installed globally
$hasUglifyJS = Get-Command uglifyjs -ErrorAction SilentlyContinue
$hasCleanCSS = Get-Command cleancss -ErrorAction SilentlyContinue

if (-not $hasUglifyJS -or -not $hasCleanCSS) {
    Write-Host "Installing minification tools..." -ForegroundColor Yellow
    npm install -g uglify-js clean-css-cli
}

# Create build directory
$buildDir = "frontend/build"
if (Test-Path $buildDir) {
    Remove-Item $buildDir -Recurse -Force
}
New-Item -ItemType Directory -Path $buildDir | Out-Null

Write-Host "Minifying JavaScript..." -ForegroundColor Yellow
uglifyjs frontend/app.js `
    --compress `
    --mangle `
    --output $buildDir/app.min.js

Write-Host "Minifying CSS..." -ForegroundColor Yellow
cleancss frontend/style.css -o $buildDir/style.min.css

Write-Host "Minifying translations..." -ForegroundColor Yellow
uglifyjs frontend/translations.js `
    --compress `
    --mangle `
    --output $buildDir/translations.min.js

# Copy HTML and update references
Write-Host "Updating HTML references..." -ForegroundColor Yellow
$html = Get-Content frontend/index.html -Raw
$html = $html -replace 'app\.js\?v=\d+', 'build/app.min.js?v=7'
$html = $html -replace 'style\.css\?v=\d+', 'build/style.min.css?v=7'
$html = $html -replace 'translations\.js\?v=\d+', 'build/translations.min.js?v=7'
$html | Out-File "$buildDir/index.html" -Encoding UTF8 -NoNewline

# Calculate savings
$origJS = (Get-Item frontend/app.js).Length / 1KB
$minJS = (Get-Item $buildDir/app.min.js).Length / 1KB
$origCSS = (Get-Item frontend/style.css).Length / 1KB
$minCSS = (Get-Item $buildDir/style.min.css).Length / 1KB

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "   BUILD COMPLETED!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "File Size Comparison:" -ForegroundColor Cyan
Write-Host "  JavaScript: $([math]::Round($origJS, 1))KB -> $([math]::Round($minJS, 1))KB (saved $([math]::Round($origJS - $minJS, 1))KB / $([math]::Round(($origJS - $minJS) / $origJS * 100, 1))%)" -ForegroundColor White
Write-Host "  CSS: $([math]::Round($origCSS, 1))KB -> $([math]::Round($minCSS, 1))KB (saved $([math]::Round($origCSS - $minCSS, 1))KB / $([math]::Round(($origCSS - $minCSS) / $origCSS * 100, 1))%)" -ForegroundColor White
Write-Host ""
Write-Host "Build files are in: $buildDir/" -ForegroundColor Yellow
Write-Host ""

if ($Deploy) {
    Write-Host "Deploying minified files..." -ForegroundColor Yellow
    # Copy build files for deployment
    Copy-Item "$buildDir/*" "frontend/" -Force
    Write-Host "Deployed! Don't forget to commit and push." -ForegroundColor Green
}
