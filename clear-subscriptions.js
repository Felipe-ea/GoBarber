const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'gobarber.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🧹 Limpando subscriptions antigas...');

db.run('DELETE FROM subscriptions', [], function(err) {
  if (err) {
    console.error('❌ Erro ao limpar:', err.message);
  } else {
    console.log(`✅ ${this.changes} subscription(s) removida(s)`);
    console.log('📝 Agora você pode clicar em "Ativar Notificações" novamente para criar uma nova subscription válida.');
  }
  db.close();
});
