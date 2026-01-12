# Script para reiniciar el servidor backend
Write-Host "🔄 Reiniciando servidor backend..." -ForegroundColor Cyan

# Buscar y detener procesos de Node.js que usen el puerto 3000
Write-Host "`n1. Deteniendo procesos en el puerto 3000..." -ForegroundColor Yellow
$processes = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    foreach ($pid in $processes) {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "   Deteniendo proceso: $($proc.ProcessName) (PID: $pid)"
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 2
    Write-Host "✅ Procesos detenidos" -ForegroundColor Green
} else {
    Write-Host "   No hay procesos usando el puerto 3000" -ForegroundColor Gray
}

# Regenerar cliente de Prisma
Write-Host "`n2. Regenerando cliente de Prisma..." -ForegroundColor Yellow
Set-Location "C:\Users\enzog\Desktop\TICKETING\backend"
npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cliente de Prisma regenerado" -ForegroundColor Green
} else {
    Write-Host "⚠️  Hubo un problema al regenerar Prisma, pero continuando..." -ForegroundColor Yellow
}

Write-Host "`n✅ Listo. Ahora puedes iniciar el servidor con: npm run dev" -ForegroundColor Green






