const { Client } = require('pg');
async function run() {
  const c = new Client('postgres://postgres:postgres@localhost:5432/tamas');
  await c.connect();
  const res = await c.query("SELECT value FROM settings WHERE key = 'crm'");
  const config = res.rows[0].value;
  const url = config.apiBase.replace(/\/$/, '') + '/api/v1/crm/businesses/' + config.businessId + '/chat/conversations';
  console.log('Fetching', url);
  const data = await fetch(url, { headers: { 'Authorization': 'ApiKey ' + config.apiKey } }).then(r => r.json());
  console.log(JSON.stringify(data.items?.[0] || data.data?.[0] || data[0] || data, null, 2));
  await c.end();
}
run();
