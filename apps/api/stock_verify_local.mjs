import postgres from 'postgres';
const sql = postgres('postgres://tamas:Parisa70011007@127.0.0.1:5432/tamas');

// snapshot product 1 stock fields
const [before] = await sql`select kerman_stock, tehran_stock, stock from products where id=1`;
console.log('BEFORE:', JSON.stringify(before));

// make it sellable via DB (price + active + per-warehouse stock)
await sql`update products set price=1000000, status='active', stock=10, kerman_stock=5, tehran_stock=5 where id=1`;

const token = (await import('node:fs')).default.readFileSync('C:/Users/Albert/AppData/Local/Temp/opencode/admin_token.txt', 'utf8').trim();
const API = 'http://127.0.0.1:3001/api';

async function api(method, path, body) {
  const res = await fetch(API + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

// ensure profile complete so order can be placed
await api('PUT', '/auth/profile', { name: 'کاربر', lastName: 'تست', storeName: 'فروشگاه تست', address: 'کرمان', landline: '', postalCode: '', certificateFileUrl: '', activity: '', pageWebsite: '' });

const created = await api('POST', '/orders', { items: [{ productId: '1', warehouse: 'kerman', qty: 2 }], address: 'کرمان تست', paymentMethod: 'card-to-card' });
console.log('CREATE order:', created.status, created.json?.order?.orderCode);

const [after] = await sql`select kerman_stock, tehran_stock, stock from products where id=1`;
console.log('AFTER :', JSON.stringify(after));

// restore product 1
await sql`update products set price=0, status='active', stock=${before.stock}, kerman_stock=${before.kerman_stock}, tehran_stock=${before.tehran_stock} where id=1`;

// delete the test order + its payment row (restore DB shape)
const orderId = created.json?.order?.id;
if (orderId) {
  await sql`delete from payments where order_id=${orderId}`;
  await sql`delete from orders where id=${orderId}`;
}

// restore profile via API
await api('PUT', '/auth/profile', {});
console.log('PAYMENT ROW for test order (before delete):', orderId);
await sql.end();