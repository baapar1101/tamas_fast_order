import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatNumber } from '@tamas/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { BrandsPage } from './pages/BrandsPage';
import { OrdersPage } from './pages/OrdersPage';
import { UsersPage } from './pages/UsersPage';
import { AttributesPage } from './AttributesPage';
import { WarehousesPage } from './WarehousesPage';
import { SlidesPage } from './pages/SlidesPage';
import { UploadsPage } from './pages/UploadsPage';
import { SyncPage } from './pages/SyncPage';
import { SettingsPage } from './pages/SettingsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { MessagesPage } from './pages/MessagesPage';
import { MarketingPage } from './pages/MarketingPage';
// Load the reference admin design system first. The local stylesheet that
// follows contains the React-specific compatibility and component overrides.
import './reference.css';
import './admin.css';

const NAV_MAIN = [
  {
    to: '/admin',
    label: 'داشبورد',
    end: true,
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    to: '/admin/orders',
    label: 'سفارش‌ها',
    badge: 'orders',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
      </svg>
    ),
  },
  {
    to: '/admin/products',
    label: 'محصولات',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    to: '/admin/users',
    label: 'مشتریان',
    badge: 'users',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    to: '/admin/analytics',
    label: 'تحلیل‌ها',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    to: '/admin/categories',
    label: 'دسته‌بندی‌ها',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
  },
  {
    to: '/admin/brands',
    label: 'برندها',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h10.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25H3.75a2.25 2.25 0 01-2.25-2.25V6.75A2.25 2.25 0 013.75 4.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25h1.75a4.25 4.25 0 010 8.5H16.5M6 9h6M6 12h4.5M6 15h3" />
      </svg>
    ),
  },
  {
    to: '/admin/attributes',
    label: 'ویژگی‌ها',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h16.5A2.25 2.25 0 0122.5 6.75v10.5a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 17.25V6.75A2.25 2.25 0 013.75 4.5z" />
      </svg>
    ),
  },
  {
    to: '/admin/warehouses',
    label: 'انبارها',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18V8.25m-18 0V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v2.25m-18 0h18M5.25 6h.008v.008H5.25V6zM7.5 6h.008v.008H7.5V6zm2.25 0h.008v.008H9.75V6z" />
      </svg>
    ),
  },
  {
    to: '/admin/slides',
    label: 'بنرها (اسلایدر)',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
] as const;

