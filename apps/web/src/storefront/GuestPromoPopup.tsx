import { useState, useEffect } from 'react';
import { Icon } from '../components/Icon';
import './storefront.css';

interface Props {
  show: boolean;
  onAuth: () => void;
}

export function GuestPromoPopup({ show, onAuth }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show && !sessionStorage.getItem('tamas_guest_promo_shown')) {
      const timer = setTimeout(() => {
        setVisible(true);
        sessionStorage.setItem('tamas_guest_promo_shown', 'true');
      }, 1500); // Show after 1.5 seconds
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!visible) return null;

  return (
    <div className="ipp-overlay" onClick={() => setVisible(false)} style={{ zIndex: 10000 }}>
      <div className="ipp-dialog" onClick={(e) => e.stopPropagation()} style={{ padding: '32px 24px', textAlign: 'center' }}>
        <button
          type="button"
          className="ipp-close"
          onClick={() => setVisible(false)}
          title="بستن"
        >
          <Icon name="x" />
        </button>
        
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--tamas-promo-grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 20px' }}>
          <Icon name="lock" />
        </div>
        
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12, color: 'var(--tamas-fg)' }}>
          برای مشاهده قیمت‌های همکاری ثبت‌نام کنید
        </h2>
        
        <p style={{ fontSize: 13, color: 'var(--tamas-muted)', marginBottom: 24, lineHeight: 1.7 }}>
          تماس مارکت قیمت‌های ویژه و عمده را تنها برای همکاران و کاربران ثبت‌نام شده نمایش می‌دهد. برای دسترسی به قیمت‌ها هم‌اکنون وارد شوید.
        </p>
        
        <button 
          type="button" 
          className="btn primary w-full" 
          onClick={() => {
            setVisible(false);
            onAuth();
          }}
        >
          ثبت‌نام / ورود همکاران
        </button>
      </div>
    </div>
  );
}
