# Script de testes para GoBarber API
$baseUrl = "http://localhost:3000"

Write-Host "`n🧪 Testando GoBarber API" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# Teste 1: GET /api/clients
Write-Host "`n📋 Teste 1: Listar clientes" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/clients" -Method Get
    Write-Host "✅ Clientes encontrados: $($response.Count)" -ForegroundColor Green
    if ($response.Count -gt 0) {
        Write-Host "   Exemplo: $($response[0].name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste 2: GET /api/preferences
Write-Host "`n⚙️  Teste 2: Buscar preferências" -ForegroundColor Yellow
try {
    $prefs = Invoke-RestMethod -Uri "$baseUrl/api/preferences" -Method Get
    Write-Host "✅ Preferências carregadas:" -ForegroundColor Green
    Write-Host "   Frequência: $($prefs.notify_frequency)" -ForegroundColor Gray
    Write-Host "   Horário: $($prefs.notify_time)" -ForegroundColor Gray
    $bdayIcon = if ($prefs.notify_birthdays -eq 1) { "Sim" } else { "Não" }
    $cut15Icon = if ($prefs.notify_no_cut_15 -eq 1) { "Sim" } else { "Não" }
    $cut30Icon = if ($prefs.notify_no_cut_30 -eq 1) { "Sim" } else { "Não" }
    Write-Host "   Aniversários: $bdayIcon" -ForegroundColor Gray
    Write-Host "   Alerta 15d: $cut15Icon" -ForegroundColor Gray
    Write-Host "   Alerta 30d: $cut30Icon" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste 3: POST /api/clients (criar cliente de teste)
Write-Host "`n➕ Teste 3: Criar cliente de teste" -ForegroundColor Yellow
try {
    $newClient = @{
        name = "Cliente Teste $(Get-Random -Maximum 1000)"
        phone = "11987654321"
        birthday = "1990-05-15"
        lastCut = (Get-Date).AddDays(-20).ToString("yyyy-MM-dd")
    } | ConvertTo-Json
    
    $created = Invoke-RestMethod -Uri "$baseUrl/api/clients" -Method Post -Body $newClient -ContentType "application/json"
    Write-Host "✅ Cliente criado com ID: $($created.id)" -ForegroundColor Green
    $testClientId = $created.id
    
    # Teste 4: PUT /api/clients/:id (atualizar)
    Write-Host "`n✏️  Teste 4: Atualizar cliente" -ForegroundColor Yellow
    $updateClient = @{
        name = "Cliente Atualizado"
        phone = "11999999999"
        birthday = "1990-05-15"
        lastCut = (Get-Date).ToString("yyyy-MM-dd")
    } | ConvertTo-Json
    
    $updated = Invoke-RestMethod -Uri "$baseUrl/api/clients/$testClientId" -Method Put -Body $updateClient -ContentType "application/json"
    Write-Host "✅ Cliente atualizado: $($updated.name)" -ForegroundColor Green
    
    # Teste 5: DELETE /api/clients/:id
    Write-Host "`nTeste 5: Deletar cliente" -ForegroundColor Yellow
    $deleted = Invoke-RestMethod -Uri "$baseUrl/api/clients/$testClientId" -Method Delete
    Write-Host "✅ Cliente deletado com sucesso" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste 6: PUT /api/preferences (atualizar configurações)
Write-Host "`n🔧 Teste 6: Atualizar preferências" -ForegroundColor Yellow
try {
    $newPrefs = @{
        notify_frequency = "daily"
        notify_time = "10:00"
        notify_birthdays = 1
        notify_no_cut_15 = 1
        notify_no_cut_30 = 1
    } | ConvertTo-Json
    
    $updatedPrefs = Invoke-RestMethod -Uri "$baseUrl/api/preferences" -Method Put -Body $newPrefs -ContentType "application/json"
    Write-Host "✅ Preferências atualizadas com sucesso" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste 7: POST /api/notifications/trigger (disparar notificações)
Write-Host "`n🔔 Teste 7: Disparar verificação de notificações" -ForegroundColor Yellow
try {
    $trigger = Invoke-RestMethod -Uri "$baseUrl/api/notifications/trigger" -Method Post
    Write-Host "✅ Notificações verificadas" -ForegroundColor Green
    Write-Host "   Mensagem: $($trigger.message)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erro: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n" + "=" * 50 -ForegroundColor Gray
Write-Host "✅ Testes concluídos!" -ForegroundColor Green
Write-Host ""
