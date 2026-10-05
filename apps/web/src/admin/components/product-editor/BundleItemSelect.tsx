import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProductDTO } from '@tamas/shared';
import { api } from '../../../lib/api';

export function BundleItemSelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [term, setTerm] = useState(value);
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState(term);

  useEffect(() => { setTerm(value); }, [value]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 400);
    return () => clearTimeout(t);
  }, [term]);

  const { data } = useQuery({
    queryKey: ['adminSearchProducts', debounced],
    queryFn: () => api.get<{ items: ProductDTO[] }>('/admin/products', { search: debounced, limit: 15 }),
    enabled: debounced.length > 1 && open,
  });

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="a-input font-mono"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="جستجوی نام یا شناسه..."
        autoComplete="off"
      />
      {open && data?.items && data.items.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 50, width: '100%', top: '100%', left: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--tamas-border)', borderRadius: 8, maxHeight: 250, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {data.items.map((p) => (
            <button
              key={p.productId}
              type="button"
              style={{ width: '100%', textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid var(--tamas-border)', background: 'transparent' }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTerm(p.productId);
                onChange(p.productId);
                setOpen(false);
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tamas-fg)', marginBottom: 4 }}>{p.title}</div>
              <div style={{ fontSize: 11, color: 'var(--tamas-muted)', fontFamily: 'monospace' }}>{p.productId}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
