/** Read-only by default. Copy+verify before pointer updates; never discard a document. */
import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { closeDb, sql } from '../src/db/client.js';
import { env } from '../src/env.js';
import { confinedFilePath, privateFileUrl, type PrivateFileScope } from '../src/lib/private-files.js';
import { localUploadKey } from '../src/services/private-files.js';
import { ensurePrivateStorage, privateStorageRoot } from '../src/services/private-storage.js';

type Upload = { id: number; kind: string; storage_key: string; thumb_key: string | null; uploaded_by: number | null; private_scope: PrivateFileScope | null; private_owner_id: number | null };
type Reference = { table_name: string; column_name: string; id: number; owner: number; value: string; scope: PrivateFileScope };
const hash = (content: Buffer) => createHash('sha256').update(content).digest('hex');
const urlPattern = /(?:https?:\/\/[^\s"'<>\\]+)?\/uploads\/[A-Za-z0-9_./%-]+/g;
const write = process.argv.includes('--write');
const publicRoot = resolve(env.STORAGE_ROOT);

async function main() {
  const [column] = await sql`select count(*) n from information_schema.columns where table_schema='public' and table_name='uploads' and column_name='private_scope'`;
  const hasColumns = Number(column!.n) === 1;
  if (write && !hasColumns) throw new Error('Apply database migrations before --write');
  const references = await sql<Reference[]>`
    select 'credit_applications' table_name, 'national_card_url' column_name,id,user_id owner,national_card_url value,'credit' scope from credit_applications
    union all select 'credit_applications','business_docs_url',id,user_id,business_docs_url,'credit' from credit_applications
    union all select 'credit_applications','check_image_url',id,user_id,check_image_url,'credit' from credit_applications
    union all select 'credit_applications','bank_statement_url',id,user_id,bank_statement_url,'credit' from credit_applications where bank_statement_url is not null
    union all select 'credit_report_snapshots','file_url',id,user_id,file_url,'credit' from credit_report_snapshots
    union all select 'credit_cheques','image_url',id,user_id,image_url,'credit' from credit_cheques where image_url is not null
    union all select 'installment_receipts','receipt_url',id,user_id,receipt_url,'payment' from installment_receipts
    union all select 'users','certificate_file_url',id,id,certificate_file_url,'credit' from users where certificate_file_url <> ''
    union all select 'orders','note',id,user_id,note,'payment' from orders where note like '%/uploads/%'
  `;
  const publicValues = await sql<{ value: string }[]>`
    select image_url value from products where image_url is not null
    union all select gallery::text from products
    union all select icon_url from brands where icon_url is not null
    union all select icon_url from categories where icon_url is not null
    union all select image_url from slides
    union all select mobile_image_url from slides where mobile_image_url is not null
    union all select value from settings where key in ('hero_image')
  `;
  const publicKeys = new Set(publicValues.flatMap((row) => [...(row.value.match(urlPattern) ?? [])].map(localUploadKey).filter((key): key is string => key !== null)));
  const rows = hasColumns
    ? await sql<Upload[]>`select id,kind,storage_key,thumb_key,uploaded_by,private_scope,private_owner_id from uploads order by id`
    : await sql<Upload[]>`select id,kind,storage_key,thumb_key,uploaded_by,null::varchar private_scope,null::integer private_owner_id from uploads order by id`;
  const byKey = new Map(rows.flatMap((row) => [row.storage_key, row.thumb_key].filter((key): key is string => Boolean(key)).map((key) => [key, row] as const)));
  const owners = new Map<Upload, Set<number>>();
  const scopes = new Map<Upload, PrivateFileScope>();
  const referenceKeys = new Map<Reference, Array<{ value: string; key: string }>>();
  let external = 0;
  for (const reference of references) {
    if (reference.value.startsWith('/api/files/')) continue;
    const values = reference.column_name === 'note' ? reference.value.match(urlPattern) ?? [] : [reference.value];
    const keys: Array<{ value: string; key: string }> = [];
    for (const value of values) {
      const key = localUploadKey(value);
      if (!key) { if (value) external += 1; continue; }
      keys.push({ value, key });
      let row = byKey.get(key);
      if (!row) {
        // Preserve local legacy files which predate the uploads table.
        row = { id: 0, kind: 'other', storage_key: key, thumb_key: null, uploaded_by: reference.owner, private_scope: null, private_owner_id: null };
        rows.push(row); byKey.set(key, row);
      }
      const set = owners.get(row) ?? new Set<number>(); set.add(reference.owner); owners.set(row, set);
      if (reference.scope === 'credit' || !scopes.has(row)) scopes.set(row, reference.scope);
    }
    referenceKeys.set(reference, keys);
  }
  const candidates = rows.filter((row) => row.private_scope || owners.has(row) || row.kind === 'certificate' ||
    (row.kind === 'other' && !publicKeys.has(row.storage_key) && !publicKeys.has(row.thumb_key ?? '')));
  for (const row of candidates) {
    if ((owners.get(row)?.size ?? 0) > 1) throw new Error(`Multiple document owners for upload ${row.id}; migration stopped`);
    if (publicKeys.has(row.storage_key) || (row.thumb_key && publicKeys.has(row.thumb_key))) throw new Error(`Private/public reference conflict for upload ${row.id}; migration stopped`);
  }
  // Plan every source before changing anything; missing referenced files must not be hidden.
  const files = new Map<string, { source: string | null; destination: string; checksum: string; size: number }>();
  for (const row of candidates) {
    for (const key of [row.storage_key, row.thumb_key].filter((item): item is string => Boolean(item))) {
      const destination = confinedFilePath(privateStorageRoot, key);
      let source: string | null = null;
      for (const root of [publicRoot, resolve('../web/public/uploads'), resolve('../web/dist/uploads')]) {
        const path = confinedFilePath(root, key);
        if (await stat(path).then((info) => info.isFile()).catch(() => false)) { source = path; break; }
      }
      const content = await readFile(source ?? destination).catch(() => { throw new Error(`Missing file for upload ${row.id}; no changes applied`); });
      files.set(key, { source, destination, checksum: hash(content), size: content.length });
    }
  }
  console.log(JSON.stringify({ mode: write ? 'write' : 'dry-run', uploads: candidates.length, files: files.size, references: references.length, externalReferences: external }));
  if (!write) return;
  await ensurePrivateStorage();
  const backupRoot = resolve('.private/document-migrations');
  await mkdir(backupRoot, { recursive: true, mode: 0o700 });
  const manifest = resolve(backupRoot, `before-${Date.now()}.json`);
  await writeFile(manifest, JSON.stringify({ references, uploads: candidates, files: [...files] }), { mode: 0o600, flag: 'wx' });
  for (const item of files.values()) {
    await mkdir(dirname(item.destination), { recursive: true, mode: 0o700 });
    if (item.source) {
      const exists = await stat(item.destination).then(() => true).catch(() => false);
      if (!exists) await copyFile(item.source, item.destination);
    }
    if (hash(await readFile(item.destination)) !== item.checksum) throw new Error('Private copy checksum mismatch; database untouched');
    await chmod(item.destination, 0o600);
  }
  await sql.begin(async (tx) => {
    for (const row of candidates) {
      const scope = row.private_scope === 'credit' || scopes.get(row) === 'credit' ? 'credit' : scopes.get(row) ?? row.private_scope ?? 'credit';
      const owner = [...(owners.get(row) ?? [])][0] ?? row.private_owner_id ?? row.uploaded_by;
      if (row.id === 0) {
        const item = files.get(row.storage_key)!;
        const mime = row.storage_key.endsWith('.pdf') ? 'application/pdf' : row.storage_key.endsWith('.webp') ? 'image/webp' : 'application/octet-stream';
        const [inserted] = await tx`insert into uploads (kind,storage_key,original_name,mime_type,size,checksum,uploaded_by,private_scope,private_owner_id)
          values ('other',${row.storage_key},'legacy-document',${mime},${item.size},${item.checksum},${row.uploaded_by},${scope},${owner}) returning id`;
        row.id = Number(inserted!.id);
      } else {
        await tx`update uploads set private_scope=${scope},private_owner_id=${owner} where id=${row.id}`;
      }
    }
    for (const [reference, keys] of referenceKeys) {
      let value = reference.value;
      for (const item of keys) value = value.replaceAll(item.value, privateFileUrl(byKey.get(item.key)!.id, item.key === byKey.get(item.key)!.thumb_key));
      if (value !== reference.value) {
        await tx`update ${tx(reference.table_name)} set ${tx(reference.column_name)}=${value} where id=${reference.id} and ${tx(reference.column_name)}=${reference.value}`;
      }
    }
  });
  // Recoverable move: verified private copies and protected before-state remain.
  // Only remove the identical originals within the explicit public storage root.
  let moved = 0;
  for (const [key, item] of files) {
    const original = confinedFilePath(publicRoot, key);
    const originalContent = await readFile(original).catch(() => null);
    if (originalContent) {
      if (hash(originalContent) !== item.checksum) throw new Error('Public source changed during migration; cleanup stopped');
      await unlink(original); moved += 1;
    }
  }
  console.log(JSON.stringify({ migrated: candidates.length, moved, manifest, privateStorageRoot }));
}

main().then(closeDb).catch(async (error) => { console.error(error.message); await closeDb(); process.exitCode = 1; });
