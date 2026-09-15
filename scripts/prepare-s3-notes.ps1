param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$SourceRoot,

    [Parameter(Mandatory = $false)]
    [string]$OutputRoot = '',

    [Parameter(Mandatory = $false)]
    [string]$CdnBaseUrl = 'https://djpgc0m2v54q1.cloudfront.net',

    [Parameter(Mandatory = $false)]
    [string]$SeedOutputPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
    $OutputRoot = Join-Path $scriptDirectory '..\s3-upload'
}

if ([string]::IsNullOrWhiteSpace($SeedOutputPath)) {
    $scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
    $SeedOutputPath = Join-Path $scriptDirectory '..\backend\db\seed\notes.csv'
}

function ConvertTo-Slug {
    param([Parameter(Mandatory = $true)][string]$Value)

    $normalized = $Value.Normalize([Text.NormalizationForm]::FormD)
    $builder = [Text.StringBuilder]::new()

    foreach ($character in $normalized.ToCharArray()) {
        $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($character)
        if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$builder.Append($character)
        }
    }

    $slug = $builder.ToString().Normalize([Text.NormalizationForm]::FormC).ToLowerInvariant()
    $slug = $slug -replace '[^a-z0-9]+', '-'
    $slug = $slug.Trim('-')

    if ([string]::IsNullOrWhiteSpace($slug)) {
        throw "Cannot create an object key from note name: $Value"
    }

    return $slug
}

$csvPath = Join-Path $SourceRoot 'notes_top300_1.csv'
$imageDirectory = Join-Path $SourceRoot 'note images final'
$notesOutputDirectory = Join-Path $OutputRoot 'notes'
$manifestPath = Join-Path $OutputRoot 'manifest.csv'
$unmatchedImagesPath = Join-Path $OutputRoot 'unmatched-images.csv'

if (-not (Test-Path -LiteralPath $csvPath -PathType Leaf)) {
    throw "CSV not found: $csvPath"
}

if (-not (Test-Path -LiteralPath $imageDirectory -PathType Container)) {
    throw "Image directory not found: $imageDirectory"
}

New-Item -ItemType Directory -Path $notesOutputDirectory -Force | Out-Null
Get-ChildItem -LiteralPath $notesOutputDirectory -File | Remove-Item -Force

$rows = @(Import-Csv -LiteralPath $csvPath)
$images = @(Get-ChildItem -LiteralPath $imageDirectory -File -Filter '*.jpg')
$imagesByName = @{}

foreach ($image in $images) {
    if ($imagesByName.ContainsKey($image.Name)) {
        throw "Duplicate image filename: $($image.Name)"
    }
    $imagesByName[$image.Name] = $image
}

$filenameOverrides = @{
    'Agarwood (Oud)' = 'Agarwood.jpg'
    'Tobacco Leaf'   = 'Tabacco Leaf.jpg'
}

$usedSourceFiles = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$usedObjectKeys = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$manifest = [Collections.Generic.List[object]]::new()

foreach ($row in $rows) {
    $noteName = [string]$row.note
    $slug = ConvertTo-Slug -Value $noteName
    $objectKey = "notes/$slug.jpg"
    $sourceFilename = ''
    $status = 'ready'
    $reason = ''

    if (-not $usedObjectKeys.Add($objectKey)) {
        throw "Duplicate generated object key: $objectKey"
    }

    if ($filenameOverrides.ContainsKey($noteName)) {
        $sourceFilename = $filenameOverrides[$noteName]
    }
    else {
        $sourceFilename = "$noteName.jpg"
    }

    if (-not $imagesByName.ContainsKey($sourceFilename)) {
        $status = 'missing'
        $reason = "Source image not found: $sourceFilename"
        $sourceFilename = ''
    }
    else {
        $sourceImage = $imagesByName[$sourceFilename]
        Copy-Item -LiteralPath $sourceImage.FullName -Destination (Join-Path $OutputRoot $objectKey)
        [void]$usedSourceFiles.Add($sourceImage.Name)
    }

    $cdnUrl = ''
    if ($status -eq 'ready') {
        $cdnUrl = "$($CdnBaseUrl.TrimEnd('/'))/$objectKey"
    }

    $manifest.Add([pscustomobject]@{
        rank            = $row.rank
        note            = $noteName
        name_ko         = $row.name_ko
        accord_family   = $row.accord_family
        source_filename = $sourceFilename
        object_key      = $(if ($status -eq 'ready') { $objectKey } else { '' })
        cdn_url         = $cdnUrl
        status          = $status
        reason          = $reason
    })
}

$unmatchedImages = @(
    $images |
        Where-Object { -not $usedSourceFiles.Contains($_.Name) } |
        Sort-Object Name |
        ForEach-Object {
            [pscustomobject]@{
                source_filename = $_.Name
                reason = 'No CSV note mapping; excluded from upload output.'
            }
        }
)

$manifest | Export-Csv -LiteralPath $manifestPath -NoTypeInformation -Encoding utf8
$unmatchedImages | Export-Csv -LiteralPath $unmatchedImagesPath -NoTypeInformation -Encoding utf8

$seedRows = @(
    $manifest |
        Where-Object status -eq 'ready' |
        ForEach-Object {
            [pscustomobject]@{
                popularity_rank = $_.rank
                name            = $_.note
                name_ko         = $_.name_ko
                accord_family   = $_.accord_family
                image_url       = $_.cdn_url
            }
        }
)
$seedRows | Export-Csv -LiteralPath $SeedOutputPath -NoTypeInformation -Encoding utf8

$readyCount = @($manifest | Where-Object status -eq 'ready').Count
$missingCount = @($manifest | Where-Object status -eq 'missing').Count

Write-Host "Prepared note assets: $readyCount"
Write-Host "Missing note assets:  $missingCount"
Write-Host "Unmatched JPG files:  $($unmatchedImages.Count)"
Write-Host "Upload directory:     $notesOutputDirectory"
Write-Host "Manifest:             $manifestPath"
Write-Host "Unmatched images:      $unmatchedImagesPath"
Write-Host "DB seed CSV:           $SeedOutputPath"

if ($missingCount -ne 0 -or $readyCount -ne 246 -or $unmatchedImages.Count -ne 0) {
    throw "Unexpected result. Expected all 246 note assets to match."
}
