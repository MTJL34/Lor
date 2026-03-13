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
                if ($stringQuote -eq "'") {
                    [void]$sb.Append('"')
                } else {
                    [void]$sb.Append($ch)
                }
                $inString = $false
                $stringQuote = ''
            } else {
                if ($stringQuote -eq "'" -and $ch -eq '"') {
                    [void]$sb.Append('\"')
                } else {
                    [void]$sb.Append($ch)
                }
            }
            $i++
            continue
        }

        # Line comments at start-of-line / after whitespace only
        if ($ch -eq '/' -and ($i + 1) -lt $InputText.Length -and $InputText[$i + 1] -eq '/') {
            $j = $i - 1
            $onlyWhitespaceBefore = $true
            while ($j -ge 0 -and $InputText[$j] -ne "`n" -and $InputText[$j] -ne "`r") {
                if (-not [char]::IsWhiteSpace($InputText[$j])) {
                    $onlyWhitespaceBefore = $false
                    break
                }
                $j--
            }

            if ($onlyWhitespaceBefore) {
                while ($i -lt $InputText.Length -and $InputText[$i] -ne "`n") { $i++ }
                continue
            }
        }

        if ($ch -eq '"' -or $ch -eq "'") {
            $inString = $true
            $stringQuote = $ch
            if ($ch -eq "'") {
                [void]$sb.Append('"')
            } else {
                [void]$sb.Append($ch)
            }
            $i++
            continue
        }

        # Quote unquoted object keys after { or ,
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
                    [void]$sb.Append('"')
                    [void]$sb.Append($ident)
                    [void]$sb.Append('"')
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

    # Remove block comments
    $jsonLike = [regex]::Replace($jsonLike, '/\*[\s\S]*?\*/', '')

    # Remove trailing commas before } or ]
    do {
        $previous = $jsonLike
        $jsonLike = [regex]::Replace($jsonLike, ',\s*([\}\]])', '$1')
    } while ($previous -ne $jsonLike)

    return $jsonLike
}

function Get-ExportArrayObject {
    param(
        [string]$FilePath,
        [string]$ExportName
    )

    $content = Get-Content -Path $FilePath -Raw
    $marker = "export const $ExportName"
    $startMarker = $content.IndexOf($marker)
    if ($startMarker -lt 0) {
        throw "Export '$ExportName' introuvable dans $FilePath"
    }

    $eqIndex = $content.IndexOf('=', $startMarker)
    if ($eqIndex -lt 0) {
        throw "Affectation introuvable pour '$ExportName' dans $FilePath"
    }

    $i = $eqIndex + 1
    while ($i -lt $content.Length -and [char]::IsWhiteSpace($content[$i])) { $i++ }
    if ($i -ge $content.Length -or $content[$i] -ne '[') {
        throw "Export '$ExportName' n'est pas un tableau dans $FilePath"
    }

    $startArray = $i
    $depth = 0
    $inString = $false
    $quote = ''
    $escaped = $false
    $endArray = -1

    while ($i -lt $content.Length) {
        $ch = $content[$i]

        if ($inString) {
            if ($escaped) {
                $escaped = $false
            } elseif ($ch -eq '\\') {
                $escaped = $true
            } elseif ($ch -eq $quote) {
                $inString = $false
                $quote = ''
            }
            $i++
            continue
        }

        if ($ch -eq '"' -or $ch -eq "'") {
            $inString = $true
            $quote = $ch
            $i++
            continue
        }

        if ($ch -eq '[') {
            $depth++
        } elseif ($ch -eq ']') {
            $depth--
            if ($depth -eq 0) {
                $endArray = $i
                break
            }
        }

        $i++
    }

    if ($endArray -lt 0) {
        throw "Tableau non fermé pour '$ExportName' dans $FilePath"
    }

    $arrayLiteral = $content.Substring($startArray, $endArray - $startArray + 1)
    $jsonText = Convert-JsArrayLiteralToJson -InputText $arrayLiteral
    return $jsonText | ConvertFrom-Json
}

function To-SnakeCase {
    param([string]$Text)
    $s = $Text -creplace '([a-z0-9])([A-Z])', '$1_$2'
    $s = $s -replace '[^A-Za-z0-9]+', '_'
    $s = $s.Trim('_')
    return $s.ToLowerInvariant()
}

function Escape-SqlString {
    param([string]$Value)
    return $Value -replace "'", "''"
}

function To-SqlValue {
    param($Value)

    if ($null -eq $Value) { return 'NULL' }
    if ($Value -is [string] -and $Value -eq '') { return 'NULL' }

    if ($Value -is [bool]) { return $(if ($Value) { '1' } else { '0' }) }

    if ($Value -is [byte] -or $Value -is [int16] -or $Value -is [int32] -or $Value -is [int64]) {
        return [string]$Value
    }

    if ($Value -is [single] -or $Value -is [double] -or $Value -is [decimal]) {
        return ([string]::Format([System.Globalization.CultureInfo]::InvariantCulture, '{0}', $Value))
    }

    if ($Value -is [string]) {
        return "'$(Escape-SqlString $Value)'"
    }

    return "'$(Escape-SqlString ($Value | ConvertTo-Json -Compress))'"
}

