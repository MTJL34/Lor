$ErrorActionPreference = 'Stop'

function Get-BodyWithoutTransaction {
    param([string]$Path)

    $text = Get-Content -Path $Path -Raw -Encoding UTF8
    $text = $text -replace "^\uFEFF", ''
    $text = $text -replace '(?im)^\s*BEGIN TRANSACTION;\s*', ''
    $text = $text -replace '(?im)^\s*COMMIT;\s*', ''
    return $text.Trim()
}

$basePath = 'frontEnd/data'
$dumpPath = Join-Path $basePath 'data_dump.sql'
$gemPath = Join-Path $basePath 'gemstone_tiers.sql'
$sitePath = Join-Path $basePath 'site_data.json'
$outPath = Join-Path $basePath 'all_data.sql'

$dumpBody = Get-BodyWithoutTransaction -Path $dumpPath
$gemBody = Get-BodyWithoutTransaction -Path $gemPath
$siteRaw = Get-Content -Path $sitePath -Raw -Encoding UTF8
$siteRaw = $siteRaw -replace "^\uFEFF", ''
$sitePayload = ($siteRaw -replace '\r?\n', ' ' -replace '\s+', ' ').Trim()
$sitePayload = $sitePayload -replace "'", "''"

$out = New-Object System.Collections.Generic.List[string]
$out.Add('-- Unified SQL dump (all data)')
$out.Add('BEGIN TRANSACTION;')
$out.Add('')
$out.Add($dumpBody)
$out.Add('')
$out.Add($gemBody)
$out.Add('')
$out.Add('DROP TABLE IF EXISTS site_data_json;')
$out.Add('CREATE TABLE site_data_json (')
$out.Add('  id INTEGER PRIMARY KEY,')
$out.Add('  payload TEXT NOT NULL')
$out.Add(');')
$out.Add('INSERT INTO site_data_json (id, payload) VALUES')
$out.Add("  (1, '$sitePayload');")
$out.Add('')
$out.Add('COMMIT;')

Set-Content -Path $outPath -Value $out -Encoding UTF8
Write-Output "SQL generated: $outPath"
