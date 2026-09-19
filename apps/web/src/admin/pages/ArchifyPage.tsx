export function ArchifyPage() {
  return (
    <div className="admin-page space-y-6">
      <section className="admin-page-header animate-fade-up">
        <div>
          <span className="chip chip-aqua">Archify Architecture Diagram</span>
          <h2 className="mt-3 text-xl font-extrabold text-white sm:text-2xl">نمودار معماری سیستم</h2>
          <p className="mt-1 text-xs text-slate-400">نمایش تعاملی معماری کامل سیستم تماس مارکت</p>
        </div>
      </section>

      <section className="glass-card p-0 overflow-hidden">
        <div className="border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">نمایشگر معماری تعاملی</h3>
              <p className="mt-1 text-xs text-slate-500">نمودار معماری با قابلیت زوم، پیمایش و تم تاریک/روشن</p>
            </div>
            <a 
              href="/tamas-fast-order-architecture.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="chip chip-aqua cursor-pointer hover:bg-cyan-500/20 transition-colors"
            >
              باز در تب جدید
            </a>
          </div>
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