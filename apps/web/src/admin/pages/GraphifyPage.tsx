export function GraphifyPage() {
  return (
    <div className="admin-page space-y-6">
      <section className="admin-page-header animate-fade-up">
        <div>
          <span className="chip chip-brand">Graphify Knowledge Graph</span>
          <h2 className="mt-3 text-xl font-extrabold text-white sm:text-2xl">گراف دانش Graphify</h2>
          <p className="mt-1 text-xs text-slate-400">نمایش تعاملی گراف دانش کد‌بیس و روابط بین فایل‌ها</p>
        </div>
      </section>

      <section className="glass-card p-0 overflow-hidden">
        <div className="border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">نمایشگر گراف تعاملی</h3>
              <p className="mt-1 text-xs text-slate-500">گراف دانش کامل پروژه با قابلیت جستجو و کاوش</p>
            </div>
            <a 
              href="/graph.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="chip chip-brand cursor-pointer hover:bg-emerald-500/20 transition-colors"
            >
              باز در تب جدید
            </a>
          </div>
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