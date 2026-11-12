import {
  MAX_PRODUCT_IMPORT_ROWS,
  PRODUCT_IMPORT_FIELDS,
  PRODUCT_IMPORT_FIELD_MAP,
  PRODUCT_IMPORT_STATUS_LABELS,
  importHeaderLabel,
  matchImportHeaders,
  type ImportHeaderMatch,
  type ProductImportFieldKey,
  type ProductImportRowResult,
} from '@tamas/shared';

/** The parts of SheetJS this module uses (loaded lazily by the page, directly by tests). */
type XLSXModule = typeof import('@e965/xlsx');
type WorkSheet = import('@e965/xlsx').WorkSheet;

export const PRODUCTS_SHEET = 'کالاها';

interface TaxonomyName {
  name: string;
  faName: string;
}

function rtlSheet(rows: unknown[][], widths: number[], XLSX: XLSXModule): WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  return sheet;
}

/** A new workbook whose sheets open right-to-left (SheetJS reads the direction from the workbook view). */
export function rtlBook(XLSX: XLSXModule) {
  const book = XLSX.utils.book_new();
  book.Workbook = { ...(book.Workbook ?? {}), Views: [{ RTL: true }] };
  return book;
}

const CATEGORIES_SHEET = 'دسته‌بندی‌ها';
const BRANDS_SHEET = 'برندها';

interface ListCheck {
  /** Zero-based column of the products sheet. */
  column: number;
  /** Sheet holding the accepted names: Persian in column A, English in column B. */
  sheet: string;
  count: number;
  title: string;
}

function columnLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const xmlEscape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SHEET_TAIL = /<(?:hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b|<\/worksheet>/;
/** dxf 0: light red fill, dark red text (Excel's "bad" look). */
const RED_DXF = '<dxfs count="1"><dxf><font><color rgb="FF9C0006"/></font><fill><patternFill><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf></dxfs>';

/**
 * SheetJS (community edition) cannot write data validation or conditional
 * formatting, so they are added to the finished file's XML: each category /
 * brand column gets a drop-down of the site's names (a typo pops up a warning
 * while typing) and turns red when a pasted or typed name is not on the list.
 * The warning still lets a new name through for "create missing" imports.
 */
export function addListChecks(XLSX: XLSXModule, bytes: Uint8Array | ArrayBuffer, checks: ListCheck[]): Uint8Array {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const active = checks.filter((check) => check.count > 0);
  if (!active.length) return data;

  const zip = XLSX.CFB.read(data, { type: 'array' });
  const sheetEntry = XLSX.CFB.find(zip, '/xl/worksheets/sheet1.xml');
  const stylesEntry = XLSX.CFB.find(zip, '/xl/styles.xml');
  if (!sheetEntry?.content || !stylesEntry?.content) return data;
  const decode = (content: unknown) => new TextDecoder().decode(content as Uint8Array);

  const lastRow = MAX_PRODUCT_IMPORT_ROWS + 1;
  const formatting: string[] = [];
  const validations: string[] = [];
  active.forEach((check, index) => {
    const col = columnLetter(check.column);
    const range = `${col}2:${col}${lastRow}`;
    const names = `'${check.sheet}'!$A$2:$A$${check.count + 1}`;
    const english = `'${check.sheet}'!$B$2:$B$${check.count + 1}`;
    const cell = `TRIM(${col}2)`;
    formatting.push(
      `<conditionalFormatting sqref="${range}"><cfRule type="expression" dxfId="0" priority="${index + 1}">`
      + `<formula>${xmlEscape(`AND(LEN(${cell})>0,COUNTIF(${names},${cell})+COUNTIF(${english},${cell})=0)`)}</formula>`
      + '</cfRule></conditionalFormatting>',
    );
    validations.push(
      '<dataValidation type="list" errorStyle="warning" allowBlank="1" showInputMessage="1" showErrorMessage="1"'
      + ` promptTitle="${xmlEscape(check.title)}" prompt="${xmlEscape(`از فهرست کشویی انتخاب کنید (برگهٔ «${check.sheet}»).`)}"`
      + ` errorTitle="${xmlEscape(`${check.title} در سایت نیست`)}"`
      + ` error="${xmlEscape(`این نام در فهرست ${check.title}‌های سایت نیست؛ احتمالاً غلط تایپی است. «No» را بزنید و از فهرست انتخاب کنید. فقط اگر می‌خواهید هنگام ایمپورت ساخته شود «Yes» را بزنید.`)}"`
      + ` sqref="${range}"><formula1>${xmlEscape(names)}</formula1></dataValidation>`,
    );
  });
  const block = `${formatting.join('')}<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`;

  // Schema order: both blocks sit after sheetData/mergeCells and before everything matched here.
  const sheetXml = decode(sheetEntry.content);
  const tail = SHEET_TAIL.exec(sheetXml);
  const stylesXml = decode(stylesEntry.content);
  if (!tail || !/<dxfs count="0"\s*\/>/.test(stylesXml)) return data;

  const replacements: [typeof sheetEntry, string][] = [
    [sheetEntry, sheetXml.slice(0, tail.index) + block + sheetXml.slice(tail.index)],
    [stylesEntry, stylesXml.replace(/<dxfs count="0"\s*\/>/, RED_DXF)],
  ];
  for (const [entry, text] of replacements) {
    const content = new TextEncoder().encode(text);
    entry.content = content as unknown as typeof entry.content;
    entry.size = content.length;
  }
  return new Uint8Array(XLSX.CFB.write(zip, { fileType: 'zip', type: 'array', compression: true }) as ArrayLike<number>);
}

/** Fields in template order (the catalogue's order, not the click order). */
export function orderedImportFields(keys: Iterable<ProductImportFieldKey>) {
  const wanted = new Set(keys);
  return PRODUCT_IMPORT_FIELDS.filter((field) => field.required || wanted.has(field.key));
}

/**
 * Empty products sheet with the chosen columns, a guide, and the exact
 * category and brand names the importer accepts.
 */
export function buildTemplateWorkbook(
  XLSX: XLSXModule,
  keys: Iterable<ProductImportFieldKey>,
  taxonomy: { categories: TaxonomyName[]; brands: TaxonomyName[] },
): Uint8Array {
  const fields = orderedImportFields(keys);
  const book = rtlBook(XLSX);

  XLSX.utils.book_append_sheet(
    book,
    rtlSheet([fields.map(importHeaderLabel)], fields.map((field) => Math.max(14, Math.min(40, field.label.length + 6))), XLSX),
    PRODUCTS_SHEET,
  );

  const guide: unknown[][] = [
    ['راهنمای ایمپورت کالای جدید'],
    ['هر ردیف برگهٔ «کالاها» یک کالای جدید است. ستون‌های ستاره‌دار اجباری‌اند و بقیه را می‌توانید خالی بگذارید.'],
    ['کالایی که کد محصول، SKU یا عنوان/مدل/رنگ آن قبلاً در سایت ثبت شده باشد، تکراری حساب می‌شود و تغییری نمی‌کند.'],
    ['نام دسته‌بندی و برند باید دقیقاً یکی از نام‌های برگه‌های «دسته‌بندی‌ها» و «برندها» باشد؛ در برگهٔ «کالاها» از فهرست کشویی همان خانه انتخاب کنید. نامی که در سایت نیست (مثلاً غلط تایپی) قرمز می‌شود.'],
    [],
    ['ستون', 'اجباری', 'توضیح', 'نمونه'],
    ...fields.map((field) => [importHeaderLabel(field), field.required ? 'بله' : 'خیر', field.hint, field.example]),
  ];
  XLSX.utils.book_append_sheet(book, rtlSheet(guide, [28, 10, 70, 36], XLSX), 'راهنما');

  const names = (items: TaxonomyName[]) => items
    .map((item) => [item.faName || item.name, item.name && item.name !== item.faName ? item.name : ''])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'fa'));
  XLSX.utils.book_append_sheet(book, rtlSheet([['نام', 'نام انگلیسی'], ...names(taxonomy.categories)], [34, 28], XLSX), CATEGORIES_SHEET);
  XLSX.utils.book_append_sheet(book, rtlSheet([['نام', 'نام انگلیسی'], ...names(taxonomy.brands)], [34, 28], XLSX), BRANDS_SHEET);

  const written = XLSX.write(book, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
  const columnOf = (key: ProductImportFieldKey) => fields.findIndex((field) => field.key === key);
  return addListChecks(
    XLSX,
    written,
    [
      { column: columnOf('categoryName'), sheet: CATEGORIES_SHEET, count: taxonomy.categories.length, title: 'دسته‌بندی' },
      { column: columnOf('brandName'), sheet: BRANDS_SHEET, count: taxonomy.brands.length, title: 'برند' },
    ].filter((check) => check.column >= 0),
  );
}

export interface ParsedImportRow {
  /** Row number as Excel shows it, so the admin can find it in the file. */
  rowNumber: number;
  values: Partial<Record<ProductImportFieldKey, unknown>>;
  /** Every cell of the row under its original header, for the result file. */
  original: unknown[];
}

