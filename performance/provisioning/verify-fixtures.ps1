[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$UserManifestPath,

    [string]$FixtureManifestPath,

    [string]$BaseUrl,

    [switch]$AllowProduction
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Provisioning.Common.ps1')

$users = Read-JsonFile $UserManifestPath
if (-not $BaseUrl) { $BaseUrl = [string]$users.baseUrl }
$BaseUrl = Get-NormalizedBaseUrl $BaseUrl
Assert-ProductionAllowed -BaseUrl $BaseUrl -AllowProduction:$AllowProduction
$fixtures = if ($FixtureManifestPath) { Read-JsonFile $FixtureManifestPath } else { $null }
$fixtureByEmail = @{}
if ($fixtures) {
    foreach ($fixture in @($fixtures.users)) {
        $fixtureByEmail[[string]$fixture.email] = $fixture
    }
}

$password = Read-LoadTestPassword
$results = [System.Collections.Generic.List[object]]::new()
foreach ($user in @($users.users)) {
    $token = Login-LoadUser -BaseUrl $BaseUrl -Email $user.email -Password $password
    $headers = Get-AuthHeaders $token
    $me = Get-CurrentUser -BaseUrl $BaseUrl -Token $token
    $tasteCompleted = $null
    $shelfCount = $null
    $postOk = $null
    $fixture = $fixtureByEmail[[string]$user.email]

    if ($fixtures -and $fixtures.kind -eq 'load-kim-fixtures') {
        $taste = (Invoke-LoadApi -Method GET -Url "$BaseUrl/api/v1/users/me/taste-test" `
            -Headers $headers -ExpectedStatus 200).Body
        $tasteCompleted = [bool]$taste.completed
        $shelfCount = 0
        foreach ($category in @('OWNED', 'TRIED', 'WISH')) {
            $page = (Invoke-LoadApi -Method GET `
                -Url "$BaseUrl/api/v1/users/me/shelf-items?category=$category&page=0&size=100" `
                -Headers $headers -ExpectedStatus 200).Body
            $shelfCount += [int]$page.totalElements
        }
        if ($fixture.memoShelfItemId) {
            Invoke-LoadApi -Method GET `
                -Url "$BaseUrl/api/v1/users/me/shelf-items/$($fixture.memoShelfItemId)/memo" `
                -Headers $headers -ExpectedStatus 200 | Out-Null
        }
    }

    if ($fixtures -and $fixtures.kind -eq 'load-kwon-fixtures') {
        $post = Invoke-LoadApi -Method GET -Url "$BaseUrl/api/v1/posts/$($fixture.postId)" `
            -Headers $headers -ExpectedStatus 200
        $postOk = $post.Status -eq 200
    }

    $results.Add([pscustomobject]@{
        email = [string]$user.email
        login = ([long]$me.userId -eq [long]$user.userId)
        tasteCompleted = $tasteCompleted
        shelfCount = $shelfCount
        post = $postOk
    })
}

$results | Format-Table -AutoSize
$failed = @($results | Where-Object {
    -not $_.login -or
    ($null -ne $_.tasteCompleted -and -not $_.tasteCompleted) -or
    ($null -ne $_.post -and -not $_.post)
})
if ($failed.Count -gt 0) {
    throw "fixture 검증 실패: $($failed.Count)명"
}
Write-Host "fixture 검증 완료: $($results.Count)명" -ForegroundColor Green
