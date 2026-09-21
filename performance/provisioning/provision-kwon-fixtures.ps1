[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://localhost:8080',

    [string]$UserManifestPath = (Join-Path $PSScriptRoot 'generated/load-kwon.users.json'),

    [string]$OutputPath = (Join-Path $PSScriptRoot 'generated/load-kwon.fixtures.json'),

    [switch]$WithImages,

    [switch]$AllowProduction
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Provisioning.Common.ps1')

$BaseUrl = Get-NormalizedBaseUrl $BaseUrl
Assert-ProductionAllowed -BaseUrl $BaseUrl -AllowProduction:$AllowProduction
$userManifest = Read-JsonFile $UserManifestPath
$password = Read-LoadTestPassword
$previous = if (Test-Path -LiteralPath $OutputPath) { Read-JsonFile $OutputPath } else { $null }
$previousByEmail = @{}
if ($previous) {
    foreach ($item in @($previous.users)) {
        $previousByEmail[[string]$item.email] = $item
    }
}

function New-LoadTestImage {
    param(
        [Parameter(Mandatory)][string]$BaseUrl,
        [Parameter(Mandatory)][string]$Token
    )

    $png = [Convert]::FromBase64String(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    )
    $temporary = Join-Path ([System.IO.Path]::GetTempPath()) `
        ("hyanghae-load-test-{0}.png" -f [Guid]::NewGuid())
    try {
        [System.IO.File]::WriteAllBytes($temporary, $png)
        $response = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/v1/posts/images" `
            -Headers (Get-AuthHeaders $Token) -Form @{ file = Get-Item -LiteralPath $temporary } `
            -UserAgent 'hyanghae-load-test-provisioner/1.0'
        if (-not $response.imageUrl) {
            throw '이미지 업로드 응답에 imageUrl이 없습니다.'
        }
        return [string]$response.imageUrl
    } finally {
        if (Test-Path -LiteralPath $temporary) {
            Remove-Item -LiteralPath $temporary -Force
        }
    }
}

$fixtureUsers = [System.Collections.Generic.List[object]]::new()
for ($index = 0; $index -lt $userManifest.users.Count; $index++) {
    $user = $userManifest.users[$index]
    $token = Login-LoadUser -BaseUrl $BaseUrl -Email $user.email -Password $password
    $headers = Get-AuthHeaders $token
    $old = $previousByEmail[[string]$user.email]
    $postId = $null
    $imageUrl = $null

    if ($null -ne $old -and $old.postId) {
        $existing = Invoke-LoadApi -Method GET -Url "$BaseUrl/api/v1/posts/$($old.postId)" `
            -Headers $headers -ExpectedStatus @(200, 404)
        if ($existing.Status -eq 200) {
            $postId = [long]$old.postId
            $existingImages = @($existing.Body.imageUrls)
            if ($WithImages -and $existingImages.Count -eq 0) {
                $imageUrl = New-LoadTestImage -BaseUrl $BaseUrl -Token $token
                Invoke-LoadApi -Method PATCH -Url "$BaseUrl/api/v1/posts/$postId" `
                    -Headers $headers -Body @{ imageUrls = @($imageUrl) } `
                    -ExpectedStatus 200 | Out-Null
            } elseif ($existingImages.Count -gt 0) {
                $imageUrl = [string]$existingImages[0]
            }
        }
    }

    if ($null -eq $postId) {
        if ($WithImages) {
            $imageUrl = New-LoadTestImage -BaseUrl $BaseUrl -Token $token
        }
        $body = @{
            category = 'CHAT'
            title = "[LOAD-TEST] update $($user.email.Split('@')[0])"
            content = '운영 부하 테스트 전용 게시글입니다. 실제 사용자 데이터가 아닙니다.'
            collectionId = $null
            perfumeIds = @()
            imageUrls = if ($imageUrl) { @($imageUrl) } else { @() }
        }
        $created = (Invoke-LoadApi -Method POST -Url "$BaseUrl/api/v1/posts" `
            -Headers $headers -Body $body -ExpectedStatus 201).Body
        $postId = [long]$created.postId
    }

    $fixtureUsers.Add([pscustomobject]@{
        userId = [long]$user.userId
        email = [string]$user.email
        postId = $postId
        hasImage = [bool]$imageUrl
        imageUrl = $imageUrl
    })
    Write-Progress -Activity 'load-kwon fixture 준비' `
        -Status "$($index + 1) / $($userManifest.users.Count)" `
        -PercentComplete ((($index + 1) / $userManifest.users.Count) * 100)
}

$reviewBoard = (Invoke-LoadApi -Method GET `
    -Url "$BaseUrl/api/v1/reviews?sort=LIKES&page=0&size=50" `
    -ExpectedStatus 200).Body
$candidateIds = @($reviewBoard.reviews | ForEach-Object { [long]$_.perfume.perfumeId } | Select-Object -Unique)
$preferredReviewTargets = [System.Collections.Generic.List[long]]::new()
$fallbackReviewTargets = [System.Collections.Generic.List[long]]::new()
foreach ($perfumeId in $candidateIds) {
    $summary = (Invoke-LoadApi -Method GET `
        -Url "$BaseUrl/api/v1/perfumes/$perfumeId/review-summary" -ExpectedStatus 200).Body
    Invoke-LoadApi -Method GET `
        -Url "$BaseUrl/api/v1/perfumes/$perfumeId/review-keywords?size=20" `
        -ExpectedStatus 200 | Out-Null
    Invoke-LoadApi -Method GET `
        -Url "$BaseUrl/api/v1/perfumes/$perfumeId/review-statistics" `
        -ExpectedStatus 200 | Out-Null
    Invoke-LoadApi -Method GET `
        -Url "$BaseUrl/api/v1/perfumes/$perfumeId/season-statistics" `
        -ExpectedStatus 200 | Out-Null
    if ($summary.summary) {
        $preferredReviewTargets.Add($perfumeId)
    } else {
        $fallbackReviewTargets.Add($perfumeId)
    }
    if ($preferredReviewTargets.Count -ge 5) { break }
}
$reviewAggregatePerfumeIds = @($preferredReviewTargets) + @($fallbackReviewTargets)
$reviewAggregatePerfumeIds = @($reviewAggregatePerfumeIds | Select-Object -First 5)
if ($reviewAggregatePerfumeIds.Count -eq 0) {
    Write-Warning '후기 집계 4종에 사용할 운영 향수를 자동 선정하지 못했습니다.'
}

$manifest = [ordered]@{
    schemaVersion = 1
    kind = 'load-kwon-fixtures'
    baseUrl = $BaseUrl
    sourceUserManifest = [System.IO.Path]::GetFullPath($UserManifestPath)
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    likeTargetPostId = [long]$fixtureUsers[0].postId
    reviewAggregatePerfumeIds = $reviewAggregatePerfumeIds
    naturalLanguageRecommendation = [ordered]@{
        fixtureRequired = $false
        authenticationRequired = $false
        rateLimitKey = 'client-ip'
    }
    trendingPerfumes = [ordered]@{
        fixtureCreated = $false
        reason = '운영 trending 집계를 오염시키지 않기 위해 실제 운영 데이터를 사용합니다.'
    }
    users = $fixtureUsers
}
$written = Write-JsonFile -Value $manifest -Path $OutputPath

Write-Host "load-kwon 게시글 fixture $($fixtureUsers.Count)개 준비 완료" -ForegroundColor Green
Write-Host "좋아요 경합 대상 postId: $($manifest.likeTargetPostId)"
Write-Host "Manifest: $written"
if (-not $WithImages) {
    Write-Warning 'S3 afterCommit 경로용 이미지가 필요하면 -WithImages로 다시 실행하세요.'
}
