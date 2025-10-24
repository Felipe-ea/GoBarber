# 🔍 Diagnóstico de Notificações Push - GoBarber

## ✅ Mudanças aplicadas

### Backend (`notificationService.js`)
- ✅ Logs detalhados ao enviar notificações
- ✅ Log do payload enviado
- ✅ Log do status de cada subscription
- ✅ Remoção automática de subscriptions inválidas (404/410)

### Service Worker (`sw.js`)
- ✅ Logs quando recebe evento push
- ✅ Logs ao mostrar notificação
- ✅ Cache atualizado para v4

### Frontend (`app.js`)
- ✅ Logs no console ao clicar no botão
- ✅ Feedback detalhado no alert (quantos dispositivos receberam)
- ✅ Instruções de diagnóstico no alert

### Limpeza
- ✅ Script `clear-subscriptions.js` para limpar banco

---

## 🚀 Passo a passo para testar AGORA

### 1️⃣ Recarregue a página (IMPORTANTE!)
- Pressione **Ctrl+F5** (hard refresh)
- Ou feche e reabra a aba
- Isso garante que o Service Worker v4 seja instalado

### 2️⃣ Abra o Console do navegador
- Pressione **F12**
- Vá na aba **Console**
- **Deixe aberto** para ver os logs em tempo real

### 3️⃣ Ative as notificações
- No app, clique em **"Ativar Notificações"**
- **Aceite a permissão** quando o navegador perguntar
- Você deve ver no console: `✅ Service Worker registered`

### 4️⃣ Envie notificação de teste
- Vá em **Configurações** (⚙️)
- Clique em **"Enviar Notificação de Teste"**
- **Observe o console do navegador** - deve aparecer:
  ```
  🧪 Test notification button clicked
  ✅ Subscription ensured, sending notification...
  📊 Send result: {sent: 1, total: 1, ...}
  ```

### 5️⃣ Observe o terminal do servidor
O servidor agora mostra logs detalhados:
```
📤 Sending notification to 1 subscription(s)
📦 Payload: {"title":"🧪 Teste de Notificação","body":"...","url":"/"}
🔄 Sending to subscription 1...
✅ Successfully sent to subscription 1
📊 Results: 1/1 successful
```

### 6️⃣ Se houver erro
O servidor mostrará:
```
❌ Push error for subscription X: [mensagem] (status: 410)
   Body: [detalhes do erro]
🧹 Removed invalid subscription id=X
```

---

## 🐛 Problemas comuns e soluções

### ❌ Notificação não aparece

#### Causa 1: Permissão negada
**Sintomas:**
- Alert de erro "Permissão de notificação negada"

**Solução:**
1. Clique no ícone de cadeado na barra de endereços
2. Permissões → Notificações → Permitir
3. Recarregue a página
4. Clique em "Ativar Notificações" novamente

#### Causa 2: Service Worker não registrado
**Sintomas:**
- Console não mostra "Service Worker registered"
- Console mostra erro de SW

**Solução:**
1. Vá em F12 → Application → Service Workers
2. Clique em "Unregister"
3. Recarregue a página (Ctrl+F5)
4. Verifique se aparece "gobarber-v4"

#### Causa 3: Subscription expirada (erro 410)
**Sintomas:**
- Terminal mostra: `❌ Push error... (status: 410)`
- Alert diz "0 dispositivos receberam"

**Solução:**
1. Execute: `node clear-subscriptions.js`
2. Recarregue a página
3. Clique em "Ativar Notificações"
4. Teste novamente

#### Causa 4: VAPID mismatch (erro 401/403)
**Sintomas:**
- Terminal mostra: `❌ Push error... (status: 401)` ou `403`

**Solução:**
1. Execute: `node clear-subscriptions.js`
2. Verifique se `key.md` tem chaves válidas
3. Reinicie o servidor
4. Recarregue a página
5. Clique em "Ativar Notificações"

---

## 🔬 Verificações técnicas

### Verificar subscriptions no banco
```powershell
powershell -Command "Invoke-RestMethod -Uri http://localhost:3000/api/notifications/subscriptions"
```

### Verificar chave VAPID pública
```powershell
powershell -Command "Invoke-RestMethod -Uri http://localhost:3000/api/vapidPublic"
```

### Testar envio direto (bypassa frontend)
```powershell
$body = @{title='Teste';body='Mensagem';url='/'} | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3000/api/notifications/send -Method Post -Body $body -ContentType 'application/json'
```

---

## 📋 Checklist de diagnóstico

Ao clicar em "Enviar Notificação de Teste", você DEVE ver:

**No Console do Navegador (F12):**
- [ ] `🧪 Test notification button clicked`
- [ ] `✅ Subscription ensured, sending notification...`
- [ ] `📊 Send result: {sent: 1, total: 1}`
- [ ] `🔔 Push event received in Service Worker`
- [ ] `📦 Push data: {...}`
- [ ] `📢 Showing notification: 🧪 Teste de Notificação`
- [ ] `✅ Notification shown successfully`

**No Terminal do Servidor:**
- [ ] `📤 Sending notification to X subscription(s)`
- [ ] `📦 Payload: {...}`
- [ ] `🔄 Sending to subscription X...`
- [ ] `✅ Successfully sent to subscription X`
- [ ] `📊 Results: 1/1 successful`

**Se TODOS os checks acima passarem mas a notificação não aparecer:**
- Verifique configurações de foco do Windows (Assistente de Foco)
- Verifique se notificações do Chrome estão bloqueadas no Windows
- Tente em modo anônimo ou outro navegador

---

## 💡 Comandos úteis

### Limpar tudo e começar do zero
```bash
node clear-subscriptions.js
```

### Ver Service Worker ativo
1. F12 → Application → Service Workers
2. Deve mostrar "gobarber-v4" com status "activated"

### Forçar atualização do Service Worker
1. F12 → Application → Service Workers
2. Marque "Update on reload"
3. Recarregue a página

---

## 📞 Se nada funcionar

Me envie os seguintes dados:

1. **Console do navegador completo** (copie tudo após clicar no botão)
2. **Terminal do servidor completo** (copie as linhas que aparecem)
3. **Resultado do comando:**
   ```powershell
   powershell -Command "Invoke-RestMethod -Uri http://localhost:3000/api/notifications/subscriptions"
   ```
4. **Permissões do navegador:**
   - Chrome: chrome://settings/content/notifications
   - Procure por "localhost:3000" e me diga se está "Permitido" ou "Bloqueado"

Com essas informações eu identifico o problema exato! 🔍
