# Arranca Supabase local (Docker, project_id p06) y aplica supabase\migrations\p06_*.sql (idempotentes).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$sb = 'D:\ClaudeBrain\apps\supabase-cli\supabase.exe'
Set-Location $root
& $sb start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit,storage-api,postgres-meta
Get-ChildItem "$root\supabase\migrations\p06_*.sql" | Sort-Object Name | ForEach-Object {
  Write-Host "aplicando $($_.Name)"
  Get-Content -Raw -Encoding UTF8 $_.FullName | docker exec -i supabase_db_p06 psql -U postgres -v ON_ERROR_STOP=1 -q
  if ($LASTEXITCODE -ne 0) { throw "fallo en $($_.Name)" }
}
