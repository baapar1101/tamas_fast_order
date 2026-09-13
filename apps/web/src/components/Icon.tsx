import type { SVGProps } from 'react';

export type IconName =
  | 'star'
  | 'star-fill'
  | 'user'
  | 'search'
  | 'heart'
  | 'heart-fill'
  | 'bag'
  | 'mobile'
  | 'money'
  | 'bolt'
  | 'chart'
  | 'handshake'
  | 'phone'
  | 'pin'
  | 'mail'
  | 'clock'
  | 'book'
  | 'help'
  | 'cash'
  | 'card'
  | 'doc'
  | 'box'
  | 'receipt'
  | 'bank'
  | 'calendar'
  | 'eye'
  | 'shield'
  | 'tag'
  | 'warn'
  | 'printer'
  | 'check'
  | 'chevron'
  | 'home'
  | 'grid'
  | 'filter'
  | 'sort'
  | 'support';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  className?: string;
}

export function Icon({ name, className = '', ...props }: IconProps) {
  const fullClass = `ic${className ? ` ${className}` : ''}`;
  return (
    <svg className={fullClass} aria-hidden="true" {...props}>
      <use href={`#i-${name}`} />
    </svg>
  );
}

export function SvgSprite() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" style={{ display: 'none' }} aria-hidden="true">
      <symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.87l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85z"/></symbol>
      <symbol id="i-star-fill" viewBox="0 0 24 24"><path d="M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.87l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85z" fill="currentColor" stroke="none"/></symbol>
      <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.6"/><path d="M15.9 15.9l4.6 4.6"/></symbol>
      <symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20.3l-1.35-1.23C6.1 14.96 3.2 12.33 3.2 9.1A4.4 4.4 0 0 1 7.6 4.7c1.5 0 2.94.7 3.9 1.8a5.2 5.2 0 0 1 3.9-1.8 4.4 4.4 0 0 1 4.4 4.4c0 3.23-2.9 5.86-7.45 9.98z"/></symbol>
      <symbol id="i-heart-fill" viewBox="0 0 24 24"><path d="M12 20.3l-1.35-1.23C6.1 14.96 3.2 12.33 3.2 9.1A4.4 4.4 0 0 1 7.6 4.7c1.5 0 2.94.7 3.9 1.8a5.2 5.2 0 0 1 3.9-1.8 4.4 4.4 0 0 1 4.4 4.4c0 3.23-2.9 5.86-7.45 9.98z" fill="currentColor" stroke="none"/></symbol>
      <symbol id="i-bag" viewBox="0 0 24 24"><path d="M5.6 7.8h12.8l1 12.7H4.6z"/><path d="M9 7.8V6.4a3 3 0 0 1 6 0v1.4"/></symbol>
      <symbol id="i-mobile" viewBox="0 0 24 24"><rect x="6.8" y="2.6" width="10.4" height="18.8" rx="2.6"/><path d="M10.4 18.4h3.2"/></symbol>
      <symbol id="i-money" viewBox="0 0 24 24"><rect x="2.6" y="6.2" width="18.8" height="11.6" rx="1.9"/><circle cx="12" cy="12" r="2.6"/><path d="M5.8 12h.01M18.2 12h.01"/></symbol>
      <symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13.6 2.6L5.6 13.4h5l-.6 8 8-11h-5z"/></symbol>
      <symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20.2h16"/><path d="M6.6 17.4v-5.6M11.4 17.4V7.6M16.2 17.4v-3.4"/></symbol>
      <symbol id="i-handshake" viewBox="0 0 24 24"><path d="M2.8 12.6l3.4-3.4a2 2 0 0 1 2.8 0l1.6 1.6 1.6-1.6a2 2 0 0 1 2.8 0l3.4 3.4"/><path d="M7.6 14.6l2.8 2.8a2 2 0 0 0 2.8 0l2.8-2.8"/></symbol>
      <symbol id="i-phone" viewBox="0 0 24 24"><path d="M6.4 3.6h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a1.6 1.6 0 0 1-1.7 1.6A15.6 15.6 0 0 1 4.8 5.2 1.6 1.6 0 0 1 6.4 3.6z"/></symbol>
      <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21.2s6.6-5.7 6.6-10.4A6.6 6.6 0 0 0 5.4 10.8C5.4 15.5 12 21.2 12 21.2z"/><circle cx="12" cy="10.6" r="2.4"/></symbol>
      <symbol id="i-mail" viewBox="0 0 24 24"><rect x="2.8" y="5.4" width="18.4" height="13.2" rx="2"/><path d="M3.4 7l8.6 6 8.6-6"/></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M12 7v5.2l3.3 2"/></symbol>
      <symbol id="i-book" viewBox="0 0 24 24"><path d="M12 7.4a3.6 3.6 0 0 0-3.6-2.8H3.2v13h5.6a3.2 3.2 0 0 1 3.2 2.4 3.2 3.2 0 0 1 3.2-2.4h5.6v-13h-5.2A3.6 3.6 0 0 0 12 7.4z"/><path d="M12 7.4v12.6"/></symbol>
      <symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2-2.4 3.6"/><path d="M12 17.3h.01"/></symbol>
      <symbol id="i-cash" viewBox="0 0 24 24"><rect x="2.6" y="6.4" width="18.8" height="11.2" rx="1.8"/><circle cx="12" cy="12" r="2.5"/><path d="M5.6 9.6h.01M18.4 14.4h.01"/></symbol>
      <symbol id="i-card" viewBox="0 0 24 24"><rect x="2.6" y="5" width="18.8" height="14" rx="2.4"/><path d="M2.6 9.8h18.8"/><path d="M6 15h4.2"/></symbol>
      <symbol id="i-doc" viewBox="0 0 24 24"><path d="M13.6 3.4H7.2a2 2 0 0 0-2 2v13.2a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V8.8z"/><path d="M13.6 3.4v5.4h5.2"/><path d="M8.4 13h7.2M8.4 16.4h4.6"/></symbol>
      <symbol id="i-box" viewBox="0 0 24 24"><path d="M3.6 8L12 3.6 20.4 8v8L12 20.4 3.6 16z"/><path d="M3.6 8l8.4 4.4L20.4 8M12 12.4v8"/></symbol>
      <symbol id="i-receipt" viewBox="0 0 24 24"><path d="M6 3.4h12v17.2l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z"/><path d="M9 8.4h6M9 12.4h6"/></symbol>
      <symbol id="i-bank" viewBox="0 0 24 24"><path d="M3.4 9.4L12 4l8.6 5.4"/><path d="M5.6 9.8v7.8M9.6 9.8v7.8M14.4 9.8v7.8M18.4 9.8v7.8"/><path d="M3.4 20.4h17.2"/></symbol>
      <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3.4" y="5.4" width="17.2" height="15.2" rx="2"/><path d="M3.4 10.4h17.2M8 3.4v4M16 3.4v4"/></symbol>
      <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.6 12S6.2 5.9 12 5.9 21.4 12 21.4 12 17.8 18.1 12 18.1 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.8"/></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3.2l7 2.8v5.4c0 4.3-3 7.6-7 9.4-4-1.8-7-5.1-7-9.4V6z"/></symbol>
      <symbol id="i-tag" viewBox="0 0 24 24"><path d="M11.4 3.4H5.2a1.8 1.8 0 0 0-1.8 1.8v6.2a2 2 0 0 0 .6 1.4l7.6 7.6a2 2 0 0 0 2.8 0l6.2-6.2a2 2 0 0 0 0-2.8L12.8 4a2 2 0 0 0-1.4-.6z"/><circle cx="7.9" cy="7.9" r="1.3"/></symbol>
      <symbol id="i-warn" viewBox="0 0 24 24"><path d="M12 3.8l9 15.7H3z"/><path d="M12 9.6v4.2M12 16.9h.01"/></symbol>
      <symbol id="i-printer" viewBox="0 0 24 24"><path d="M7 8.4V3.4h10v5"/><rect x="3.4" y="8.4" width="17.2" height="8" rx="2"/><path d="M7 13.4h10v7.2H7z"/></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M4.6 12.6l5 5 9.8-11"/></symbol>
      <symbol id="i-chevron" viewBox="0 0 24 24"><path d="M6.5 9.5l5.5 5.5 5.5-5.5"/></symbol>
      <symbol id="i-home" viewBox="0 0 24 24"><path d="M3.6 10.4L12 3.6l8.4 6.8v9a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6z"/><path d="M9.4 21v-7.2h5.2V21"/></symbol>
      <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3.6" y="3.6" width="7" height="7" rx="1.8"/><rect x="13.4" y="3.6" width="7" height="7" rx="1.8"/><rect x="3.6" y="13.4" width="7" height="7" rx="1.8"/><rect x="13.4" y="13.4" width="7" height="7" rx="1.8"/></symbol>
      <symbol id="i-filter" viewBox="0 0 24 24"><path d="M3.6 6.4h16.8M6.8 12h10.4M10 17.6h4"/></symbol>
      <symbol id="i-sort" viewBox="0 0 24 24"><path d="M7 4.6v14.8M7 19.4l-3-3M7 4.6l3 3M17 19.4V4.6M17 4.6l3 3M17 19.4l-3-3"/></symbol>
      <symbol id="i-support" viewBox="0 0 24 24"><path d="M4.6 14.2v-2.4a7.4 7.4 0 0 1 14.8 0v2.4"/><rect x="2.8" y="12.8" width="4" height="6" rx="2"/><rect x="17.2" y="12.8" width="4" height="6" rx="2"/><path d="M19.4 18.8v.6a2.6 2.6 0 0 1-2.6 2.6H13"/></symbol>
    </svg>
  );
}
