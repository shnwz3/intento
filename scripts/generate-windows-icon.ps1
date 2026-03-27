Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $root 'resources'
$tempDir = Join-Path $outputDir 'icon-build'
$sizes = @(16, 24, 32, 48, 64, 72, 96, 128, 256)

function New-RoundedRectPath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $Radius * 2

    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()

    return $path
}

function New-ColorBlend {
    param(
        [System.Drawing.Color[]]$Colors,
        [single[]]$Positions
    )

    $blend = New-Object System.Drawing.Drawing2D.ColorBlend
    $blend.Colors = $Colors
    $blend.Positions = $Positions
    return $blend
}

function Draw-IntentoIcon {
    param([int]$Size)

    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $frameInset = [float]($Size * 0.06)
    $frameSize = [float]($Size - ($frameInset * 2))
    $frameRadius = [Math]::Max([float]($Size * 0.18), 3.0)
    $framePath = New-RoundedRectPath -X $frameInset -Y $frameInset -Width $frameSize -Height $frameSize -Radius $frameRadius

    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.RectangleF -ArgumentList @($frameInset, $frameInset, $frameSize, $frameSize)),
        [System.Drawing.Color]::FromArgb(255, 59, 130, 246),
        [System.Drawing.Color]::FromArgb(255, 29, 78, 216),
        45
    )
    $gradient.InterpolationColors = New-ColorBlend `
        -Colors @(
            [System.Drawing.Color]::FromArgb(255, 76, 154, 255),
            [System.Drawing.Color]::FromArgb(255, 44, 117, 245),
            [System.Drawing.Color]::FromArgb(255, 29, 78, 216)
        ) `
        -Positions @(0.0, 0.55, 1.0)
    $graphics.FillPath($gradient, $framePath)

    $highlightPath = New-RoundedRectPath `
        -X ($frameInset + ($Size * 0.07)) `
        -Y ($frameInset + ($Size * 0.07)) `
        -Width ($frameSize - ($Size * 0.14)) `
        -Height ($frameSize * 0.42) `
        -Radius ([Math]::Max([float]($Size * 0.12), 2.0))
    $highlightBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.RectangleF -ArgumentList @(0, 0, $Size, ($Size * 0.55))),
        [System.Drawing.Color]::FromArgb(78, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(8, 255, 255, 255),
        90
    )
    $graphics.FillPath($highlightBrush, $highlightPath)

    $keyboardX = [float]($Size * 0.18)
    $keyboardY = [float]($Size * 0.26)
    $keyboardWidth = [float]($Size * 0.64)
    $keyboardHeight = [float]($Size * 0.40)
    $keyboardRadius = [Math]::Max([float]($Size * 0.10), 2.0)
    $keyboardPath = New-RoundedRectPath -X $keyboardX -Y $keyboardY -Width $keyboardWidth -Height $keyboardHeight -Radius $keyboardRadius

    $borderWidth = [Math]::Max([float]($Size * 0.075), 1.6)
    $keyboardPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(244, 255, 255, 255)), $borderWidth
    $keyboardPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $graphics.DrawPath($keyboardPen, $keyboardPath)

    $keyBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(244, 255, 255, 255))
    $keyHeight = [float]($Size * 0.068)
    $keyRadius = [Math]::Max([float]($Size * 0.018), 1.0)
    $rowStarts = @(
        ($keyboardX + ($Size * 0.08)),
        ($keyboardX + ($Size * 0.12)),
        ($keyboardX + ($Size * 0.16))
    )
    $rowWidths = @(
        [float]($Size * 0.072),
        [float]($Size * 0.072),
        [float]($Size * 0.22)
    )
    $rowCounts = @(5, 4, 1)
    $gap = [float]($Size * 0.028)
    $rowY = @(
        ($keyboardY + ($Size * 0.09)),
        ($keyboardY + ($Size * 0.17)),
        ($keyboardY + ($Size * 0.255))
    )

    for ($row = 0; $row -lt $rowCounts.Length; $row++) {
        for ($i = 0; $i -lt $rowCounts[$row]; $i++) {
            $x = $rowStarts[$row] + (($rowWidths[$row] + $gap) * $i)
            $keyPath = New-RoundedRectPath -X $x -Y $rowY[$row] -Width $rowWidths[$row] -Height $keyHeight -Radius $keyRadius
            $graphics.FillPath($keyBrush, $keyPath)
            $keyPath.Dispose()
        }
    }

    $accentWidth = [Math]::Max([float]($Size * 0.10), 2.0)
    $accentHeight = [Math]::Max([float]($Size * 0.03), 1.0)
    $accentY = $keyboardY + $keyboardHeight + ($Size * 0.08)
    $accentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 214, 232, 255))
    $graphics.FillEllipse($accentBrush, $Size * 0.30, $accentY, $accentWidth, $accentHeight)
    $graphics.FillEllipse($accentBrush, $Size * 0.60, $accentY, $accentWidth, $accentHeight)

    $pngPath = Join-Path $tempDir ("icon-{0}.png" -f $Size)
    $bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $accentBrush.Dispose()
    $keyBrush.Dispose()
    $keyboardPen.Dispose()
    $highlightBrush.Dispose()
    $highlightPath.Dispose()
    $gradient.Dispose()
    $framePath.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()

    return $pngPath
}

if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

$pngPaths = foreach ($size in $sizes) {
    Draw-IntentoIcon -Size $size
}

$icoPath = Join-Path $outputDir 'Keyboard-intento.ico'
$iconFallbackPath = Join-Path $outputDir 'icon.ico'
$pngJson = (($pngPaths | ForEach-Object { $_.Replace('\', '/') }) | ConvertTo-Json -Compress)
$icoPathJs = $icoPath.Replace('\', '/')
$iconFallbackPathJs = $iconFallbackPath.Replace('\', '/')

$nodeScript = @"
const fs = require('fs');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;

(async () => {
  const paths = $pngJson;
  const ico = await pngToIco(paths);
  fs.writeFileSync('$icoPathJs', ico);
  fs.writeFileSync('$iconFallbackPathJs', ico);
})();
"@

$nodeScript | node -
if ($LASTEXITCODE -ne 0) {
    throw "png-to-ico conversion failed."
}
Write-Output "Wrote $icoPath"
Write-Output "Wrote $iconFallbackPath"
