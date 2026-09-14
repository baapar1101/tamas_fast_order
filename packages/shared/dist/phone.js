/**
 * Persian/Arabic-Indic digits appear in anything typed on an Iranian keyboard,
 * so every phone number is folded to ASCII before it is compared or stored.
 */
export function toAsciiDigits(value) {
    return String(value ?? '')
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}
/** Folds every shape an Iranian mobile number is typed in down to `09xxxxxxxxx`. */
export function normalizePhone(value) {
    let s = toAsciiDigits(value).replace(/\D/g, '');
    if (s.startsWith('0098'))
        s = s.slice(4);
    else if (s.length === 12 && s.startsWith('98'))
        s = s.slice(2);
    if (s.length === 10 && s.startsWith('9'))
        s = `0${s}`;
    return s;
}
export function isValidPhone(value) {
    return /^09\d{9}$/.test(normalizePhone(value));
}
/** Landline or mobile, used for the optional `phone_number` profile field. */
export function normalizeLandline(value) {
    return toAsciiDigits(value).replace(/\D/g, '');
}
//# sourceMappingURL=phone.js.map