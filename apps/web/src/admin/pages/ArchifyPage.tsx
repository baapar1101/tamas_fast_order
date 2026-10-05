export function ArchifyPage() {
  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">نمودار معماری سیستم</h2>
          <p className="a-subtitle">نمایش تعاملی معماری کامل سیستم تماس مارکت</p>
        </div>
        <div className="a-page-actions">
          <span className="chip chip-aqua">Archify Architecture Diagram</span>
        </div>
      </section>

      <section className="a-card a-card--flush">
        <div className="a-card-head a-card-head--px">
          <div>
            <h3 className="a-card-title">نمایشگر معماری تعاملی</h3>
            <p className="a-card-desc">نمودار معماری با قابلیت زوم، پیمایش و تم تاریک/روشن</p>
          </div>
          <a
            href="/tamas-fast-order-architecture.html"
            target="_blank"
            rel="noopener noreferrer"
            className="a-btn a-btn--secondary"
          >
            باز در تب جدید
          </a>
        </div>
        <div className="relative" style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}>
          <iframe
            src="/tamas-fast-order-architecture.html"
            className="w-full h-full border-0"
            title="System Architecture Diagram"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      </section>
    </div>
  );
}