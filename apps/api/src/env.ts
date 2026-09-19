import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  /** Comma-separated origins allowed to call the API from a browser. */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  /** Signs nothing by itself — used to derive the admin bootstrap and CSRF salt. */
  APP_SECRET: z.string().min(16, 'APP_SECRET must be at least 16 characters'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  /* --- OTP --- */
  OTP_PROVIDER: z.enum(['eldery', 'rastin', 'console']).default('rastin'),
  OTP_BASE_URL: z.string().default('https://otp.eldery.ir'),
  OTP_API_KEY: z.string().default(''),
  RASTIN_SMS_USERNAME: z.string().default('09927802246'),
  RASTIN_SMS_PASSWORD: z.string().default('Parisa7001@'),
  RASTIN_SMS_FROM: z.string().default('9999181644'),
  RASTIN_SMS_URL: z.string().default('https://www.rastinsms.com/APISend.aspx'),
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(5),
  OTP_TTL_SECONDS: z.coerce.number().int().min(30).max(1800).default(180),
  OTP_RESEND_SECONDS: z.coerce.number().int().min(10).max(600).default(60),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  OTP_MAX_PER_HOUR: z.coerce.number().int().min(1).max(50).default(6),

  /* --- Storage (local disk today, S3 adapter can drop in later) --- */
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_ROOT: z.string().default('./storage'),
  /** Public base the browser uses to fetch uploads; the API serves it itself by default. */
  STORAGE_PUBLIC_URL: z.string().default('/uploads'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().min(1024).default(15 * 1024 * 1024),

  /* --- Google Sheets --- */
  SHEETS_ENABLED: bool.default(false),
  SHEETS_SPREADSHEET_ID: z.string().default(''),
  /** Path to the service-account JSON, or the JSON itself in SHEETS_CREDENTIALS_JSON. */
  SHEETS_CREDENTIALS_FILE: z.string().default('./service-account.json'),
  SHEETS_CREDENTIALS_JSON: z.string().default(''),
  SHEETS_SYNC_INTERVAL_SECONDS: z.coerce.number().int().min(0).max(86400).default(300),
  /** Push orders and users up to the sheet too, not just the catalogue. */
  SHEETS_SYNC_PRIVATE_DATA: bool.default(true),

  /** Bootstrap admin — the first phone number that may enter /admin. */
  ADMIN_PHONES: z.string().default(''),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TRUST_PROXY: bool.default(false),

  /* --- CRM Integration --- */
  CRM_API_BASE: z.string().default(''),
  CRM_API_KEY: z.string().default(''),
  CRM_BUSINESS_ID: z.coerce.number().int().min(1).default(1),
  CRM_WEBHOOK_SECRET: z.string().default(''),
  CRM_SYNC_ENABLED: bool.default(true),
  CRM_SYNC_DEBOUNCE_MS: z.coerce.number().int().min(0).default(500),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`\nInvalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill it in.\n`);
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const adminPhones = env.ADMIN_PHONES.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
