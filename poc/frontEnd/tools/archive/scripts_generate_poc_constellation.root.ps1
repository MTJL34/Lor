$ErrorActionPreference = 'Stop'

function Convert-JsArrayLiteralToJson {
    param([string]$InputText)

    $sb = New-Object System.Text.StringBuilder
    $inString = $false
    $stringQuote = ''
    $escaped = $false
    $i = 0

    while ($i -lt $InputText.Length) {
        $ch = $InputText[$i]

        if ($inString) {
            if ($escaped) {
                [void]$sb.Append($ch)
                $escaped = $false
            } elseif ($ch -eq '\\') {
                [void]$sb.Append($ch)
                $escaped = $true
            } elseif ($ch -eq $stringQuote) {
                if ($stringQuote -eq "'") { [void]$sb.Append('"') } else { [void]$sb.Append($ch) }
                $inString = $false
                $stringQuote = ''
            } else {
                if ($stringQuote -eq "'" -and $ch -eq '"') { [void]$sb.Append('\"') } else { [void]$sb.Append($ch) }
            }
            $i++
            continue
        }

        if ($ch -eq '"' -or $ch -eq "'") {
            $inString = $true
            $stringQuote = $ch
            if ($ch -eq "'") { [void]$sb.Append('"') } else { [void]$sb.Append($ch) }
            $i++
            continue
        }

        if (($ch -match '[A-Za-z_]')) {
            $prevSig = ''
            for ($k = $sb.Length - 1; $k -ge 0; $k--) {
                $pc = $sb[$k]
                if (-not [char]::IsWhiteSpace($pc)) { $prevSig = $pc; break }
            }

            if ($prevSig -eq '{' -or $prevSig -eq ',') {
                $start = $i
                while ($i -lt $InputText.Length -and $InputText[$i] -match '[A-Za-z0-9_]') { $i++ }
                $ident = $InputText.Substring($start, $i - $start)
                $peek = $i
                while ($peek -lt $InputText.Length -and [char]::IsWhiteSpace($InputText[$peek])) { $peek++ }
                if ($peek -lt $InputText.Length -and $InputText[$peek] -eq ':') {
                    [void]$sb.Append('"'); [void]$sb.Append($ident); [void]$sb.Append('"')
                    continue
                } else {
                    [void]$sb.Append($ident)
                    continue
                }
            }
        }

        [void]$sb.Append($ch)
        $i++
    }

    $jsonLike = $sb.ToString()
    do {
        $previous = $jsonLike
        $jsonLike = [regex]::Replace($jsonLike, ',\s*([\}\]])', '$1')
    } while ($previous -ne $jsonLike)

    return $jsonLike
}

function Get-ExportArrayObject {
    param([string]$FilePath,[string]$ExportName)

    $content = Get-Content -Path $FilePath -Raw
    $marker = "export const $ExportName"
    $startMarker = $content.IndexOf($marker)
    if ($startMarker -lt 0) { throw "Export '$ExportName' introuvable dans $FilePath" }

    $eqIndex = $content.IndexOf('=', $startMarker)
    $i = $eqIndex + 1
    while ($i -lt $content.Length -and [char]::IsWhiteSpace($content[$i])) { $i++ }
    $startArray = $i
    $depth = 0
    $inString = $false
    $quote = ''
    $escaped = $false
    $endArray = -1

    while ($i -lt $content.Length) {
        $ch = $content[$i]
        if ($inString) {
            if ($escaped) { $escaped = $false }
            elseif ($ch -eq '\\') { $escaped = $true }
            elseif ($ch -eq $quote) { $inString = $false; $quote = '' }
            $i++; continue
        }
        if ($ch -eq '"' -or $ch -eq "'") { $inString = $true; $quote = $ch; $i++; continue }
        if ($ch -eq '[') { $depth++ }
        elseif ($ch -eq ']') { $depth--; if ($depth -eq 0) { $endArray = $i; break } }
        $i++
    }

    $arrayLiteral = $content.Substring($startArray, $endArray - $startArray + 1)
    $jsonText = Convert-JsArrayLiteralToJson -InputText $arrayLiteral
    return $jsonText | ConvertFrom-Json
}

function To-SqlValue {
    param($Value)
    if ($null -eq $Value) { return 'NULL' }
    if ($Value -is [string]) {
        if ($Value -eq '') { return 'NULL' }
        return "'" + ($Value -replace "'", "''") + "'"
    }
    if ($Value -is [bool]) { return $(if ($Value) { '1' } else { '0' }) }
    return [string]$Value
}

