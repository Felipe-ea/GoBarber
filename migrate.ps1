# Script de migração para arquivos refatorados
# Cria backup dos arquivos originais e ativa os novos

Write-Host "🔄 Iniciando migração..." -ForegroundColor Cyan

# Criar pasta de backup
$backupDir = "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backupDir -ErrorAction SilentlyContinue | Out-Null
Write-Host "📦 Pasta de backup criada: $backupDir" -ForegroundColor Green

# Fazer backup dos arquivos originais
$files = @(
  "server.js",
  "index.html", 
  "style.css",
  "app.js"
)

foreach ($file in $files) {
  if (Test-Path $file) {
    Copy-Item $file "$backupDir/$file" -Force
    Write-Host "✅ Backup: $file" -ForegroundColor Gray
  }
}

Write-Host "`n🔄 Substituindo arquivos..." -ForegroundColor Cyan

# Renomear arquivos novos
if (Test-Path "server-new.js") {
  Copy-Item "server.js" "$backupDir/server.js" -Force -ErrorAction SilentlyContinue
  Move-Item "server-new.js" "server.js" -Force
  Write-Host "✅ server.js atualizado" -ForegroundColor Green
}

if (Test-Path "index-new.html") {
  Copy-Item "index.html" "$backupDir/index.html" -Force -ErrorAction SilentlyContinue
  Move-Item "index-new.html" "index.html" -Force
  Write-Host "✅ index.html atualizado" -ForegroundColor Green
}

if (Test-Path "style-new.css") {
  Copy-Item "style.css" "$backupDir/style.css" -Force -ErrorAction SilentlyContinue
  Move-Item "style-new.css" "style.css" -Force
  Write-Host "✅ style.css atualizado" -ForegroundColor Green
}

if (Test-Path "app-new.js") {
  Copy-Item "app.js" "$backupDir/app.js" -Force -ErrorAction SilentlyContinue
  Move-Item "app-new.js" "app.js" -Force
  Write-Host "✅ app.js atualizado" -ForegroundColor Green
}

# Atualizar Service Worker cache
Write-Host "`n🔄 Atualizando cache do Service Worker..." -ForegroundColor Cyan
(Get-Content "sw.js") -replace '/index-new.html', '/index.html' `
                       -replace '/style-new.css', '/style.css' `
                       -replace '/app-new.js', '/app.js' `
                       | Set-Content "sw.js"
Write-Host "✅ sw.js atualizado" -ForegroundColor Green

Write-Host "`n✅ Migração concluída com sucesso!" -ForegroundColor Green
Write-Host "📁 Backup disponível em: $backupDir" -ForegroundColor Yellow
Write-Host "`n🚀 Para iniciar o servidor:" -ForegroundColor Cyan
Write-Host "   node server.js" -ForegroundColor White
