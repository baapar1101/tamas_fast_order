export function GraphifyPage() {
  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">گراف دانش Graphify</h2>
          <p className="a-subtitle">نمایش تعاملی گراف دانش کد‌بیس و روابط بین فایل‌ها</p>
        </div>
        <div className="a-page-actions">
          <span className="chip chip-brand">Graphify Knowledge Graph</span>
        </div>
      </section>

      <section className="a-card a-card--flush">
        <div className="a-card-head a-card-head--px">
          <div>
            <h3 className="a-card-title">نمایشگر گراف تعاملی</h3>
            <p className="a-card-desc">گراف دانش کامل پروژه با قابلیت جستجو و کاوش</p>
          </div>
          <a
            href="/graph.html"
            target="_blank"
            rel="noopener noreferrer"
            className="a-btn a-btn--primary"
          >
            باز در تب جدید
          </a>
        </div>
        <div className="relative" style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}>
          <iframe
            src="/graph.html"
            className="w-full h-full border-0"
            title="Graphify Knowledge Graph"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      </section>
    </div>
  );
}