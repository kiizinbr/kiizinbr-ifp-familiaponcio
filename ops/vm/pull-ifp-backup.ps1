# Puxa o backup mais recente do banco da VM IFP-APP pro host Windows (copia off-VM).
# Roda no HOST. Agende DEPOIS do backup da VM (cron 03:30) -> ex.: 04:00.
# Registro do agendamento (rode 1x, como Administrador, dono da chave SSH):
#   schtasks /Create /TN "IFP-Backup-Pull" /SC DAILY /ST 04:00 /RU Administrador /RP * `
#     /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Dev\ifp\pull-ifp-backup.ps1"
# (a chave em C:\Users\Administrador\.ssh\ifp_app precisa estar acessivel ao usuario da task)

$ErrorActionPreference = 'Stop'
$key = 'C:\Users\Administrador\.ssh\ifp_app'
$vm  = 'erickramos@192.168.1.162'
$dst = 'C:\Backups\ifp'
$keep = 30   # quantos dumps manter no host

New-Item -ItemType Directory -Force -Path $dst | Out-Null

# nome do dump CIFRADO mais recente na VM (.sql.gz.age — a chave fica SO na VM)
$latest = ssh -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $vm 'ls -1t /opt/ifp-connect/backups/ifp_connect-*.sql.gz.age 2>/dev/null | head -1'
if (-not $latest) { Write-Error 'Nenhum backup .age encontrado na VM'; exit 1 }

scp -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new ("{0}:{1}" -f $vm, $latest.Trim()) $dst
Write-Output ("baixado: " + (Split-Path $latest -Leaf))

# retencao no host
Get-ChildItem $dst -Filter 'ifp_connect-*.sql.gz.age' |
  Sort-Object LastWriteTime -Descending | Select-Object -Skip $keep | Remove-Item -Force
