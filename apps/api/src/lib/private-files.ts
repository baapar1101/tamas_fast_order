import { isAbsolute, relative, resolve, sep } from 'node:path';

export type PrivateFileScope = 'credit' | 'payment';
export interface PrivateFileRecord {
  id: number;
  privateScope: PrivateFileScope | null;
  privateOwnerId: number | null;
  uploadedBy: number | null;
}
export interface FileReader {
  id: number;
  role: string;
  isActive: boolean;
  permissions?: string[] | null;
}

export function canReadPrivateFile(user: FileReader, file: PrivateFileRecord): boolean {
  if (!file.privateScope) return false;
  // Pending customers must be able to review their own application documents.
  if (user.role === 'customer' && (file.privateOwnerId ?? file.uploadedBy) === user.id) return true;
  if (!user.isActive) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'operator') return false;
  const permissions = user.permissions ?? [];
  return permissions.includes('*') || permissions.includes('manage_users') ||
    (file.privateScope === 'payment' && permissions.includes('manage_orders')) ||
    (file.privateOwnerId ?? file.uploadedBy) === user.id;
}

export function privateFileUrl(id: number, thumbnail = false): string {
  return `/api/files/${id}${thumbnail ? '?variant=thumb' : ''}`;
}

export function privateFileId(value: string): number | null {
  const match = /^\/api\/files\/([1-9]\d*)(?:\?variant=thumb)?$/.exec(value);
  const id = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(id) ? id : null;
}

/** Resolve only portable, relative storage keys. Never trust an HTTP path. */
export function confinedFilePath(root: string, key: string): string {
  if (!key || key.includes('\\') || key.includes('\0') || key.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Invalid storage key');
  }
  const path = resolve(root, key);
  const suffix = relative(resolve(root), path);
  if (!suffix || suffix === '..' || suffix.startsWith(`..${sep}`) || isAbsolute(suffix)) throw new Error('Invalid storage path');
  return path;
}
