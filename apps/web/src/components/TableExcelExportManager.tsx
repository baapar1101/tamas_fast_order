import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, LoaderCircle } from 'lucide-react';
import { useToast } from './Toast';

interface ExportTarget {
  id: number;
  table: HTMLTableElement;
  mount: HTMLDivElement;
}

const EXCLUDED_TABLE_SELECTOR = '.print-invoice-layout table, .proforma-sheet table, table[data-excel-export="off"]';
const TABLE_WRAPPER_SELECTOR = '.a-table-wrap, .huma-table-container, .credit-table-wrap, .product-sheet__table-wrap, .table-wrap';
const ACTION_HEADER_PATTERN = /^(عملیات|اقدامات|کنترل|انتخاب)$/;

function cleanText(value: string | null | undefined): string {
  return String(value ?? '').replace(/[\u200c\u200f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function readCell(cell: HTMLTableCellElement): string {
  const clone = cell.cloneNode(true) as HTMLTableCellElement;
  const originalControls = Array.from(cell.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'));
  const clonedControls = Array.from(clone.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'));
  clonedControls.forEach((control, index) => {
    const original = originalControls[index];
    let value = '';
    if (original instanceof HTMLInputElement && original.type === 'checkbox') value = original.checked ? 'بله' : 'خیر';
    else if (original instanceof HTMLSelectElement) value = original.selectedOptions[0]?.text ?? '';
    else value = original?.value ?? '';
    control.replaceWith(document.createTextNode(value));
  });
  clone.querySelectorAll('svg, button, [aria-hidden="true"], .table-excel-ignore').forEach((node) => node.remove());
  clone.querySelectorAll('img').forEach((image) => image.replaceWith(document.createTextNode(image.getAttribute('alt') || '')));
  clone.querySelectorAll('br').forEach((lineBreak) => lineBreak.replaceWith(document.createTextNode(' · ')));
  return cleanText(clone.textContent);
}

function tableTitle(table: HTMLTableElement, fallbackIndex: number): string {
  const explicit = cleanText(table.dataset.excelTitle);
  if (explicit) return explicit;
  const labelledRegion = table.closest<HTMLElement>('[aria-label]');
  const regionLabel = cleanText(labelledRegion?.getAttribute('aria-label'));
  if (regionLabel && !/^جدول$/i.test(regionLabel)) return regionLabel.replace(/^جدول\s*/, '');
  const container = table.closest<HTMLElement>('section, article, .a-card, .modal-panel, main');
  const heading = container?.querySelector<HTMLElement>('h1, h2, h3, .a-title, .a-card-title');
  const headingText = cleanText(heading?.textContent);
  if (headingText) return headingText;
  const pageHeading = cleanText(document.querySelector<HTMLElement>('main h1')?.textContent);
  return pageHeading || `جدول ${fallbackIndex.toLocaleString('fa-IR')}`;
}

function extractTable(table: HTMLTableElement): { headers: string[]; rows: string[][] } {
  const headerRow = table.tHead?.rows.item(table.tHead.rows.length - 1) ?? null;
  const bodyRows = Array.from(table.tBodies).flatMap((body) => Array.from(body.rows));
  const fallbackRows = bodyRows.length > 0 ? bodyRows : Array.from(table.rows).filter((row) => !table.tHead?.contains(row));
  const columnCount = Math.max(headerRow?.cells.length ?? 0, ...fallbackRows.map((row) => row.cells.length), 0);
  const rawHeaders = headerRow
    ? Array.from(headerRow.cells, readCell)
    : table.classList.contains('pp-attrs')
      ? ['ویژگی', 'مقدار']
      : Array.from({ length: columnCount }, (_, index) => `ستون ${(index + 1).toLocaleString('fa-IR')}`);
  const includedColumns = rawHeaders
    .map((header, index) => ({ header: header || `ستون ${(index + 1).toLocaleString('fa-IR')}`, index }))
    .filter(({ header }) => !ACTION_HEADER_PATTERN.test(header));
  const headers = includedColumns.map(({ header }) => header);
  const rows = fallbackRows
    .filter((row) => row.getAttribute('aria-hidden') !== 'true')
    .map((row) => includedColumns.map(({ index }) => row.cells.item(index) ? readCell(row.cells.item(index)!) : ''))
    .filter((row) => row.some(Boolean));
  return { headers, rows };
}

function safeName(value: string, fallback: string): string {
  const normalized = cleanText(value).replace(/[\\/:*?"<>|]+/g, '-').replace(/\.+$/g, '').slice(0, 90);
  return normalized || fallback;
}

async function downloadWorkbook(table: HTMLTableElement, title: string): Promise<number> {
  const { headers, rows } = extractTable(table);
  if (headers.length === 0) throw new Error('ستونی برای خروجی گرفتن پیدا نشد.');
  const XLSX = await import('@e965/xlsx');
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1:A1');
  worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, range.e.r), c: range.e.c } }) };
  worksheet['!cols'] = headers.map((header, columnIndex) => {
    const width = Math.max(header.length + 3, ...rows.map((row) => (row[columnIndex] ?? '').length + 2));
    return { wch: Math.min(48, Math.max(12, width)) };
  });
  worksheet['!views'] = [{ RTL: true }];
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: title,
    Subject: 'خروجی جدول تماس مارکت',
    Author: 'تماس مارکت',
    CreatedDate: new Date(),
  };
  XLSX.utils.book_append_sheet(workbook, worksheet, safeName(title, 'گزارش').slice(0, 31));
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true });
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a');
  const date = new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-');
  anchor.href = url;
  anchor.download = `${safeName(title, 'خروجی-جدول')}-${date}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return rows.length;
}

function TableExportButton({ table, index }: { table: HTMLTableElement; index: number }) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const title = tableTitle(table, index);

  const exportTable = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rowCount = await downloadWorkbook(table, title);
      toast.ok(`فایل اکسل «${title}» با ${rowCount.toLocaleString('fa-IR')} ردیف آماده شد.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ساخت فایل اکسل انجام نشد.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      type="button"
      className="table-excel-export-button"
      onClick={() => void exportTable()}
      disabled={exporting}
      title="خروجی ردیف‌های نمایش‌داده‌شده در همین جدول"
      aria-label={`خروجی اکسل ${title}`}
    >
      {exporting ? <LoaderCircle className="table-excel-export-spinner" size={17} aria-hidden="true" /> : <FileSpreadsheet size={17} aria-hidden="true" />}
      <span>{exporting ? 'در حال ساخت…' : 'خروجی اکسل'}</span>
    </button>
  );
}

