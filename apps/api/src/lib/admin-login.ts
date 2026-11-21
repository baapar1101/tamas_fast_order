import { createHash, timingSafeEqual } from 'node:crypto';

export const ADMIN_LOGIN_MIN_PASSWORD = 12;

export interface AdminLoginConfig {
  username: string;
  password: string;
}

/** On only when both values are set and the password is long enough. */
export function adminLoginEnabled(config: AdminLoginConfig): boolean {
  return config.username.trim().length > 0 && config.password.length >= ADMIN_LOGIN_MIN_PASSWORD;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * Compares both fields in constant time (fixed-length digests), and always
 * checks both, so a wrong username and a wrong password look the same.
 */
export function adminCredentialsMatch(config: AdminLoginConfig, username: string, password: string): boolean {
  if (!adminLoginEnabled(config)) return false;
  const userOk = timingSafeEqual(digest(username.trim().toLowerCase()), digest(config.username.trim().toLowerCase()));
  const passOk = timingSafeEqual(digest(password), digest(config.password));
  return userOk && passOk;
}
