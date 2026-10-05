import type { BrandDTO, CategoryDTO, ProductDTO } from '@tamas/shared';
import type { ReactNode } from 'react';

export interface ProductForm {
  productId: string;
  sku: string;
  title: string;
  model: string;
  categoryName: string;
  brandName: string;
  color: string;
  colorEn: string;
  colorCode: string;
  price: number;
  oldPrice: number | null;
  discount: number;
  stock: number;
  kermanStock: number;
  tehranStock: number;
  otherStocks: Record<string, number>;
  parentProductId: string;
  warranty: string;
  sellType: string;
  seller: string;
  promotion: boolean;
  status: 'active' | 'inactive';
  imageUrl: string;
  gallery: string[];
  attributes: Array<{ key: string; value: string }>;
  sortOrder: number;
  subTitle: string;
  description: string;
  keywords: string;
  slug: string;
  ribbon: string;
  type: string;
  weight: number;
  dimensions: string;
  tracking: boolean;
  digikalaLink: string;
  targetSiteUrl: string;
  trackingLinks: Array<{ siteId: number; url: string }>;
  bundleItems: Array<{ productId: string; qty: number }>;
}

export interface ProductEditorProps {
  product: ProductDTO | null;
  template?: ProductDTO;
  categories: CategoryDTO[];
  brands: BrandDTO[];
  busy: boolean;
  isBundleMode?: boolean;
  onClose: () => void;
  onSave: (form: ProductForm) => void;
  onManageVariants?: (product: ProductDTO) => void;
}

export interface AttributeDef {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
}

export interface ProductAccordionSectionProps {
  id: string;
  title: string;
  description?: string;
  summary?: string;
  className?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}
