[CmdletBinding()]
param(
    [string]$BaseUrl = 'http://localhost:8080',

    [Parameter(Mandatory)]
    [ValidatePattern('^load-[a-z0-9]{2,10}$')]
    [string]$Prefix,

    [ValidatePattern('^[a-zA-Z0-9.-]+$')]
    [string]$Domain = 'loadtest.hyanghae.test',

    [ValidateRange(1, 50)]
    [int]$Count = 50,

    [string]$OutputPath,

    [switch]$AllowProduction
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Provisioning.Common.ps1')

$BaseUrl = Get-NormalizedBaseUrl $BaseUrl
Assert-ProductionAllowed -BaseUrl $BaseUrl -AllowProduction:$AllowProduction
if (-not $OutputPath) {
    $OutputPath = Get-DefaultManifestPath -Prefix $Prefix -Suffix 'users'
}

$password = Read-LoadTestPassword
if ($password.Length -lt 8 -or $password.Length -gt 64) {
    throw '비밀번호는 8~64자여야 합니다.'
}

$users = [System.Collections.Generic.List[object]]::new()
for ($index = 1; $index -le $Count; $index++) {
    $number = $index.ToString('00')
    $email = "$Prefix-$number@$Domain".ToLowerInvariant()
    $nickname = "부하-$Prefix-$number"

    $signup = Invoke-LoadApi -Method POST -Url "$BaseUrl/api/v1/auth/signup" -Body @{
        email = $email
        password = $password
        nickname = $nickname
    } -ExpectedStatus @(201, 409)

    $token = Login-LoadUser -BaseUrl $BaseUrl -Email $email -Password $password
    $me = Get-CurrentUser -BaseUrl $BaseUrl -Token $token
    $users.Add([pscustomobject]@{
        index = $index
        userId = [long]$me.userId
        email = [string]$me.email
        nickname = [string]$me.nickname
        created = ($signup.Status -eq 201)
    })
    Write-Progress -Activity '부하 테스트 사용자 준비' -Status "$index / $Count" `
        -PercentComplete (($index / $Count) * 100)
}

$manifest = [ordered]@{
    schemaVersion = 1
    kind = 'load-test-users'
    baseUrl = $BaseUrl
    prefix = $Prefix
    domain = $Domain
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    users = $users
}
$written = Write-JsonFile -Value $manifest -Path $OutputPath

Write-Host "사용자 $Count명 준비 및 로그인 검증 완료" -ForegroundColor Green
Write-Host "Manifest: $written"
Write-Host '비밀번호와 토큰은 저장하지 않았습니다.'