function Infer-SqlType {
    param([object[]]$Values)

    $filtered = @($Values | Where-Object { $null -ne $_ -and (-not ($_ -is [string] -and $_ -eq '')) })
    if ($filtered.Count -eq 0) { return 'TEXT' }

    if (($filtered | Where-Object { $_ -isnot [bool] }).Count -eq 0) { return 'INTEGER' }

    if (($filtered | Where-Object { $_ -isnot [byte] -and $_ -isnot [int16] -and $_ -isnot [int32] -and $_ -isnot [int64] }).Count -eq 0) {
        return 'INTEGER'
    }

    if (($filtered | Where-Object { $_ -isnot [single] -and $_ -isnot [double] -and $_ -isnot [decimal] -and $_ -isnot [byte] -and $_ -isnot [int16] -and $_ -isnot [int32] -and $_ -isnot [int64] }).Count -eq 0) {
        return 'REAL'
    }

    return 'TEXT'
}

$sources = @(
    @{ File = 'data/Constellation_Number.js'; Export = 'Constellation_Number' },
    @{ File = 'data/Cost.js'; Export = 'Cost' },
    @{ File = 'data/Level.js'; Export = 'Level' },
    @{ File = 'data/Region.js'; Export = 'Region' },
    @{ File = 'data/Stars.js'; Export = 'Stars' },
    @{ File = 'data/Relics_Common.js'; Export = 'RelicsCommon' },
    @{ File = 'data/Relics_Rare.js'; Export = 'RelicsRare' },
    @{ File = 'data/Relics_Epic.js'; Export = 'RelicsEpic' },
    @{ File = 'data/Champion.js'; Export = 'Champion' },
    @{ File = 'data/PoC_Champions.js'; Export = 'PoC_Champion' }
)

$output = New-Object System.Collections.Generic.List[string]
$output.Add('-- Auto-generated SQL dump from poc/data JS sources')
$output.Add('BEGIN TRANSACTION;')
$output.Add('')

foreach ($src in $sources) {
    $rows = @(Get-ExportArrayObject -FilePath $src.File -ExportName $src.Export)
    if ($rows.Count -eq 1 -and $rows[0] -is [System.Array]) {
        $rows = @($rows[0])
    }
    $tableName = To-SnakeCase $src.Export
    $isChampion = $src.Export -eq 'Champion'

    $columnOrder = New-Object System.Collections.Generic.List[string]
    $columnSet = @{}

    foreach ($row in $rows) {
        foreach ($prop in $row.PSObject.Properties.Name) {
            if ($isChampion -and $prop -eq 'AllRelics') { continue }
            if (-not $columnSet.ContainsKey($prop)) {
                $columnSet[$prop] = $true
                $columnOrder.Add($prop)
            }
        }
    }

    $output.Add("DROP TABLE IF EXISTS $tableName;")
    $output.Add("CREATE TABLE $tableName (")

    $defs = New-Object System.Collections.Generic.List[string]
    foreach ($col in $columnOrder) {
        $vals = @($rows | ForEach-Object { $_.$col })
        $sqlType = Infer-SqlType -Values $vals
        $defs.Add("  $(To-SnakeCase $col) $sqlType")
    }
    $output.Add(($defs -join ",`n"))
    $output.Add(');')

    if ($rows.Count -gt 0) {
        $insertCols = @($columnOrder | ForEach-Object { To-SnakeCase $_ }) -join ', '
        $output.Add("INSERT INTO $tableName ($insertCols) VALUES")

        $valueRows = New-Object System.Collections.Generic.List[string]
        foreach ($row in $rows) {
            $vals = @()
            foreach ($col in $columnOrder) {
                $vals += To-SqlValue $row.$col
            }
            $valueRows.Add("  (" + ($vals -join ', ') + ")")
        }

        $output.Add(($valueRows -join ",`n") + ';')
    }

    $output.Add('')

    if ($isChampion) {
        $relicTable = 'champion_all_relics'
        $output.Add("DROP TABLE IF EXISTS $relicTable;")
        $output.Add("CREATE TABLE $relicTable (")
        $output.Add('  champion_id INTEGER,')
        $output.Add('  slot_index INTEGER,')
        $output.Add('  relic_code TEXT')
        $output.Add(');')

        $relicInserts = New-Object System.Collections.Generic.List[string]
        foreach ($row in $rows) {
            $championId = $row.Champion_ID
            $slot = 1
            foreach ($relic in @($row.AllRelics)) {
                $relicValue = if ($null -eq $relic -or $relic -eq 0 -or $relic -eq '') { $null } else { $relic }
                $relicInserts.Add("  (" + (To-SqlValue $championId) + ', ' + (To-SqlValue $slot) + ', ' + (To-SqlValue $relicValue) + ')')
                $slot++
            }
        }

        if ($relicInserts.Count -gt 0) {
            $output.Add("INSERT INTO $relicTable (champion_id, slot_index, relic_code) VALUES")
            $output.Add(($relicInserts -join ",`n") + ';')
        }

        $output.Add('')
    }
}

$output.Add('DROP TABLE IF EXISTS all_relics;')
$output.Add('CREATE TABLE all_relics AS')
$output.Add('SELECT * FROM relics_common')
$output.Add('UNION ALL SELECT * FROM relics_rare')
$output.Add('UNION ALL SELECT * FROM relics_epic;')
$output.Add('')

$output.Add('COMMIT;')

$outPath = 'data/data_dump.sql'
Set-Content -Path $outPath -Value $output -Encoding UTF8
Write-Output "SQL generated: $outPath"
