[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://localhost:8080',

    [string]$UserManifestPath = (Join-Path $PSScriptRoot 'generated/load-kim.users.json'),

    [ValidateRange(3, 30)]
    [int]$ShelfItemsPerUser = 9,

    [string]$OutputPath = (Join-Path $PSScriptRoot 'generated/load-kim.fixtures.json'),

    [switch]$AllowProduction
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Provisioning.Common.ps1')

$BaseUrl = Get-NormalizedBaseUrl $BaseUrl
Assert-ProductionAllowed -BaseUrl $BaseUrl -AllowProduction:$AllowProduction
$userManifest = Read-JsonFile $UserManifestPath
$password = Read-LoadTestPassword

$familyCodes = @(
    'FLORAL', 'GREEN', 'CITRUS', 'FRUITY', 'AQUATIC',
    'MUSK', 'GOURMAND', 'WOODY', 'AMBER'
)
$vectors = (Invoke-LoadApi -Method GET -Url "$BaseUrl/api/v1/map/scent-vectors" `
    -ExpectedStatus 200).Body.perfumes
if (-not $vectors -or $vectors.Count -eq 0) {
    throw '취향 테스트용 향수 벡터가 없습니다.'
}

function Get-FamilyWeight {
    param($Vector, [string]$FamilyCode)
    $property = $Vector.families.PSObject.Properties[$FamilyCode]
    if ($null -eq $property) { return 0.0 }
    return [double]$property.Value
}

function Get-VectorNorm {
    param($Vector)
    $sum = 0.0
    foreach ($property in $Vector.families.PSObject.Properties) {
        $weight = [double]$property.Value
        $sum += $weight * $weight
    }
    return [Math]::Sqrt($sum)
}

$profiles = [System.Collections.Generic.List[object]]::new()
foreach ($familyCode in $familyCodes) {
    $best = $vectors | ForEach-Object {
        $norm = Get-VectorNorm $_
        $score = if ($norm -gt 0) { (Get-FamilyWeight $_ $familyCode) / $norm } else { 0.0 }
        [pscustomobject]@{ perfumeId = [long]$_.perfumeId; rank = [int]$_.rank; score = $score }
    } | Where-Object { $_.score -gt 0 } | Sort-Object @{ Expression = 'score'; Descending = $true }, rank | Select-Object -First 1

    if ($null -eq $best) {
        throw "$familyCode 계열과 연결할 지도 향수를 찾지 못했습니다."
    }
    $profiles.Add([pscustomobject]@{
        code = $familyCode
        picks = @($familyCode)
        matchedPerfumeId = $best.perfumeId
    })
}

$catalog = (Invoke-LoadApi -Method GET `
    -Url "$BaseUrl/api/v1/perfumes?page=0&size=100&sort=id,asc" `
    -ExpectedStatus 200).Body.perfumes
if (-not $catalog -or $catalog.Count -lt $ShelfItemsPerUser) {
    throw "활성 향수가 부족합니다. 필요=$ShelfItemsPerUser, 조회=$($catalog.Count)"
}
$catalogIds = @($catalog | ForEach-Object { [long]$_.perfumeId })
$categories = @('OWNED', 'TRIED', 'WISH')
$ratings = @(4.5, 3.5, 5.0, 2.5, 4.0, 3.0)
$fixtureUsers = [System.Collections.Generic.List[object]]::new()

for ($userOffset = 0; $userOffset -lt $userManifest.users.Count; $userOffset++) {
    $user = $userManifest.users[$userOffset]
    $token = Login-LoadUser -BaseUrl $BaseUrl -Email $user.email -Password $password
    $headers = Get-AuthHeaders $token
    $profile = $profiles[$userOffset % $profiles.Count]

    $taste = (Invoke-LoadApi -Method GET -Url "$BaseUrl/api/v1/users/me/taste-test" `
        -Headers $headers -ExpectedStatus 200).Body
    if (-not $taste.completed) {
        $taste = (Invoke-LoadApi -Method POST -Url "$BaseUrl/api/v1/users/me/taste-test" `
            -Headers $headers -Body @{
                picks = @($profile.picks)
                matchedPerfumeId = $profile.matchedPerfumeId
            } -ExpectedStatus 201).Body
    } else {
        $actualPicks = @($taste.picks) -join ','
        $expectedPicks = @($profile.picks) -join ','
        if ($actualPicks -ne $expectedPicks -or
                [long]$taste.matchedPerfumeId -ne [long]$profile.matchedPerfumeId) {
            throw "$($user.email)의 기존 취향 테스트가 계산된 프로파일과 다릅니다. 취향 테스트는 덮어쓸 수 없습니다."
        }
    }

    $existingByPerfume = @{}
    foreach ($category in $categories) {
        $page = (Invoke-LoadApi -Method GET `
            -Url "$BaseUrl/api/v1/users/me/shelf-items?category=$category&page=0&size=100" `
            -Headers $headers -ExpectedStatus 200).Body
        foreach ($item in @($page.perfumes)) {
            $existingByPerfume[[string]$item.perfumeId] = $item
        }
    }

    $shelfItems = [System.Collections.Generic.List[object]]::new()
    for ($itemOffset = 0; $itemOffset -lt $ShelfItemsPerUser; $itemOffset++) {
        $perfumeId = $catalogIds[($userOffset * $ShelfItemsPerUser + $itemOffset) % $catalogIds.Count]
        $category = $categories[$itemOffset % $categories.Count]
        $existing = $existingByPerfume[[string]$perfumeId]
        if ($null -eq $existing) {
            $created = (Invoke-LoadApi -Method POST -Url "$BaseUrl/api/v1/users/me/shelf-items" `
                -Headers $headers -Body @{
                    perfumeId = $perfumeId
                    ownershipStatus = $category
                } -ExpectedStatus 201).Body
            $shelfItemId = [long]$created.shelfItemId
        } else {
            $shelfItemId = [long]$existing.shelfItemId
            if ([string]$existing.category -ne $category) {
                Invoke-LoadApi -Method PATCH `
                    -Url "$BaseUrl/api/v1/users/me/shelf-items/$shelfItemId/ownership" `
                    -Headers $headers -Body @{ ownershipStatus = $category } `
                    -ExpectedStatus 200 | Out-Null
            }
        }

        $rating = $null
        if ($category -ne 'WISH') {
            $rating = $ratings[$itemOffset % $ratings.Count]
            Invoke-LoadApi -Method PUT `
                -Url "$BaseUrl/api/v1/users/me/shelf-items/$shelfItemId/fit-rating" `
                -Headers $headers -Body @{ fitRating = $rating } -ExpectedStatus 200 | Out-Null
        }

        $shelfItems.Add([pscustomobject]@{
            shelfItemId = $shelfItemId
            perfumeId = $perfumeId
            category = $category
            fitRating = $rating
        })
    }

    $memoItem = $shelfItems | Where-Object { $_.category -eq 'OWNED' } | Select-Object -First 1
    $memoContent = "부하 테스트 전용 개인 기록 - $($user.email)"
    $memoResult = Invoke-LoadApi -Method POST `
        -Url "$BaseUrl/api/v1/users/me/shelf-items/$($memoItem.shelfItemId)/memo" `
        -Headers $headers -Body @{ content = $memoContent } -ExpectedStatus @(201, 409)
    if ($memoResult.Status -eq 409) {
        Invoke-LoadApi -Method PATCH `
            -Url "$BaseUrl/api/v1/users/me/shelf-items/$($memoItem.shelfItemId)/memo" `
            -Headers $headers -Body @{ content = $memoContent } -ExpectedStatus 200 | Out-Null
    }

    $fixtureUsers.Add([pscustomobject]@{
        userId = [long]$user.userId
        email = [string]$user.email
        tasteProfile = $profile.code
        tastePicks = @($profile.picks)
        matchedPerfumeId = [long]$profile.matchedPerfumeId
        memoShelfItemId = [long]$memoItem.shelfItemId
        shelfItems = $shelfItems
    })
    Write-Progress -Activity 'load-kim fixture 준비' `
        -Status "$($userOffset + 1) / $($userManifest.users.Count)" `
        -PercentComplete ((($userOffset + 1) / $userManifest.users.Count) * 100)
}

$manifest = [ordered]@{
    schemaVersion = 1
    kind = 'load-kim-fixtures'
    baseUrl = $BaseUrl
    sourceUserManifest = [System.IO.Path]::GetFullPath($UserManifestPath)
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    tasteProfiles = $profiles
    catalogPerfumeIds = $catalogIds
    users = $fixtureUsers
}
$written = Write-JsonFile -Value $manifest -Path $OutputPath

Write-Host "load-kim fixture $($fixtureUsers.Count)명 준비 완료" -ForegroundColor Green
Write-Host "Manifest: $written"
