$file = 'src\app\admin\projects\[id]\page.tsx'
$c = [IO.File]::ReadAllText($file, [Text.Encoding]::UTF8)
$c = $c.Replace('11 页图片', '页面图片')
[IO.File]::WriteAllText($file, $c, [Text.Encoding]::UTF8)
Write-Host "Done: replaced 11 pages text"
