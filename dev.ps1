# Sobe o IFP Connect (web :3000 + API :3333) carregando o .env da raiz.
# Uso: abra o PowerShell nesta pasta e rode  .\dev.ps1
# Deixe a janela aberta — o sistema fica no ar enquanto ela estiver aberta
# (independente do Claude). Ctrl+C para parar.
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# carrega as variaveis do .env da raiz no ambiente (a API NestJS depende delas)
Get-Content "$root\.env" | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
    Set-Item -Path ("env:" + $matches[1].Trim()) -Value $matches[2].Trim().Trim('"')
  }
}
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'

Write-Host "Subindo IFP Connect..." -ForegroundColor Green
Write-Host "  web -> http://localhost:3000   |   API -> http://localhost:3333/api/v1" -ForegroundColor DarkGray
Write-Host "  (deixe esta janela aberta; Ctrl+C para parar)" -ForegroundColor DarkGray
Set-Location $root
pnpm dev
