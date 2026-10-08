import './goldenCampaign.css';

export function GoldenCampaignCopy() {
  return (
    <div className="golden-campaign-overlay" dir="rtl">
      <div className="golden-campaign-copy">
        <span className="golden-campaign-kicker">فروش ویژه تماس مارکت</span>
        <h2><span>۴ روز طلایی</span> تماس مارکت</h2>
        <p className="golden-campaign-range">۷ سبد فروش و <strong>+۳۵۰ قلم کالا</strong></p>
        <p className="golden-campaign-terms">روی دلار <strong>۲۲۰ هزار تومن</strong> و <strong>تسویه تا ۵ ماه!</strong></p>
        <span className="golden-campaign-deadline">فقط تا ۲۰ام</span>
      </div>
    </div>
  );
}
