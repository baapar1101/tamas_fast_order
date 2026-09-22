import type { OrderStatus, UploadKind, Warehouse } from './schemas.js';

export interface ApiError {
  ok: false;
  error: string;
  code?: string;
  details?: unknown;
  /** Set when the caller's session token is no longer valid. */
  expired?: boolean;
  /** Profile fields the caller still has to fill in. */
  missing?: string[];
}

export type ApiResult<T> = ({ ok: true } & T) | ApiError;

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

export interface ProductAttribute {
  key: string;
  value: string;
}

export interface ProductDTO {
  id: number;
  productId: string;
  sku: string | null;
  title: string;
  model: string | null;
  parentProductId: string | null;
  categoryName: string | null;
  categoryFaName: string | null;
  brandName: string | null;
  brandFaName: string | null;
  color: string | null;
  colorEn: string | null;
  colorCode: string | null;
  price: number;
  oldPrice: number | null;
  discount: number;
  stock: number;
  kermanStock: number;
  tehranStock: number;
  otherStocks: Record<string, number>;
  warranty: string | null;
  sellType: string | null;
  seller: string | null;
  promotion: boolean;
  status: 'active' | 'inactive';
  subTitle: string | null;
  description: string | null;
  keywords: string | null;
  slug: string | null;
  ribbon: string | null;
  type: string;
  weight: number;
  dimensions: string | null;
  tracking: boolean;
  imageUrl: string | null;
  gallery: string[];
  attributes: ProductAttribute[];
  digikalaLink: string | null;
  sortOrder: number;
    createdAt: string;
    updatedAt: string;
  }

/** Variants of one model are grouped so the storefront renders a single card. */
export interface ProductGroupDTO {
  key: string;
  title: string;
  imageUrl: string | null;
  promotion: boolean;
  minPrice: number;
  variants: ProductDTO[];
}

export interface CategoryDTO {
  id: number;
  name: string;
  faName: string;
  iconUrl: string | null;
  sortOrder: number;
  brandNames: string[];
  productCount?: number;
}

export interface BrandDTO {
  id: number;
  name: string;
  faName: string;
  iconUrl: string | null;
  sortOrder: number;
  productCount?: number;
}

export interface ColorDTO {
  id: number;
  code: string;
  name: string | null;
  faName: string | null;
}

export interface UserDTO {
  id: number;
  phone: string;
  name: string;
  lastName: string;
  storeName: string;
  landline: string;
  address: string;
  postalCode: string;
  certificateFileUrl: string;
  activity: string;
  pageWebsite: string;
  nationalCode?: string;
  birthDate?: string;
  fatherName?: string;
  isVerifiedIdentity?: boolean;
  isActive: boolean;
  role: 'customer' | 'admin' | 'operator';
  accessGroupId?: number | null;
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthStateDTO {
  token: string;
  user: UserDTO;
  complete: boolean;
  missing: string[];
  isNew: boolean;
}

export interface OrderItemDTO {
  id: number;
  productId: string;
  sku: string | null;
  title: string;
  color: string | null;
  price: number;
  qty: number;
  warehouse: Warehouse;
}

export interface OrderDTO {
  id: number;
  orderCode: string;
  userId: number | null;
  customerName: string;
  phone: string;
  storeName: string | null;
  address: string;
  total: number;
  quantity: number;
  status: OrderStatus;
  paymentStatus: 'paid' | 'unpaid' | 'pending';
  paymentMethod: string | null;
  note: string | null;
  items: OrderItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface UploadDTO {
  id: number;
  kind: UploadKind;
  url: string;
  thumbUrl: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface SyncStateDTO {
  entity: string;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
  lastError: string | null;
  rowsPulled: number;
  rowsPushed: number;
}

export interface SyncConflictDTO {
  id: number;
  entity: string;
  entityKey: string;
  field: string;
  dbValue: string | null;
  sheetValue: string | null;
  /** Which side the last-write-wins rule picked. */
  resolvedTo: 'db' | 'sheet';
  createdAt: string;
}

export interface SyncReport {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  entities: Array<{
    entity: string;
    pulled: number;
    pushed: number;
    created: number;
    updated: number;
    conflicts: number;
    skipped: number;
    error?: string;
  }>;
}

export interface DashboardStats {
  productCount: number;
  activeProductCount: number;
  outOfStockCount: number;
  newProduct30: number;
  userCount: number;
  pendingUserCount: number;
  newUser30: number;
  orderCount: number;
  newOrderCount: number;
  revenueTotal: number;
  revenueLast30Days: number;
  ordersPerDay: Array<{ day: string; count: number; total: number }>;
  topProducts: Array<{ title: string; qty: number; total: number }>;
  lastSyncAt: string | null;
}

export interface PaymentDTO {
  id: number;
  orderId: number | null;
  userId: number | null;
  amount: number;
  gateway: string;
  refId: string | null;
  trackingCode: string | null;
  status: 'pending' | 'success' | 'failed';
  cardPan: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommentDTO {
  id: number;
  productId: number;
  userId: number | null;
  guestName: string | null;
  guestEmail: string | null;
  rating: number;
  content: string;
  replyTo: number | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}
