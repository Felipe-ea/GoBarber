const http = require('http');

function callNotify(clientId){
  const data = JSON.stringify({ clientId });
  const options = {
    hostname: 'localhost',
    port: process.env.PORT || 3000,
    path: '/api/notifyClient',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };
  const req = http.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('Response:', res.statusCode, body);
    });
  });
  req.on('error', e => console.error('Request error', e));
  req.write(data);
  req.end();
}

// Usage: node scripts/trigger_notify.js [clientId]
const clientId = process.argv[2] || null;
callNotify(clientId);
