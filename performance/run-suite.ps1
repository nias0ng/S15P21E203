param(
    [ValidateSet('smoke', 'load')]
    [string]$Mode = 'smoke',

    [string]$BaseUrl = 'http://localhost:8080',

    [ValidateRange(1, 3600)]
    [int]$StageSeconds = 60
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$k6Command = Get-Command k6 -ErrorAction SilentlyContinue
$k6Path = if ($k6Command) {
    $k6Command.Source
} elseif (Test-Path -LiteralPath 'C:\Program Files\k6\k6.exe') {
    'C:\Program Files\k6\k6.exe'
} else {
    throw 'k6를 찾지 못했습니다. winget install k6 --source winget 실행 후 PowerShell을 다시 여세요.'
}

$scripts = @(
    'personalized-recommendation.js',
    'review-board-likes.js',
    'shelf-items.js',
    'perfume-view-create.js',
    'review-like.js'
)

Push-Location $repositoryRoot
try {
    foreach ($script in $scripts) {
        Write-Host "`n===== $script ($Mode) =====" -ForegroundColor Cyan
        & $k6Path run `
            -e "MODE=$Mode" `
            -e "BASE_URL=$BaseUrl" `
            -e "STAGE_SECONDS=$StageSeconds" `
            "performance\$script"
        if ($LASTEXITCODE -ne 0) {
            throw "$script 실행 실패 (exit code: $LASTEXITCODE)"
        }
    }
} finally {
    Pop-Location
}
