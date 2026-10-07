# Admin Panel Patterns

Reusable React patterns from the tamas-fast-order admin panel codebase.

## Tab Navigation
```tsx
const [activeTab, setActiveTab] = useState<'general' | 'tools' | 'logs' | 'sms' | 'crm'>('general')

<div className="flex gap-2 border-b border-white/[0.06] mb-6">
  <button
    type="button"
    className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${
      activeTab === 'general' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
    }`}
    onClick={() => setActiveTab('general')}
  >
    General
  </button>
  {/* ... more tabs */}
</div>
```

## Section Card
```tsx
<section className="glass-card p-6 space-y-4">
  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
    <div>
      <h3 className="text-base font-bold text-white">Section Title</h3>
      <p className="text-xs text-slate-400 mt-0.5">Optional description</p>
    </div>
    <span className="chip chip-brand">Status Label</span>
  </div>
  {/* ... content */}
</section>
```

## Action Button Pattern
```tsx
<button
  type="button"
  className="huma-btn-primary" // or huma-btn-secondary
  onClick={async () => {
    try {
      const res = await api.post<{ ok: boolean; /* ... */ }>('/api/endpoint', { /* payload */ })
      if (res.ok) toast.ok(`Success message with ${res.count} items`);
      else toast.error(`Failed: ${res.errorDetails?.slice(0,3).join(', ')}`);
    } catch (err: any) {
      toast.error(err.message || 'Unexpected error');
    }
  }}
>
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
    {/* icon path */}
  </svg>
  Button Label
</button>
```

## Settings Form Pattern
```tsx
const [form, setForm] = useState<Record<string, string>>({
  CRM_API_BASE: '',
  CRM_API_KEY: '',
  CRM_BUSINESS_ID: '1',
  CRM_WEBHOOK_SECRET: '',
  CRM_SYNC_ENABLED: 'false',
  CRM_SYNC_DEBOUNCE_MS: '500',
});

// Update single field
<input
  className="huma-input text-left font-mono"
  dir="ltr"
  value={form.CRM_API_BASE ?? ''}
  onChange={(e) => setForm({ ...form, CRM_API_BASE: e.target.value })}
/>

// Persist via existing settings API
await api.put('/admin/settings', { CRM_API_BASE: form.CRM_API_BASE, ... })
```

## Input Conventions
- API keys/tokens/secrets: `type="password"` with `dir="ltr"` and `font-mono`
- URLs: `dir="ltr"` with `font-mono`
- Numbers: `type="number"` with `dir="ltr"` and `font-mono`
- All inputs use `huma-input` class
- Toggle switches use standard `accent-emerald-500` checkbox styling

## Toast Feedback
```tsx
const toast = useToast();
toast.ok('Success message');
toast.error('Error message');
// No need for 'loading' toast with fire-and-forget sync calls
```

## Persistence Flow
1. Settings edited in form state
2. User clicks "Save Settings" (general tab)
3. `PUT /admin/settings` with flattened key/value pairs
4. Response message displayed as toast
5. CRM-specific buttons call their respective endpoints directly (no save step required)

## Conditional Rendering
```tsx
{activeTab === 'crm' && (
  <div className="space-y-6 animate-fade-up">
    {/* CRM-specific content */}
  </div>
)}
```