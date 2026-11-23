import { useState } from 'react';
import { formatNumber } from '@tamas/shared';
import { countStockRows, type StockUpdateReport, type StockUpdateRow } from './stockUpdateExcel';

const PAGE = 200;

function change(oldValue: number | undefined, newValue: number | undefined) {
  if (oldValue === newValue) return <span className="text-muted">{formatNumber(newValue ?? 0)}</span>;
  return (
    <span>
      <s className="text-muted">{formatNumber(oldValue ?? 0)}</s>
      {' ← '}
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

  return (
    <div className="a-card mt-4" style={{ borderColor: 'var(--clr-amber, #f59e0b)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong>پیش‌نمایش «{fileName}»: هنوز چیزی تغییر نکرده است.</strong>
          <div className="text-sm mt-1">
            {formatNumber(counts.updated)} کالا تغییر می‌کند، {formatNumber(counts.unchanged)} بدون تغییر،{' '}
            {formatNumber(counts.error)} ردیف خطا
            {report.warnings ? <> و <strong style={{ color: 'var(--clr-rose)' }}>{formatNumber(report.warnings)} تغییر مشکوک</strong></> : null}.
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

      <div className="flex flex-wrap gap-2 mt-3" role="tablist">
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
            className={`a-btn a-btn--sm ${filter === key ? 'a-btn--primary' : 'a-btn--secondary'}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="a-table-wrap mt-3" style={{ maxHeight: 420, overflow: 'auto' }}>
        <table className="a-table">
          <thead>
            <tr>
              <th>ردیف</th>
              <th>کد کالا</th>
              <th>کالا</th>
              {filter === 'errors' ? <th>خطا</th> : (
                <>
                  <th>قیمت (تومان)</th>
                  <th>کرمان</th>
                  <th>تهران</th>
                  <th>موجودی کل</th>
                  {pointsChange && <th>امتیاز</th>}
                  <th>توجه</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, PAGE).map((row) => (
              <tr key={row.rowNumber} style={row.warning ? { background: 'rgba(244, 63, 94, .08)' } : undefined}>
                <td>{formatNumber(row.rowNumber)}</td>
                <td dir="ltr">{row.sku}</td>
                <td>{row.title ?? '—'}</td>
                {filter === 'errors' ? <td>{row.message}</td> : (
                  <>
                    <td>{change(row.old?.price, row.next?.price)}</td>
                    <td>{change(row.old?.kermanStock, row.next?.kermanStock)}</td>
                    <td>{change(row.old?.tehranStock, row.next?.tehranStock)}</td>
                    <td>{change(row.old?.stock, row.next?.stock)}</td>
                    {pointsChange && <td>{change(row.old?.campaignPoints, row.next?.campaignPoints)}</td>}
                    <td style={{ color: 'var(--clr-rose)' }}>{row.warning ?? ''}</td>
                  </>
                )}
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={8} className="text-muted">ردیفی برای نمایش نیست.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {shown.length > PAGE && (
        <p className="text-xs text-muted mt-2">
          {formatNumber(PAGE)} ردیف اول نمایش داده شد؛ همهٔ ردیف‌ها در «دانلود پیش‌نمایش» هست.
        </p>
      )}
    </div>
  );
}
