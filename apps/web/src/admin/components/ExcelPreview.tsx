import { useState } from 'react';
import { formatNumber } from '@tamas/shared';
import { countStockRows, type StockUpdateReport, type StockUpdateRow } from './stockUpdateExcel';
import { TableState } from './AdminState';
import './excel-preview.css';

const PAGE = 200;

function change(oldValue: number | undefined, newValue: number | undefined) {
  if (oldValue === newValue) return <span className="xp-muted">{formatNumber(newValue ?? 0)}</span>;
  return (
    <span>
      <s className="xp-muted" aria-label={`قبلی ${formatNumber(oldValue ?? 0)}`}>{formatNumber(oldValue ?? 0)}</s>
      <span aria-hidden="true">{' ← '}</span>
      <strong>{formatNumber(newValue ?? 0)}</strong>
    </span>
  );
}

/**
 * What an uploaded price/stock file will change, before anything is written.
 * Rows with a warning (price halved, toman in the rial column, …) come first.
 */
export function ExcelPreview({ report, fileName, onApply, onCancel, onDownload }: {
  report: StockUpdateReport;
  fileName: string;
  onApply: () => void;
  onCancel: () => void;
  onDownload: () => void;
}) {
  const [filter, setFilter] = useState<'changes' | 'warnings' | 'errors'>(report.warnings ? 'warnings' : 'changes');
  const rows = report.rows ?? [];
  const counts = countStockRows(rows);
  const pointsChange = rows.some((row) => row.next?.campaignPoints !== undefined && row.next.campaignPoints !== row.old?.campaignPoints);
  const shown: StockUpdateRow[] = rows.filter((row) =>
    filter === 'errors' ? row.status === 'error'
      : filter === 'warnings' ? row.status === 'updated' && Boolean(row.warning)
        : row.status === 'updated');
  const columnCount = filter === 'errors' ? 4 : 8 + (pointsChange ? 1 : 0);

  return (
    <div className="a-card mt-4 excel-preview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong>پیش‌نمایش «{fileName}»: هنوز چیزی تغییر نکرده است.</strong>
          <div className="xp-summary">
            {formatNumber(counts.updated)} کالا تغییر می‌کند، {formatNumber(counts.unchanged)} بدون تغییر،{' '}
            {formatNumber(counts.error)} ردیف خطا
            {report.warnings ? <> و <strong className="xp-warn">{formatNumber(report.warnings)} تغییر مشکوک</strong></> : null}.
          </div>
        </div>
        <div className="a-card-actions">
          <button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={onDownload}>دانلود پیش‌نمایش</button>
          <button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={onCancel}>انصراف</button>
          <button type="button" className="a-btn a-btn--primary" disabled={!counts.updated} onClick={onApply}>
            اعمال {formatNumber(counts.updated)} تغییر
          </button>
        </div>
      </div>

      <div className="a-segmented mt-3" role="tablist" aria-label="نوع ردیف‌های پیش‌نمایش">
        {([
          ['changes', `تغییرها (${formatNumber(counts.updated)})`],
          ['warnings', `مشکوک (${formatNumber(report.warnings ?? 0)})`],
          ['errors', `خطاها (${formatNumber(counts.error)})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={`a-seg${filter === key ? ' a-seg--on' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="a-table-wrap xp-table-wrap mt-3" role="tabpanel">
        <table className="a-table">
          <thead>
            <tr>
              <th className="a-num">ردیف</th>
              <th>کد کالا</th>
              <th>کالا</th>
              {filter === 'errors' ? <th>خطا</th> : (
                <>
                  <th className="a-num">قیمت (تومان)</th>
                  <th className="a-num">کرمان</th>
                  <th className="a-num">تهران</th>
                  <th className="a-num">موجودی کل</th>
                  {pointsChange && <th className="a-num">امتیاز</th>}
                  <th>توجه</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, PAGE).map((row) => (
              <tr key={row.rowNumber} className={row.warning ? 'xp-row--warning' : undefined}>
                <td className="a-num">{formatNumber(row.rowNumber)}</td>
                <td className="a-ltr">{row.sku}</td>
                <td>{row.title ?? '—'}</td>
                {filter === 'errors' ? <td>{row.message}</td> : (
                  <>
                    <td className="a-num">{change(row.old?.price, row.next?.price)}</td>
                    <td className="a-num">{change(row.old?.kermanStock, row.next?.kermanStock)}</td>
                    <td className="a-num">{change(row.old?.tehranStock, row.next?.tehranStock)}</td>
                    <td className="a-num">{change(row.old?.stock, row.next?.stock)}</td>
                    {pointsChange && <td className="a-num">{change(row.old?.campaignPoints, row.next?.campaignPoints)}</td>}
                    <td className="xp-note">{row.warning ?? ''}</td>
                  </>
                )}
              </tr>
            ))}
            {!shown.length && (
              <TableState colSpan={columnCount} kind="filtered" noun="ردیف" />
            )}
          </tbody>
        </table>
      </div>
      {shown.length > PAGE && (
        <p className="a-hint mt-2">
          {formatNumber(PAGE)} ردیف اول نمایش داده شد؛ همهٔ ردیف‌ها در «دانلود پیش‌نمایش» هست.
        </p>
      )}
    </div>
  );
}
