import { useEffect, useState } from 'react';
import type { CreditApplicationDTO, CreditStatus } from '@tamas/shared';
import { CREDIT_STATUS_LABELS, formatMoney } from '@tamas/shared';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

export function CreditApplicationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<CreditApplicationDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Selected for review modal
  const [selectedApp, setSelectedApp] = useState<CreditApplicationDTO | null>(null);
  const [editStatus, setEditStatus] = useState<CreditStatus>('pending');
  const [editLimit, setEditLimit] = useState<number>(0);
  const [editScore, setEditScore] = useState<number>(0);
  const [editReason, setEditReason] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    setLoading(true);
    api
      .get<{ ok: true; items: CreditApplicationDTO[] }>('/admin/credit-applications')
      .then((res) => {
        if (res.ok) setItems(res.items);
      })
      .catch((err) => toast.error(err.message || 'خطا در دریافت لیست اعتبارسنجی'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openReviewModal = (appItem: CreditApplicationDTO) => {
    setSelectedApp(appItem);
    setEditStatus(appItem.status);
    setEditLimit(appItem.assignedCreditLimit || 0);
    setEditScore(appItem.adminCreditScore || 0);
    setEditReason(appItem.rejectionReason || '');
    setEditNotes(appItem.internalNotes || '');
  };

  const handleSave = async () => {
    if (!selectedApp) return;
    setSaving(true);
    try {
      const res = await api.patch<{ ok: true; application: CreditApplicationDTO }>(
        `/admin/credit-applications/${selectedApp.id}`,
        {
          status: editStatus,
          assignedCreditLimit: Number(editLimit),
          adminCreditScore: Number(editScore),
          rejectionReason: editReason || null,
          internalNotes: editNotes || null,
        }
      );

      if (res.ok) {
        toast.ok('اطلاعات با موفقیت بروزرسانی شد');
        setSelectedApp(null);
        loadData();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در بروزرسانی پرونده اعتباری');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = (item.userName || '').toLowerCase().includes(q);
      const matchPhone = (item.userPhone || '').includes(q);
      const matchStore = (item.userStoreName || '').toLowerCase().includes(q);
      const matchNational = (item.nationalId || '').includes(q);
      return matchName || matchPhone || matchStore || matchNational;
    }
    return true;
  });

  const renderStatusBadge = (status: CreditStatus) => {
    const bgMap: Record<CreditStatus, string> = {
      pending: '#fef3c7',
      reviewing: '#e0f2fe',
      active: '#dcfce7',
      action_required: '#fee2e2',
    };
    const colorMap: Record<CreditStatus, string> = {
      pending: '#d97706',
      reviewing: '#0284c7',
      active: '#15803d',
      action_required: '#dc2626',
    };

    return (
      <span
        style={{
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 800,
          backgroundColor: bgMap[status],
          color: colorMap[status],
          whiteSpace: 'nowrap',
        }}
      >
        {CREDIT_STATUS_LABELS[status]}
      </span>
    );
  };

  return (
    <div className="a-page a-fade">
      <header className="a-page-head">
        <div>
          <h1 className="a-title-mega-sm">مدیریت پنل اعتباری و تضامین</h1>
          <p className="a-subtitle">بررسی مدارک، تعیین سقف اعتبار خرید و اعتبارسنجی مشتریان</p>
        </div>
        <div className="a-page-actions flex items-center gap-4">
          <button type="button" className="a-btn a-btn--secondary" onClick={loadData}>
            🔄 بروزرسانی
          </button>
        </div>
      </header>

      {/* Filters Toolbar */}
      <section className="a-filterbar" style={{ padding: '16px', borderRadius: '14px', backgroundColor: 'var(--a-surface-2)', border: '1px solid var(--a-border)', backdropFilter: 'blur(16px)', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          className="a-input"
          placeholder="جستجو بر اساس نام، تلفن، فروشگاه یا کد ملی..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 240px' }}
        />

        <div className="a-segmented" role="group" style={{ display: 'flex' }}>
          {[
            { id: 'all', label: 'همه' },
            { id: 'pending', label: 'در صف بررسی' },
            { id: 'reviewing', label: 'در حال بررسی' },
            { id: 'active', label: 'تایید شده' },
            { id: 'action_required', label: 'رد شده' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`a-seg${filterStatus === tab.id ? ' a-seg--on' : ''}`}
              onClick={() => setFilterStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Applications Table */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--a-t2)' }}>در حال بارگذاری لیست...</div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: 'var(--a-surface-2)',
            backdropFilter: 'blur(16px)',
            borderRadius: '14px',
            border: '1px solid var(--a-border)',
            color: 'var(--a-t2)',
          }}
        >
          هیچ پرونده اعتباری یافت نشد.
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--a-surface-2)',
            backdropFilter: 'blur(16px)',
            borderRadius: '14px',
            border: '1px solid var(--a-border)',
            overflowX: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--a-border)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>مشتری</th>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>شماره تماس</th>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>کد ملی</th>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>نوع کسب‌وکار</th>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>وضعیت</th>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>سقف اعتبار</th>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--a-border)' }} className="hover:bg-[var(--a-hover)] transition-colors">
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--a-t1)' }}>
                    {item.userName}
                    {item.userStoreName && (
                      <div style={{ fontSize: '11px', color: 'var(--a-t3)', fontWeight: 400 }}>
                        {item.userStoreName}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--a-t1)' }}>{item.userPhone}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--a-t2)' }}>{item.nationalId}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--a-t2)' }}>{item.businessType}</td>
                  <td style={{ padding: '14px 16px' }}>{renderStatusBadge(item.status)}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--a-brand)' }}>
                    {item.assignedCreditLimit > 0 ? formatMoney(item.assignedCreditLimit) : 'تعیین نشده'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <button
                      type="button"
                      className="a-btn a-btn--secondary"
                      onClick={() => openReviewModal(item)}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      🔍 بررسی مدارک / تغییر وضعیت
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review & Edit Modal */}
      {selectedApp && (
        <Modal open={true} onClose={() => setSelectedApp(null)} title={`بررسی پرونده اعتباری ${selectedApp.userName}`} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* User Info Header */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: 'var(--a-surface-2)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--a-border)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '12px',
                fontSize: '12.5px',
              }}
            >
              <div><strong>مشتری:</strong> {selectedApp.userName}</div>
              <div><strong>موبایل:</strong> {selectedApp.userPhone}</div>
              <div><strong>فروشگاه:</strong> {selectedApp.userStoreName || 'نامشخص'}</div>
              <div><strong>کد ملی:</strong> {selectedApp.nationalId}</div>
              <div><strong>کسب‌وکار:</strong> {selectedApp.businessType}</div>
              {selectedApp.referralInfo && <div><strong>معرف:</strong> {selectedApp.referralInfo}</div>}
            </div>

            {/* Document Preview Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <strong style={{ fontSize: '14px', color: 'var(--a-t1)' }}>مدارک و تضامین بارگذاری شده:</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                <a
                  href={selectedApp.nationalCardUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid var(--a-border)',
                    backgroundColor: 'var(--a-surface-2)',
                    backdropFilter: 'blur(16px)',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                  className="hover:bg-[var(--a-hover)] transition-colors"
                >
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>🖼️</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--a-t1)' }}>کارت ملی</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--a-brand)' }}>مشاهده / دانلود</div>
                </a>

                <a
                  href={selectedApp.businessDocsUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid var(--a-border)',
                    backgroundColor: 'var(--a-surface-2)',
                    backdropFilter: 'blur(16px)',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                  className="hover:bg-[var(--a-hover)] transition-colors"
                >
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>📜</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--a-t1)' }}>جواز / اجاره‌نامه</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--a-brand)' }}>مشاهده / دانلود</div>
                </a>

                <a
                  href={selectedApp.checkImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--a-brand)',
                    backgroundColor: 'var(--a-surface-2)',
                    backdropFilter: 'blur(16px)',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                  className="hover:bg-[var(--a-hover)] transition-colors"
                >
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>💳</div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--a-t1)' }}>برگ چک صیادی</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--a-brand)' }}>مشاهده / دانلود</div>
                </a>

                {selectedApp.bankStatementUrl && (
                  <a
                    href={selectedApp.bankStatementUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid var(--a-border)',
                      backgroundColor: 'var(--a-surface-2)',
                      backdropFilter: 'blur(16px)',
                      textDecoration: 'none',
                      textAlign: 'center',
                    }}
                    className="hover:bg-[var(--a-hover)] transition-colors"
                  >
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>📊</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--a-t1)' }}>پرینت حساب</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--a-brand)' }}>مشاهده / دانلود</div>
                  </a>
                )}
              </div>
            </div>

            {/* Admin Controls Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid var(--a-border)', paddingTop: '16px' }}>
              <strong style={{ fontSize: '14px', color: 'var(--a-t1)' }}>تعیین وضعیت و سقف اعتبار:</strong>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--a-t1)' }}>وضعیت پرونده</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as CreditStatus)}
                    className="a-input"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                  >
                    <option value="pending">در صف بررسی</option>
                    <option value="reviewing">در حال بررسی</option>
                    <option value="active">تایید شده</option>
                    <option value="action_required">رد شده</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--a-t1)' }}>سقف اعتبار (تومان)</label>
                  <input
                    type="number"
                    step={1000000}
                    value={editLimit}
                    onChange={(e) => setEditLimit(Number(e.target.value))}
                    className="a-input"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--a-t1)' }}>نمره اعتباری (۰ تا ۱۰۰)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editScore}
                    onChange={(e) => setEditScore(Number(e.target.value))}
                    className="a-input"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                  />
                </div>
              </div>

              {editStatus === 'action_required' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--a-red)' }}>
                    علت رد درخواست (نمایش به مشتری)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: مدارک ناخوانا است..."
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="a-input"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid var(--a-red)' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--a-t1)' }}>
                  یادداشت داخلی (فقط برای ادمین)
                </label>
                <textarea
                  placeholder="یادداشت پشتیبانی و واحد مالی..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="a-input"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px', minHeight: '60px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="a-btn a-btn--secondary" onClick={() => setSelectedApp(null)}>
                  انصراف
                </button>
                <button type="button" className="a-btn a-btn--primary" disabled={saving} onClick={handleSave}>
                  {saving ? 'در حال ثبت...' : 'ذخیره تغییرات'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
