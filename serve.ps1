param(
  [int]$Port = 3000,
  [string]$Root = "public"
)
$prefix = "http://localhost:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Static server running at $prefix"

function Send-File($context, $path) {
  if (!(Test-Path $path)) {
    $context.Response.StatusCode = 404
    $buffer = [Text.Encoding]::UTF8.GetBytes('{"error":"Not Found"}')
    $context.Response.OutputStream.Write($buffer,0,$buffer.Length)
    $context.Response.Close()
    return
  }
  $ext = [System.IO.Path]::GetExtension($path).ToLower()
  $type = "text/plain"
  if ($ext -eq ".html") { $type = "text/html" }
  elseif ($ext -eq ".css") { $type = "text/css" }
  elseif ($ext -eq ".js") { $type = "application/javascript" }
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $context.Response.Headers.Add("Content-Type", $type)
  $context.Response.OutputStream.Write($bytes,0,$bytes.Length)
  $context.Response.Close()
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $req = $context.Request
  $res = $context.Response
  $res.Headers.Add("Access-Control-Allow-Origin","*")
  $res.Headers.Add("Access-Control-Allow-Headers","Content-Type, Authorization")
  $res.Headers.Add("Access-Control-Allow-Methods","GET,POST,PUT,DELETE,OPTIONS")

  if ($req.HttpMethod -eq "OPTIONS") { $res.StatusCode = 204; $res.Close(); continue }

  if ($req.RawUrl.StartsWith("/api/")) {
    $res.StatusCode = 501
    $buffer = [Text.Encoding]::UTF8.GetBytes('{"error":"API not available in static preview"}')
    $res.OutputStream.Write($buffer,0,$buffer.Length)
    $res.Close()
    continue
  }

  $localPath = if ($req.RawUrl -eq "/") { Join-Path $Root "index.html" } else { Join-Path $Root ($req.RawUrl.TrimStart('/')) }
  Send-File $context $localPath
}