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
    } catch (err: any) {
      toast.error(err.message || 'خطا در بروزرسانی پرونده اعتباری');
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
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 6px' }}>مدیریت پنل اعتباری و تضامین</h1>
          <div style={{ fontSize: '13px', color: 'var(--tamas-muted)' }}>
            بررسی مدارک، تعیین سقف اعتبار خرید و اعتبارسنجی مشتریان
          </div>
        </div>
        <button type="button" className="btn ghost" onClick={loadData}>
          🔄 بروزرسانی
        </button>
      </div>

      {/* Filters Toolbar */}
      <div
        style={{
          padding: '16px',
          borderRadius: '14px',
          backgroundColor: 'var(--card)',
          border: '1px solid var(--tamas-border)',
          display: 'flex',
          gap: '14px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <input
          type="search"
          placeholder="جستجو بر اساس نام، تلفن، فروشگاه یا کد ملی..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1 1 240px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid var(--tamas-border)',
            fontSize: '13px',
          }}
        />

        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'all', label: 'همه' },
            { id: 'pending', label: 'در انتظار' },
            { id: 'reviewing', label: 'در حال بررسی' },
            { id: 'active', label: 'تأیید شده' },
            { id: 'action_required', label: 'نیاز به ویرایش' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`btn sm ${filterStatus === tab.id ? 'primary' : 'ghost'}`}
              onClick={() => setFilterStatus(tab.id)}
              style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Applications Table */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--tamas-muted)' }}>در حال بارگذاری لیست...</div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: 'var(--card)',
            borderRadius: '14px',
            border: '1px solid var(--tamas-border)',
            color: 'var(--tamas-muted)',
          }}
        >
          هیچ پرونده اعتباری یافت نشد.
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--card)',
            borderRadius: '14px',
            border: '1px solid var(--tamas-border)',
            overflowX: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--tamas-border)', backgroundColor: 'var(--tamas-surface)' }}>
                <th style={{ padding: '12px 16px' }}>مشتری</th>
                <th style={{ padding: '12px 16px' }}>شماره تماس</th>
                <th style={{ padding: '12px 16px' }}>کد ملی</th>
                <th style={{ padding: '12px 16px' }}>نوع کسب‌وکار</th>
                <th style={{ padding: '12px 16px' }}>وضعیت</th>
                <th style={{ padding: '12px 16px' }}>سقف اعتبار</th>
                <th style={{ padding: '12px 16px' }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--tamas-border)' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                    {item.userName}
                    {item.userStoreName && (
                      <div style={{ fontSize: '11px', color: 'var(--tamas-muted)', fontWeight: 400 }}>
                        {item.userStoreName}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>{item.userPhone}</td>
                  <td style={{ padding: '14px 16px' }}>{item.nationalId}</td>
                  <td style={{ padding: '14px 16px' }}>{item.businessType}</td>
                  <td style={{ padding: '14px 16px' }}>{renderStatusBadge(item.status)}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--tamas-accent)' }}>
                    {item.assignedCreditLimit > 0 ? formatMoney(item.assignedCreditLimit) : 'تعیین نشده'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => openReviewModal(item)}
                      style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px' }}
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
                backgroundColor: 'var(--tamas-surface)',
                border: '1px solid var(--tamas-border)',
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
              <strong style={{ fontSize: '14px' }}>مدارک و تضامین بارگذاری شده:</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                <a
                  href={selectedApp.nationalCardUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid var(--tamas-border)',
                    backgroundColor: 'var(--card)',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>🖼️</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--tamas-fg)' }}>کارت ملی</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--tamas-accent)' }}>مشاهده / دانلود</div>
                </a>

                <a
                  href={selectedApp.businessDocsUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid var(--tamas-border)',
                    backgroundColor: 'var(--card)',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>📜</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--tamas-fg)' }}>جواز / اجاره‌نامه</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--tamas-accent)' }}>مشاهده / دانلود</div>
                </a>

                <a
                  href={selectedApp.checkImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--tamas-accent)',
                    backgroundColor: 'var(--tamas-info-bg)',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>💳</div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--tamas-fg)' }}>برگ چک صیادی</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--tamas-accent)' }}>مشاهده / دانلود</div>
                </a>

                {selectedApp.bankStatementUrl && (
                  <a
                    href={selectedApp.bankStatementUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid var(--tamas-border)',
                      backgroundColor: 'var(--card)',
                      textDecoration: 'none',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>📊</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--tamas-fg)' }}>پرینت حساب</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--tamas-accent)' }}>مشاهده / دانلود</div>
                  </a>
                )}
              </div>
            </div>

            {/* Admin Controls Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid var(--tamas-border)', paddingTop: '16px' }}>
              <strong style={{ fontSize: '14px' }}>تعیین وضعیت و سقف اعتبار:</strong>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>وضعیت پرونده</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as CreditStatus)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--tamas-border)',
                      fontSize: '13px',
                    }}
                  >
                    <option value="pending">در انتظار بررسی</option>
                    <option value="reviewing">در حال بررسی</option>
                    <option value="active">تأیید شده (فعال)</option>
                    <option value="action_required">نیاز به ویرایش (اصلاح مدارک)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>سقف اعتبار (تومان)</label>
                  <input
                    type="number"
                    step={1000000}
                    value={editLimit}
                    onChange={(e) => setEditLimit(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--tamas-border)',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>نمره اعتباری (۰ تا ۱۰۰)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editScore}
                    onChange={(e) => setEditScore(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--tamas-border)',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              {editStatus === 'action_required' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--danger)' }}>
                    علت نیاز به ویرایش (نمایش به مشتری)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: تصویر چک ناخوانا است..."
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--danger)',
                      fontSize: '13px',
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
                  یادداشت داخلی (فقط برای ادمین)
                </label>
                <textarea
                  placeholder="یادداشت پشتیبانی و واحد مالی..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--tamas-border)',
                    fontSize: '13px',
                    minHeight: '60px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn ghost" onClick={() => setSelectedApp(null)}>
                  انصراف
                </button>
                <button type="button" className="btn primary" disabled={saving} onClick={handleSave}>
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
