# Borra los datos locales y vuelve a aplicar las migraciones p06_*.sql
$root = Split-Path -Parent $PSScriptRoot
$sql = "drop table if exists public.p06_habit_logs, public.p06_habits, public.p06_entries cascade; delete from auth.users;"
$sql | docker exec -i supabase_db_p06 psql -U postgres -q
Get-ChildItem "$root\supabase\migrations\p06_*.sql" | Sort-Object Name | ForEach-Object {
  Get-Content -Raw -Encoding UTF8 $_.FullName | docker exec -i supabase_db_p06 psql -U postgres -v ON_ERROR_STOP=1 -q
}
