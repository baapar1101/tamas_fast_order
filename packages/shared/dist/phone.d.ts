/**
 * Persian/Arabic-Indic digits appear in anything typed on an Iranian keyboard,
 * so every phone number is folded to ASCII before it is compared or stored.
 */
export declare function toAsciiDigits(value: unknown): string;
/** Folds every shape an Iranian mobile number is typed in down to `09xxxxxxxxx`. */
export declare function normalizePhone(value: unknown): string;
export declare function isValidPhone(value: unknown): boolean;
/** Landline or mobile, used for the optional `phone_number` profile field. */
export declare function normalizeLandline(value: unknown): string;
