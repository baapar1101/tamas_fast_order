const http = require('http');
const data = JSON.stringify({ phone: '09901046596' });

const req = http.request('http://localhost:3001/api/auth/otp/request', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', body));
});

req.on('error', err => console.log('ERR:', err.message));
req.write(data);
req.end();
