Set-StrictMode -Version Latest

function Get-NormalizedBaseUrl {
    param([Parameter(Mandatory)][string]$BaseUrl)

    $uri = [Uri]$BaseUrl
    if ($uri.Scheme -notin @('http', 'https')) {
        throw 'BaseUrl은 http 또는 https 주소여야 합니다.'
    }
    return $BaseUrl.TrimEnd('/')
}

function Assert-ProductionAllowed {
    param(
        [Parameter(Mandatory)][string]$BaseUrl,
        [switch]$AllowProduction
    )

    $hostName = ([Uri]$BaseUrl).Host
    $isLocal = $hostName -in @('localhost', '127.0.0.1', '::1')
    if (-not $isLocal -and -not $AllowProduction) {
        throw '원격 환경에 데이터를 만들려면 -AllowProduction을 명시해야 합니다.'
    }
}

function Read-LoadTestPassword {
    $secure = Read-Host '부하 테스트 계정 비밀번호' -AsSecureString
    return [System.Net.NetworkCredential]::new('', $secure).Password
}

function Invoke-LoadApi {
    param(
        [Parameter(Mandatory)][ValidateSet('GET', 'POST', 'PUT', 'PATCH', 'DELETE')]
        [string]$Method,
        [Parameter(Mandatory)][string]$Url,
        [hashtable]$Headers = @{},
        [AllowNull()]$Body,
        [int[]]$ExpectedStatus = @(200)
    )

    $parameters = @{
        Method = $Method
        Uri = $Url
        Headers = $Headers
        SkipHttpErrorCheck = $true
        UserAgent = 'hyanghae-load-test-provisioner/1.0'
    }
    if ($null -ne $Body) {
        $parameters.ContentType = 'application/json; charset=utf-8'
        $parameters.Body = $Body | ConvertTo-Json -Depth 20 -Compress
    }

    $response = Invoke-WebRequest @parameters
    $status = [int]$response.StatusCode
    $parsed = $null
    if (-not [string]::IsNullOrWhiteSpace($response.Content)) {
        try {
            $parsed = $response.Content | ConvertFrom-Json
        } catch {
            $parsed = $response.Content
        }
    }

    if ($status -notin $ExpectedStatus) {
        $detail = if ($response.Content) { $response.Content } else { '<empty>' }
        throw "$Method $Url 실패: HTTP $status, $detail"
    }
    return [pscustomobject]@{ Status = $status; Body = $parsed }
}

function Get-AuthHeaders {
    param([Parameter(Mandatory)][string]$Token)
    return @{ Authorization = "Bearer $Token" }
}

function Login-LoadUser {
    param(
        [Parameter(Mandatory)][string]$BaseUrl,
        [Parameter(Mandatory)][string]$Email,
        [Parameter(Mandatory)][string]$Password
    )

    $result = Invoke-LoadApi -Method POST -Url "$BaseUrl/api/v1/auth/login" `
        -Body @{ email = $Email; password = $Password } -ExpectedStatus 200
    if (-not $result.Body.accessToken) {
        throw "$Email 로그인 응답에 accessToken이 없습니다."
    }
    return [string]$result.Body.accessToken
}

function Get-CurrentUser {
    param(
        [Parameter(Mandatory)][string]$BaseUrl,
        [Parameter(Mandatory)][string]$Token
    )
    return (Invoke-LoadApi -Method GET -Url "$BaseUrl/api/v1/users/me" `
        -Headers (Get-AuthHeaders $Token) -ExpectedStatus 200).Body
}

function Read-JsonFile {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "파일을 찾을 수 없습니다: $Path"
    }
    return Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string]$Path
    )
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $directory = Split-Path -Parent $fullPath
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    $json = $Value | ConvertTo-Json -Depth 30
    [System.IO.File]::WriteAllText($fullPath, $json, [System.Text.UTF8Encoding]::new($false))
    return $fullPath
}

function Get-DefaultManifestPath {
    param(
        [Parameter(Mandatory)][string]$Prefix,
        [Parameter(Mandatory)][string]$Suffix
    )
    return Join-Path $PSScriptRoot "generated/$Prefix.$Suffix.json"
}
