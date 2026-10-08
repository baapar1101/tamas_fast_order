import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AccountOutletContext } from './AccountLayout';
import { CreditDashboard } from './CreditDashboard';
import './credit-page.css';

export function CreditPage() {
  const navigate = useNavigate();
  const { returnTo } = useOutletContext<AccountOutletContext>();

  return (
    <section className="credit-page">
      <div className="credit-page-heading">
        <span>خدمات مالی همکاران</span>
        <h2>💳 پنل خریداران اعتباری تماس مارکت</h2>
        <p>وضعیت اعتبار، چک‌ها، سررسیدها و مدارک پروندهٔ خود را در همین صفحه مدیریت کنید.</p>
      </div>
      <CreditDashboard onBack={() => navigate(returnTo)} />
    </section>
  );
}