export interface ParsedImportFile {
  sheetName: string;
  headers: string[];
  match: ImportHeaderMatch;
  rows: ParsedImportRow[];
  /** Data rows beyond the import limit that were left out. */
  skippedOverLimit: number;
}

function isBlank(value: unknown): boolean {
  return value == null || String(value).trim() === '';
}

export function parseImportWorkbook(XLSX: XLSXModule, data: ArrayBuffer | Uint8Array): ParsedImportFile {
  const book = XLSX.read(data, { type: 'array', cellDates: false });
  const sheetName = book.SheetNames.includes(PRODUCTS_SHEET) ? PRODUCTS_SHEET : book.SheetNames[0];
  if (!sheetName) throw new Error('فایل اکسل هیچ برگه‌ای ندارد.');
  const sheet = book.Sheets[sheetName]!;
  const firstRow = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']).s.r : 0;
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: true });

  // The header is the first row (within the first 10) that names a known column.
  let headerIndex = -1;
  let match: ImportHeaderMatch | null = null;
  for (let index = 0; index < Math.min(10, grid.length); index++) {
    const candidate = matchImportHeaders(grid[index] ?? []);
    if (candidate.columns.length > 0) {
      headerIndex = index;
      match = candidate;
      break;
    }
  }
  if (!match || headerIndex < 0) {
    throw new Error('سطر عنوان ستون‌ها پیدا نشد. از فایل نمونهٔ همین صفحه استفاده کنید و عنوان ستون‌ها را تغییر ندهید.');
  }

  const headers = (grid[headerIndex] ?? []).map((cell) => String(cell ?? '').trim());
  const rows: ParsedImportRow[] = [];
  let skippedOverLimit = 0;
  for (let index = headerIndex + 1; index < grid.length; index++) {
    const cells = grid[index] ?? [];
    const values: ParsedImportRow['values'] = {};
    for (const column of match.columns) {
      const cell = cells[column.index];
      if (!isBlank(cell)) values[column.key] = cell;
    }
    if (Object.keys(values).length === 0) continue;
    if (rows.length >= MAX_PRODUCT_IMPORT_ROWS) {
      skippedOverLimit++;
      continue;
    }
    rows.push({ rowNumber: firstRow + index + 1, values, original: headers.map((_, column) => cells[column] ?? null) });
  }
  return { sheetName, headers, match, rows, skippedOverLimit };
}

/**
 * The uploaded rows with the outcome next to each one. Its columns match the
 * template, so the admin can fix the failed rows and import the file again.
 */
export function buildResultWorkbook(
  XLSX: XLSXModule,
  parsed: Pick<ParsedImportFile, 'headers' | 'rows'>,
  results: ProductImportRowResult[],
): Uint8Array {
  const byRow = new Map(results.map((result) => [result.rowNumber, result]));
  const headers = parsed.headers.map((header, index) => header || `ستون ${index + 1}`);
  const table: unknown[][] = [
    ['ردیف در فایل', 'نتیجه', 'توضیح', 'شناسه در سایت', ...headers],
    ...parsed.rows.map((row) => {
      const result = byRow.get(row.rowNumber);
      return [
        row.rowNumber,
        result ? PRODUCT_IMPORT_STATUS_LABELS[result.status] : 'ارسال نشد',
        result?.message ?? '',
        result?.id ?? '',
        ...row.original.map((cell) => cell ?? ''),
      ];
    }),
  ];
  const book = rtlBook(XLSX);
  XLSX.utils.book_append_sheet(book, rtlSheet(table, [10, 14, 60, 12, ...headers.map(() => 18)], XLSX), 'نتیجه ایمپورت');

  const count = (status: ProductImportRowResult['status']) => results.filter((result) => result.status === status).length;
  XLSX.utils.book_append_sheet(book, rtlSheet([
    ['خلاصه', 'تعداد'],
    ['کل ردیف‌ها', parsed.rows.length],
    [PRODUCT_IMPORT_STATUS_LABELS.created, count('created')],
    [PRODUCT_IMPORT_STATUS_LABELS.duplicate, count('duplicate')],
    [PRODUCT_IMPORT_STATUS_LABELS.error, count('error')],
  ], [24, 12], XLSX), 'خلاصه');
  return XLSX.write(book, { bookType: 'xlsx', type: 'array', compression: true }) as Uint8Array;
}

export function importFieldLabel(key: ProductImportFieldKey): string {
  return PRODUCT_IMPORT_FIELD_MAP.get(key)?.label ?? key;
}
