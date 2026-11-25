import { eq } from 'drizzle-orm';
import {
  isValidJalaliDate,
  normalizeJalaliDate,
  normalizeLandline,
  toAsciiDigits,
  type ProfileWrite,
  type UserDTO,
} from '@tamas/shared';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { env } from '../env.js';
import { crmClient } from '../lib/crm.js';
import { AppError, badRequest } from '../lib/errors.js';
import { missingProfileFields, toUserDTO, type UserRow } from './auth.js';
import { claimPrivateFile } from './private-files.js';
import { ZohalClient, ZohalError } from './zohal.js';

interface ProfileLog {
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

/**
 * Saves the customer's own profile (name, store, address, business licence…).
 * Shared by `PUT /auth/profile` and the customer bot. `current` is updated in
 * place when the database is unreachable in development, as before.
 */
export async function saveCustomerProfile(current: UserRow, body: ProfileWrite, log?: ProfileLog) {
  if (body.certificateFileUrl && (body.certificateFileUrl !== current.certificateFileUrl || body.certificateFileUrl.startsWith('/'))) {
    body.certificateFileUrl = await claimPrivateFile(body.certificateFileUrl, current.id, 'credit');
  }

  let updatedUser: UserDTO;
  try {
    const [updated] = await db
            .update(users)
            .set({
              name: body.name,
              lastName: body.lastName,
              storeName: body.storeName,
              landline: normalizeLandline(body.landline),
              address: body.address,
              postalCode: normalizeLandline(body.postalCode),
              certificateFileUrl: body.certificateFileUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.id, current.id))
            .returning();
          updatedUser = toUserDTO(updated || current);

          // Fire-and-forget CRM person sync on profile update
          const { getCrmConfig } = await import('./settings.js');
          getCrmConfig().then(config => crmClient.pushPerson({
            firstName: body.name ?? '',
            lastName: body.lastName ?? '',
            phone: current.phone,
            email: `${current.phone}@tamas.local`,
            aliasName: `${body.name ?? ''} ${body.lastName ?? ''}`.trim() || current.phone,
          }, config)).catch((err: unknown) => {
                        // CRM sync failure shouldn't block profile update
                      });
  } catch {
    current.name = body.name;
    current.lastName = body.lastName;
    current.storeName = body.storeName;
    current.landline = normalizeLandline(body.landline);
    current.address = body.address;
    current.postalCode = normalizeLandline(body.postalCode);
    current.certificateFileUrl = body.certificateFileUrl;
    updatedUser = toUserDTO(current);
  }

  const missing = missingProfileFields({
    ...current,
    name: updatedUser.name,
    lastName: updatedUser.lastName,
    storeName: updatedUser.storeName,
    address: updatedUser.address,
  });

  const [{ sendTelegramNotification }, { telegramActionButtons }] = await Promise.all([
    import('./telegram.js'),
    import('./telegram-operations.js'),
  ]);
  void sendTelegramNotification('user.profile_updated', {
    title: missing.length === 0 ? '👤 پروفایل کاربر تکمیل شد' : '👤 پروفایل کاربر ویرایش شد',
    fields: [
      { label: 'نام', value: `${updatedUser.name} ${updatedUser.lastName}`.trim() },
      { label: 'فروشگاه', value: updatedUser.storeName },
      { label: 'تلفن', value: updatedUser.phone },
      { label: 'وضعیت پروفایل', value: missing.length === 0 ? 'کامل' : 'ناقص' },
    ],
    keyboard: missing.length === 0 && !updatedUser.isActive ? telegramActionButtons.customer(updatedUser.id) : undefined,
  }).catch((err) => log?.error({ err }, 'failed to send Telegram profile notification'));

  return {
    ok: true,
    user: updatedUser,
    complete: missing.length === 0,
    missing,
    message: 'اطلاعات شما ذخیره شد.',
  };
}

/**
 * Optional Zohal identity inquiry: national code + Jalali birth date. A match
 * with no bounced cheques marks the account as identity-verified. Shared by
 * `POST /auth/inquiry-identity` and the customer bot.
 */
export async function verifyCustomerIdentity(
  current: UserRow,
  national_code: string | undefined,
  birth_date: string | undefined,
  log?: ProfileLog,
) {
  const cleanNationalCode = toAsciiDigits(national_code).replace(/\D/g, '');
  const cleanBirthDate = normalizeJalaliDate(birth_date);

  if (!/^\d{10}$/.test(cleanNationalCode) || !isValidJalaliDate(cleanBirthDate)) {
    throw badRequest('برای استعلام اختیاری، کد ملی ۱۰ رقمی و تاریخ تولد شمسی معتبر را وارد کنید. اعداد فارسی و انگلیسی پذیرفته می‌شوند.');
  }

  try {
    const zohal = new ZohalClient({
      token: env.ZOHAL_API_TOKEN,
      baseUrl: env.ZOHAL_API_BASE_URL,
      timeoutMs: env.ZOHAL_TIMEOUT_MS,
    });
    const inquiryBody = await zohal.inquiryIdentity(cleanNationalCode, cleanBirthDate);

    if (!inquiryBody || !inquiryBody.matched) {
      throw badRequest('اطلاعات هویتی با کد ملی و تاریخ تولد واردشده مطابقت ندارد.');
    }

    if (inquiryBody.is_dead || inquiryBody.alive === false) {
      throw badRequest('امکان استعلام و تایید برای این کد ملی وجود ندارد.');
    }

    const chequeData = await zohal.inquiryBouncedCheque(cleanNationalCode);
    const chequeCount = Number(chequeData.count) || 0;

    if (chequeCount > 0) {
      throw badRequest(`کد ملی وارد شده دارای ${chequeCount} چک برگشتی است و امکان تأیید حساب وجود ندارد.`);
    }

    let updatedUser: UserDTO;
    try {
      const [updated] = await db
                .update(users)
                .set({
                  name: inquiryBody.first_name || current.name,
                  lastName: inquiryBody.last_name || current.lastName,
                  fatherName: inquiryBody.father_name || '',
                  nationalCode: cleanNationalCode,
                  birthDate: cleanBirthDate,
                  isVerifiedIdentity: true,
                  updatedAt: new Date(),
                })
                .where(eq(users.id, current.id))
                .returning();
              updatedUser = toUserDTO(updated || current);

              // Fire-and-forget CRM person sync after identity verification
              const { getCrmConfig } = await import('./settings.js');
              getCrmConfig().then(config => crmClient.pushPerson({
                firstName: inquiryBody.first_name || current.name,
                lastName: inquiryBody.last_name || current.lastName,
                phone: current.phone,
                email: `${current.phone}@tamas.local`,
                aliasName: `${inquiryBody.first_name || current.name} ${inquiryBody.last_name || current.lastName}`.trim() || current.phone,
              }, config)).catch((err: unknown) => {
                // CRM sync failure shouldn't block identity verification
              });
    } catch {
      current.name = inquiryBody.first_name || current.name;
      current.lastName = inquiryBody.last_name || current.lastName;
      current.fatherName = inquiryBody.father_name || '';
      current.nationalCode = cleanNationalCode;
      current.birthDate = cleanBirthDate;
      current.isVerifiedIdentity = true;
      updatedUser = toUserDTO(current);
    }

    const missing = missingProfileFields({
      ...current,
      name: updatedUser.name,
      lastName: updatedUser.lastName,
      storeName: updatedUser.storeName,
      address: updatedUser.address,
    });

    return {
      ok: true,
      message: 'استعلام اطلاعات هویتی با موفقیت انجام شد.',
      user: updatedUser,
      complete: missing.length === 0,
      missing,
      identity: {
        matched: true,
        firstName: inquiryBody.first_name,
        lastName: inquiryBody.last_name,
        fatherName: inquiryBody.father_name,
        nationalCode: inquiryBody.national_code,
        alive: inquiryBody.alive,
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof ZohalError) {
      log?.warn(
        { statusCode: err.statusCode, providerCode: err.providerCode },
        'Zohal inquiry failed',
      );
      throw new AppError(err.message, err.statusCode === 401 || err.statusCode === 403 ? 503 : 400, 'zohal_inquiry_failed');
    }
    log?.error({ err }, 'unexpected identity inquiry failure');
    throw new AppError('خطایی در فرآیند استعلام رخ داد.', 500, 'identity_inquiry_failed');
  }
}
