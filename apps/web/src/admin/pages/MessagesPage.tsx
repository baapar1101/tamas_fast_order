import { Link } from 'react-router-dom';

export function MessagesPage() {
  return (
    <div className="a-page a-page--messages a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">Ù¾ÛŒØ§Ù…â€ŒÙ‡Ø§ Ùˆ Ø§Ø¹Ù„Ø§Ù†â€ŒÙ‡Ø§</h2>
          <p className="a-subtitle">Ù¾ÛŒÚ¯ÛŒØ±ÛŒ Ø§Ø¹Ù„Ø§Ù†â€ŒÙ‡Ø§ÛŒ Ø³ÛŒØ³ØªÙ…ÛŒ Ùˆ Ø§Ø±ØªØ¨Ø§Ø· Ø¨Ø§ Ù…Ø´ØªØ±ÛŒØ§Ù†</p>
        </div>
        <div className="a-page-actions">
          <span className="chip chip-aqua">Ù…Ø±Ú©Ø² Ø§Ø±ØªØ¨Ø§Ø·Ø§Øª</span>
        </div>
      </section>
      <section className="a-feature-grid">
        <article className="a-card">
          <span className="a-feature-icon a-feature-icon--green">âœ‰</span>
          <h3 className="mt-5 font-bold a-title-fallback">ØµÙ†Ø¯ÙˆÙ‚ Ù¾ÛŒØ§Ù… Ù…Ø´ØªØ±ÛŒØ§Ù†</h3>
          <p className="mt-2 text-xs leading-7 a-muted">Ù¾ÛŒØ§Ù…â€ŒÙ‡Ø§ÛŒ Ù…Ø´ØªØ±ÛŒØ§Ù† Ù¾Ø³ Ø§Ø² ÙØ¹Ø§Ù„â€ŒØ³Ø§Ø²ÛŒ Ø³Ø±ÙˆÛŒØ³ Ù¾ÛŒØ§Ù…â€ŒØ±Ø³Ø§Ù† Ø§ÛŒÙ†Ø¬Ø§ Ù†Ù…Ø§ÛŒØ´ Ø¯Ø§Ø¯Ù‡ Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯.</p>
        </article>
        <article className="a-card">
          <span className="a-feature-icon a-feature-icon--amber">â—</span>
          <h3 className="mt-5 font-bold a-title-fallback">Ø§Ø¹Ù„Ø§Ù†â€ŒÙ‡Ø§ÛŒ Ù…Ø¯ÛŒØ±ÛŒØªÛŒ</h3>
          <p className="mt-2 text-xs leading-7 a-muted">Ø³ÙØ§Ø±Ø´ Ø¬Ø¯ÛŒØ¯ØŒ Ø«Ø¨Øªâ€ŒÙ†Ø§Ù… Ú©Ø§Ø±Ø¨Ø± Ùˆ Ø®Ø·Ø§Ù‡Ø§ÛŒ Ù‡Ù…Ú¯Ø§Ù…â€ŒØ³Ø§Ø²ÛŒ Ø§Ø² Ù‡Ø¯Ø± Ù¾Ù†Ù„ Ù‚Ø§Ø¨Ù„ Ù…Ø´Ø§Ù‡Ø¯Ù‡â€ŒØ§Ù†Ø¯.</p>
          <Link to="/admin/sync" className="a-btn a-btn--secondary mt-5">Ù…Ø´Ø§Ù‡Ø¯Ù‡ ÙˆØ¶Ø¹ÛŒØª Ù‡Ù…Ú¯Ø§Ù…â€ŒØ³Ø§Ø²ÛŒ</Link>
        </article>
      </section>
    </div>
  );
}