$constellations = @(Get-ExportArrayObject -FilePath 'poc/data/Constellation_Number.js' -ExportName 'Constellation_Number')
if ($constellations.Count -eq 1 -and $constellations[0] -is [System.Array]) {
    $constellations = @($constellations[0])
}

$champions = @(Get-ExportArrayObject -FilePath 'poc/data/Champion.js' -ExportName 'Champion')
if ($champions.Count -eq 1 -and $champions[0] -is [System.Array]) {
    $champions = @($champions[0])
}
$pocChampions = @($champions | Where-Object { $_.POC -eq $true })

$out = New-Object System.Collections.Generic.List[string]
$out.Add('-- SQL Constellation + PoC')
$out.Add('BEGIN TRANSACTION;')
$out.Add('')

$out.Add('DROP TABLE IF EXISTS constellation_number;')
$out.Add('CREATE TABLE constellation_number (')
$out.Add('  constellation_id INTEGER,')
$out.Add('  constellation_value INTEGER')
$out.Add(');')
$out.Add('INSERT INTO constellation_number (constellation_id, constellation_value) VALUES')
$constRows = New-Object System.Collections.Generic.List[string]
foreach ($r in $constellations) {
    $constRows.Add("  (" + (To-SqlValue $r.Constellation_ID) + ', ' + (To-SqlValue $r.Constellation_Value) + ")")
}
$out.Add(($constRows -join ",`n") + ';')
$out.Add('')

$out.Add('DROP TABLE IF EXISTS poc_champion;')
$out.Add('CREATE TABLE poc_champion (')
$out.Add('  champion_id INTEGER,')
$out.Add('  champion_name TEXT,')
$out.Add('  region_id INTEGER,')
$out.Add('  cost_id INTEGER,')
$out.Add('  stars_id INTEGER,')
$out.Add('  constellation_number_id INTEGER,')
$out.Add('  level_id INTEGER,')
$out.Add('  lor_exclusive INTEGER,')
$out.Add('  champion_icon TEXT')
$out.Add(');')
$out.Add('INSERT INTO poc_champion (champion_id, champion_name, region_id, cost_id, stars_id, constellation_number_id, level_id, lor_exclusive, champion_icon) VALUES')
$pocRows = New-Object System.Collections.Generic.List[string]
foreach ($c in $pocChampions) {
    $pocRows.Add("  (" + (To-SqlValue $c.Champion_ID) + ', ' + (To-SqlValue $c.Champion_Name) + ', ' + (To-SqlValue $c.Region_ID) + ', ' + (To-SqlValue $c.Cost_ID) + ', ' + (To-SqlValue $c.Stars_ID) + ', ' + (To-SqlValue $c.Constellation_Number_ID) + ', ' + (To-SqlValue $c.Level_ID) + ', ' + (To-SqlValue $c.LOR_Exclusive) + ', ' + (To-SqlValue $c.Champion_Icon) + ")")
}
$out.Add(($pocRows -join ",`n") + ';')
$out.Add('')

$out.Add('DROP TABLE IF EXISTS poc_champion_all_relics;')
$out.Add('CREATE TABLE poc_champion_all_relics (')
$out.Add('  champion_id INTEGER,')
$out.Add('  slot_index INTEGER,')
$out.Add('  relic_code TEXT')
$out.Add(');')
$out.Add('INSERT INTO poc_champion_all_relics (champion_id, slot_index, relic_code) VALUES')
$relRows = New-Object System.Collections.Generic.List[string]
foreach ($c in $pocChampions) {
    $slot = 1
    foreach ($relic in @($c.AllRelics)) {
        $rv = if ($relic -eq 0 -or $relic -eq '') { $null } else { $relic }
        $relRows.Add("  (" + (To-SqlValue $c.Champion_ID) + ', ' + (To-SqlValue $slot) + ', ' + (To-SqlValue $rv) + ")")
        $slot++
    }
}
$out.Add(($relRows -join ",`n") + ';')
$out.Add('')

$out.Add('COMMIT;')

Set-Content -Path 'poc/data/poc_constellation.sql' -Value $out -Encoding UTF8
Write-Output 'SQL generated: poc/data/poc_constellation.sql'
