import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProductDTO, TrackingSiteDTO } from '@tamas/shared';
import { api } from '../../../lib/api';

import {
  GeneralInfoSection,
  ColorAppearanceSection,
  GallerySection,
  BundleItemsSection,
  PricingSection,
  ShippingSection,
  AttributesSection,
  SeoSection,
  TaxonomySection,
  SettingsSection,
  VariantsSection,
  SellTypeSection,
  TargetSiteSection,
} from './sections';
import type { ProductEditorProps as Props, ProductForm, AttributeDef } from './types';
import { blank, fromProduct } from './utils';

export function ProductEditor({ product, template, categories, brands, busy, isBundleMode, onClose, onSave, onManageVariants }: Props) {
  const [form, setForm] = useState<ProductForm>(product ? fromProduct(product) : template ? fromProduct(template) : blank());
  const [error, setError] = useState('');

  // Variants Fetching (if editing an existing parent product)
  const { data: variantsData, isLoading: variantsLoading } = useQuery({
    queryKey: ['admin', 'products', 'variants', form.productId],
    queryFn: () => api.get<{ items: ProductDTO[] }>('/admin/products', { parentProductId: form.productId }),
    enabled: !!product && !!form.productId && !form.parentProductId,
  });
  const variants = variantsData?.items ?? [];

  const { data: attributeDefs } = useQuery({
    queryKey: ['admin', 'attributes'],
    queryFn: () => api.get<AttributeDef[]>('/admin/attributes'),
    staleTime: 60_000,
  });
  const { data: trackingSitesData } = useQuery({
    queryKey: ['admin', 'tracking-sites'],
    queryFn: () => api.get<{ items: TrackingSiteDTO[] }>('/admin/tracking-sites'),
    staleTime: 30_000,
  });
  const trackingSites = (trackingSitesData?.items ?? []).filter((site) => site.isActive || form.trackingLinks.some((link) => link.siteId === site.id));
  const attrByKey = new Map((attributeDefs ?? []).map((d) => [d.name.trim(), d]));

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm({ ...form, [key]: value });

  const setTrackingUrl = (siteId: number, url: string) => {
    const existing = form.trackingLinks.find((link) => link.siteId === siteId);
    if (!url.trim()) {
      set('trackingLinks', form.trackingLinks.filter((link) => link.siteId !== siteId));
      return;
    }
    if (!existing && form.trackingLinks.length >= 3) {
      setError('برای هر محصول حداکثر سه سایت قابل رهگیری است.');
      return;
    }
    setError('');
    set('trackingLinks', existing
      ? form.trackingLinks.map((link) => link.siteId === siteId ? { ...link, url } : link)
      : [...form.trackingLinks, { siteId, url }]);
  };

  function submit() {
    if (!form.productId.trim()) {
      setError('کد کالا (product_id) الزامی است.');
      return;
    }
    if (!form.title.trim()) {
      setError('عنوان محصول الزامی است.');
      return;
    }
    setError('');
    onSave({
      ...form,
      productId: form.productId.trim(),
      title: form.title.trim(),
      oldPrice: form.oldPrice && form.oldPrice > 0 ? form.oldPrice : null,
    });
  }

  const titleText = product ? 'ویرایش محصول' : 'ایجاد محصول';

  return (
    <div className="product-editor-page flex flex-col h-full animate-fade-in pb-20 lg:pb-0">
      {/* Sticky Toolbar */}
      <div className="a-stickybar mb-6">
        <div className="a-stickybar-head">
          <button
            type="button"
            onClick={onClose}
            className="a-btn a-btn--ghost a-btn--sm"
            aria-label="بستن"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <div className="flex flex-col">
            <span className="a-stickybar-title">{titleText}</span>
            {product && <span className="a-subtitle">{product.title}</span>}
          </div>
        </div>
        <div className="a-stickybar-actions">
          <button type="button" className="a-btn a-btn--secondary" onClick={onClose} disabled={busy}>
            انصراف
          </button>
          <button type="button" className="a-btn a-btn--primary" onClick={submit} disabled={busy}>
            {busy ? 'در حال ذخیره…' : 'ذخیره محصول'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4">
          <div className="a-error-box">{error}</div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="admin-page-grid">

        {/* Left Column (Main Content Blocks) */}
        <div className="space-y-6">
          <GeneralInfoSection product={product} form={form} set={set} />
          <ColorAppearanceSection form={form} set={set} />
          <GallerySection form={form} set={set} />
          <BundleItemsSection form={form} set={set} />
          <PricingSection form={form} set={set} isBundleMode={isBundleMode} />
          <ShippingSection form={form} set={set} />
          <AttributesSection form={form} set={set} attributeDefs={attributeDefs ?? []} attrByKey={attrByKey} />
          <SeoSection form={form} set={set} />
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-6">
          <TaxonomySection form={form} set={set} categories={categories} brands={brands} />
          <SettingsSection form={form} set={set} />
          <TargetSiteSection form={form} trackingSites={trackingSites} setTrackingUrl={setTrackingUrl} />
          <SellTypeSection form={form} set={set} />
          <VariantsSection product={product} form={form} variants={variants} variantsLoading={variantsLoading} onManageVariants={onManageVariants} />
        </div>
      </div>
    </div>
  );
}