const NAV_TOOLS = [
  {
    to: '/admin/messages',
    label: 'پیام‌ها',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    to: '/admin/marketing',
    label: 'بازاریابی',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
  },
  {
    to: '/admin/uploads',
    label: 'فایل‌ها و رسانه',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25z" />
      </svg>
    ),
  },
  {
    to: '/admin/sync',
    label: 'گوگل شیت',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.9" />
      </svg>
    ),
  },
  {
    to: '/admin/settings',
    label: 'تنظیمات',
    icon: (
      <svg className="h-5 w-5 icon-svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
] as const;

export default function AdminApp() {
  const { user, ready, isAdmin, logout } = useAuth();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState({ date: '', time: '' });

  // The reference stylesheet contains a complete utility/reset layer. Mark the
  // document while this lazy route is mounted so those rules never leak into
  // the storefront after client-side navigation.
  useEffect(() => {
    document.body.classList.add('admin-page-active');
    return () => document.body.classList.remove('admin-page-active');
  }, []);

  // Live Clock & Date formatting
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }).format(now);

      const timeStr = new Intl.DateTimeFormat('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);

      setCurrentTime({ date: dateStr, time: timeStr });
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-close dropdowns when route changes
  useEffect(() => {
    setNotifOpen(false);
    setProfileOpen(false);
    setMobileSidebarOpen(false);
  }, [location.pathname]);

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
    refetchInterval: 30_000,
  });

  if (!ready) {
    return (
      <div className="admin-body-shell flex items-center justify-center p-12">
        <div className="glass-card p-8 text-center">
          <div className="relative inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-glow mb-4">
            <svg className="h-6 w-6 text-slate-950 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-300">در حال بررسی دسترسی مدیریت...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="admin-body-shell" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        {/* Background Ambient Glows */}
        <div className="ambient-glow-container" aria-hidden="true">
          <div className="glow-orb-1" />
          <div className="glow-orb-2" />
          <div className="glow-orb-3" />
          <div className="grid-dot-pattern" />
        </div>

        <div className="glass-card-static" style={{ maxWidth: '26rem', width: '100%', padding: '2.5rem 2rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Shimmer top line */}
          <div className="shimmer-line animate-shimmer" style={{ position: 'absolute', insetInline: 0, top: 0, height: '1px' }} />

          {/* Shield Icon — properly sized */}
          <div style={{
            margin: '0 auto 1.5rem',
            width: '4rem',
            height: '4rem',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '1rem',
            background: 'linear-gradient(135deg, rgba(251,113,133,0.15), rgba(251,113,133,0.05))',
          }}>
            <svg style={{ width: '2rem', height: '2rem', color: '#fb7185' }} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>

          <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
            دسترسی مدیریت لازم است
          </h2>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.75', marginBottom: '1.5rem' }}>
            {user
              ? 'حساب کاربری شما دسترسی به پنل مدیریت ندارد.'
              : 'برای ورود به پنل مدیریت، ابتدا از فروشگاه وارد حساب کاربری خود شوید.'}
          </p>
          <Link
            to="/"
            className="huma-btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <svg style={{ width: '1rem', height: '1rem' }} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
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
    <div className="admin-body-shell">
      {/* Background Ambient Glows & Dot Pattern */}
      <div className="ambient-glow-container" aria-hidden="true">
        <div className="glow-orb-1" />
        <div className="glow-orb-2" />
        <div className="glow-orb-3" />
        <div className="grid-dot-pattern" />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="admin-sidebar-overlay fixed inset-0 z-30 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`admin-sidebar fixed right-0 top-0 z-40 flex h-screen w-72 flex-col border-l border-white/[0.06] bg-[#0b111d]/90 backdrop-blur-2xl transition-transform duration-500 lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Brand Logo Header */}
        <div className="flex items-center gap-3 px-6 pb-6 pt-7 border-b border-white/[0.06] mb-4">
          <div className="relative grid place-items-center">
            <img src="/admin-logo.svg" alt="Tamas Logo" className="h-11 w-11 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white leading-none">تماس مارکت</h1>
            <p className="mt-1 text-[11px] text-slate-500">پنل مدیریت هوشمند</p>
          </div>
          <button
            type="button"
            className="admin-sidebar-close icon-btn mr-auto lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="بستن منو"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sidebar Links */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
          <div>
            <p className="mb-2 px-4 text-[11px] font-semibold tracking-wide text-slate-500">منوی اصلی</p>
            <ul className="space-y-1">
              {NAV_MAIN.map((item) => {
                const count = badgeValue('badge' in item ? item.badge : undefined);
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={'end' in item ? item.end : false}
                      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      {count > 0 && (
                        <span className="mr-auto rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                          {formatNumber(count)}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <p className="mb-2 px-4 text-[11px] font-semibold tracking-wide text-slate-500">ابزارها و تنظیمات</p>
            <ul className="space-y-1">
              {NAV_TOOLS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Pro / Status Card at Sidebar Bottom */}
        <div className="p-4">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-[#131c2e] to-[#0e1626] p-4">
            <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-emerald-400/20 blur-2xl" />
            <div className="absolute inset-x-0 top-0 h-px shimmer-line animate-shimmer" />
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-xs font-bold text-white">نسخه حرفه‌ای تماس مارکت</h3>
            </div>
            <p className="text-[11px] leading-5 text-slate-400">اتصال هوشمند دیتابیس و مدیریت سفارش‌ها</p>
            <Link
              to="/admin/settings"
              className="mt-3 block text-center w-full rounded-xl bg-gradient-to-l from-emerald-500 to-cyan-500 py-2 text-xs font-bold text-slate-950 shadow-glow transition-all duration-300 hover:brightness-110 active:scale-95"
            >
              تنظیمات سیستم
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="admin-main-shell flex min-h-screen flex-col lg:mr-72">
        {/* Sticky Top Header */}
        <header className="admin-topbar sticky top-0 z-20 border-b border-white/[0.06] bg-[#070b12]/75 backdrop-blur-xl">
          <div className="flex h-[4.5rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
            {/* Mobile Menu Button */}
            <button
              type="button"
              className="admin-menu-toggle icon-btn lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="باز کردن منو"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Quick Search Input */}
            <div className="group relative hidden flex-1 max-w-md sm:block">
              <svg
                className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.8"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="جستجو در بخش مدیریت..."
                className="w-full rounded-xl border border-white/[0.06] bg-[#131c2e]/60 py-2 pr-11 pl-4 text-xs text-slate-200 placeholder:text-slate-500 outline-none transition-all duration-300 focus:border-emerald-500/40 focus:bg-[#131c2e] focus:shadow-glow"
              />
              <kbd className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/10 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500 md:block">
                ⌘K
              </kbd>
            </div>

            {/* Real-time Jalali Date & Clock */}
            <div className="mr-auto flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2.5 rounded-xl border border-white/[0.06] bg-[#131c2e]/60 px-4 py-2 md:flex">
                <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span className="text-xs font-medium text-slate-300">{currentTime.date || 'در حال دریافت...'}</span>
                <span className="h-3 w-px bg-white/10" />
                <span dir="ltr" className="text-xs font-semibold tabular-nums text-emerald-300">
                  {currentTime.time || '--:--:--'}
                </span>
              </div>

              {/* Notification Bell Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    setNotifOpen(!notifOpen);
                    setProfileOpen(false);
                  }}
                  aria-label="اعلان‌ها"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  <span className="absolute -left-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-slate-950 ring-2 ring-slate-950">
                    ۲
                  </span>
                </button>

                {notifOpen && (
                  <div className="absolute left-0 top-14 w-80 max-w-[calc(100vw-2rem)] z-50">
                    <div className="glass-card-static overflow-hidden !bg-[#0e1626]/95 p-0 shadow-2xl">
                      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                        <h3 className="text-sm font-bold text-white">اعلان‌ها</h3>
                        <span className="chip chip-brand">۲ مورد جدید</span>
                      </div>
                      <ul className="max-h-72 overflow-y-auto divide-y divide-white/[0.04]">
                        <li className="notif-item">
                          <span className="notif-dot bg-emerald-400" />
                          <div>
                            <p className="text-xs font-semibold text-slate-200">سفارش جدید دریافت شد</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">سفارش به ارزش ۲,۴۵۰,۰۰۰ <img src="/toman.svg" alt="تومان" style={{ width: '1em', height: '1em', display: 'inline' }} /> · ۳ دقیقه پیش</p>
                          </div>
                        </li>
                        <li className="notif-item">
                          <span className="notif-dot bg-amber-400" />
                          <div>
                            <p className="text-xs font-semibold text-slate-200">کد ملی ثبت نام شد</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">کاربر جدید کد ملی خود را جهت بررسی ارسال نمود · ۱۵ دقیقه پیش</p>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Menu Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-[#131c2e]/60 py-1.5 pl-3 pr-1.5 transition-all duration-300 hover:border-emerald-500/30"
                  onClick={() => {
                    setProfileOpen(!profileOpen);
                    setNotifOpen(false);
                  }}
                >
                  <span className="relative">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 text-sm font-extrabold text-slate-950">
                      {user?.name?.[0] || 'م'}
                    </span>
                    <span className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
                  </span>
                  <span className="hidden text-right md:block">
                    <span className="block text-xs font-bold text-white">{user?.name} {user?.lastName}</span>
                    <span className="block text-[10px] text-slate-500">مدیر سیستم</span>
                  </span>
                  <svg className="hidden h-4 w-4 text-slate-500 transition-transform duration-300 md:block" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {profileOpen && (
                  <div className="absolute left-0 top-14 w-72 max-w-[calc(100vw-2rem)] z-50">
                    <div className="glass-card-static overflow-hidden !bg-[#0e1626]/95 p-0 shadow-2xl">
                      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-base font-extrabold text-slate-950">
                          {user?.name?.[0] || 'م'}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">{user?.name} {user?.lastName}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{user?.phone}</p>
                          <span className="chip chip-brand mt-1.5">مدیر ارشد</span>
                        </div>
                      </div>
                      <ul className="py-2">
                        <li>
                          <Link to="/" className="profile-menu-item">
                            <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                            مشاهده وب‌سایت فروشگاه
                          </Link>
                        </li>
                        <li>
                          <Link to="/admin/settings" className="profile-menu-item">
                            <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            تنظیمات سیستم
                          </Link>
                        </li>
                      </ul>
                      <div className="border-t border-white/[0.06] p-2">
                        <button
                          type="button"
                          className="profile-menu-item text-rose-400 w-full hover:bg-rose-500/10 rounded-lg text-right"
                          onClick={() => void logout()}
                        >
                          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                          </svg>
                          خروج از حساب مدیریت
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="admin-main-content flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="brands" element={<BrandsPage />} />
            <Route path="taxonomy" element={<Navigate to="/admin/categories" replace />} />
            <Route path="attributes" element={<AttributesPage />} />
            <Route path="warehouses" element={<WarehousesPage />} />
            <Route path="slides" element={<SlidesPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="marketing" element={<MarketingPage />} />
            <Route path="uploads" element={<UploadsPage />} />
            <Route path="sync" element={<SyncPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
