import { readFile } from 'node:fs/promises';
import { google, type sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { env } from '../../env.js';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let cached: sheets_v4.Sheets | null = null;

async function loadCredentials(): Promise<{ client_email: string; private_key: string }> {
  const str = env.SHEETS_CREDENTIALS_JSON.trim();
  if (str.startsWith('{')) {
    return JSON.parse(str);
  }
  const filePath = str || env.SHEETS_CREDENTIALS_FILE;
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}


export async function sheetsClient(): Promise<sheets_v4.Sheets> {
  if (cached) return cached;
  const creds = await loadCredentials();
  const auth = new JWT({
    email: creds.client_email,
    // Keys pasted into .env arrive with literal \n sequences.
    key: creds.private_key.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  });
  await auth.authorize();
  cached = google.sheets({ version: 'v4', auth });
  return cached;
}

/** Reads a whole tab. Returns `[]` when the tab does not exist yet. */
export async function readTab(title: string): Promise<string[][]> {
  const api = await sheetsClient();
  try {
    const res = await api.spreadsheets.values.get({
      spreadsheetId: env.SHEETS_SPREADSHEET_ID,
      range: `${title}!A1:ZZ`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });
    return (res.data.values ?? []).map((row) => row.map((cell) => (cell == null ? '' : String(cell))));
  } catch (err: any) {
    if (err?.code === 400 || err?.response?.status === 400) return [];
    throw err;
  }
}

/** Replaces a tab's contents in one request; creates the tab when missing. */
export async function writeTab(title: string, rows: string[][]): Promise<void> {
  const api = await sheetsClient();
  await ensureTab(title);
  await api.spreadsheets.values.clear({
    spreadsheetId: env.SHEETS_SPREADSHEET_ID,
    range: `${title}!A1:ZZ`,
  });
  if (rows.length === 0) return;
  await api.spreadsheets.values.update({
    spreadsheetId: env.SHEETS_SPREADSHEET_ID,
    range: `${title}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
}

export async function ensureTab(title: string): Promise<void> {
  const api = await sheetsClient();
  const meta = await api.spreadsheets.get({ spreadsheetId: env.SHEETS_SPREADSHEET_ID });
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === title);
  if (exists) return;
  await api.spreadsheets.batchUpdate({
    spreadsheetId: env.SHEETS_SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title, rightToLeft: true } } }] },
  });
}

export function resetSheetsClient(): void {
  cached = null;
}
