import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatNumber } from '@tamas/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { TaxonomyPage } from './pages/TaxonomyPage';
import { OrdersPage } from './pages/OrdersPage';
import { UsersPage } from './pages/UsersPage';
import { UploadsPage } from './pages/UploadsPage';
import { SyncPage } from './pages/SyncPage';
import { SettingsPage } from './pages/SettingsPage';
import './admin.css';

const NAV = [
  { to: '/admin', label: 'داشبورد', icon: '📊', end: true },
  { to: '/admin/products', label: 'محصولات', icon: '📦' },
  { to: '/admin/taxonomy', label: 'دسته و برند', icon: '🏷️' },
  { to: '/admin/orders', label: 'سفارش‌ها', icon: '🧾', badge: 'orders' },
  { to: '/admin/users', label: 'کاربران', icon: '👥', badge: 'users' },
  { to: '/admin/uploads', label: 'فایل‌ها', icon: '🖼️' },
  { to: '/admin/sync', label: 'گوگل شیت', icon: '🔄' },
  { to: '/admin/settings', label: 'تنظیمات', icon: '⚙️' },
] as const;

export default function AdminApp() {
  const { user, ready, isAdmin, logout } = useAuth();

  // Small poll so a new order shows up in the sidebar without a refresh.
  const counters = useQuery({
    queryKey: ['admin', 'counters'],
    queryFn: async () => {
      const [orders, users] = await Promise.all([
        api.get<{ counts: Record<string, number> }>('/admin/orders/status-counts'),
        api.get<{ total: number }>('/admin/users', { status: 'pending', perPage: 1 }),
      ]);
      return { newOrders: orders.counts.new ?? 0, pendingUsers: users.total };
    },
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  if (!ready) {
    return <div className="empty" style={{ paddingBlock: 120 }}>در حال بررسی دسترسی…</div>;
  }

  if (!user || !isAdmin) {
    return (
      <div className="container" style={{ maxWidth: 460, paddingBlock: 80 }}>
        <div className="card" style={{ padding: 26, textAlign: 'center' }}>
          <h2 style={{ marginTop: 0, fontSize: 17 }}>دسترسی مدیریت لازم است</h2>
          <p className="muted">
            {user ? 'حساب شما دسترسی به پنل مدیریت ندارد.' : 'برای ورود به پنل، ابتدا از فروشگاه وارد حساب خود شوید.'}
          </p>
          <Link to="/" className="btn primary block" style={{ marginTop: 14 }}>
            بازگشت به فروشگاه
          </Link>
        </div>
      </div>
    );
  }

  const badgeValue = (key?: string): number => {
    if (key === 'orders') return counters.data?.newOrders ?? 0;
    if (key === 'users') return counters.data?.pendingUsers ?? 0;
    return 0;
  };

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-brand">
          <img src="/logo.png" alt="تماس مارکت" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#fff' }}>پنل مدیریت</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>تماس مارکت</div>
          </div>
        </div>

        <nav className="admin-nav">
          {NAV.map((item) => {
            const count = badgeValue('badge' in item ? item.badge : undefined);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) => `admin-link${isActive ? ' active' : ''}`}
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
                {count > 0 && <span className="pill">{formatNumber(count)}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="admin-side-foot">
          <div style={{ marginBottom: 8, opacity: 0.8 }}>
            {user.name} {user.lastName}
          </div>
          <Link to="/" className="admin-link" style={{ padding: '7px 10px' }}>
            ← بازگشت به فروشگاه
          </Link>
          <button
            type="button"
            className="admin-link"
            style={{ padding: '7px 10px', background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}
            onClick={() => void logout()}
          >
            خروج از حساب
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Routes>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="taxonomy" element={<TaxonomyPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="uploads" element={<UploadsPage />} />
          <Route path="sync" element={<SyncPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}