export function TableExcelExportManager() {
  const [targets, setTargets] = useState<ExportTarget[]>([]);

  useEffect(() => {
    const attached = new Map<HTMLTableElement, ExportTarget>();
    let nextId = 1;
    let frame = 0;

    const sync = () => {
      frame = 0;
      const tables = Array.from(document.querySelectorAll<HTMLTableElement>('table'))
        .filter((table) => !table.matches(EXCLUDED_TABLE_SELECTOR));
      for (const [table, target] of attached) {
        if (!table.isConnected || !tables.includes(table)) {
          target.mount.remove();
          attached.delete(table);
        }
      }
      tables.forEach((table) => {
        if (attached.has(table)) return;
        const host = table.closest<HTMLElement>(TABLE_WRAPPER_SELECTOR) ?? table;
        const parent = host.parentElement;
        if (!parent) return;
        const mount = document.createElement('div');
        mount.className = 'table-excel-export-slot';
        mount.dir = 'rtl';
        mount.dataset.tableExcelExport = 'true';
        parent.insertBefore(mount, host);
        attached.set(table, { id: nextId++, table, mount });
      });
      const nextTargets = Array.from(attached.values());
      setTargets((current) => {
        if (current.length === nextTargets.length && current.every((target, index) => target === nextTargets[index])) {
          return current;
        }
        return nextTargets;
      });
    };

    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };
    sync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      attached.forEach((target) => target.mount.remove());
    };
  }, []);

  return <>{targets.map((target, index) => createPortal(<TableExportButton key={target.id} table={target.table} index={index + 1} />, target.mount))}</>;
}

