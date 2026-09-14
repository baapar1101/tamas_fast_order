import { z } from 'zod';
export declare const phoneSchema: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
export declare const idSchema: z.ZodNumber;
/** Sheets hand back "TRUE"/"FALSE"/1/0 as often as real booleans. */
export declare const sheetBool: z.ZodEffects<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodNull, z.ZodUndefined]>, boolean, string | number | boolean | null | undefined>;
export declare const priceSchema: z.ZodNumber;
export declare const stockSchema: z.ZodNumber;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    perPage: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    perPage: number;
}, {
    page?: number | undefined;
    perPage?: number | undefined;
}>;
export declare const productAttributeSchema: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: string;
    key: string;
}, {
    value: string;
    key: string;
}>;
export declare const productWriteSchema: z.ZodObject<{
    productId: z.ZodString;
    parentProductId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sku: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    title: z.ZodString;
    model: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    categoryName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    brandName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    color: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    colorEn: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    colorCode: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    price: z.ZodDefault<z.ZodNumber>;
    oldPrice: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    discount: z.ZodDefault<z.ZodNumber>;
    stock: z.ZodDefault<z.ZodNumber>;
    kermanStock: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    tehranStock: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    otherStocks: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    warranty: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sellType: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    seller: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    promotion: z.ZodDefault<z.ZodEffects<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodNull, z.ZodUndefined]>, boolean, string | number | boolean | null | undefined>>;
    status: z.ZodDefault<z.ZodEnum<["active", "inactive"]>>;
    imageUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    gallery: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    attributes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        key: string;
    }, {
        value: string;
        key: string;
    }>, "many">>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "inactive";
    productId: string;
    title: string;
    price: number;
    discount: number;
    stock: number;
    otherStocks: Record<string, number>;
    promotion: boolean;
    gallery: string[];
    attributes: {
        value: string;
        key: string;
    }[];
    sortOrder: number;
    parentProductId?: string | null | undefined;
    sku?: string | null | undefined;
    model?: string | null | undefined;
    categoryName?: string | null | undefined;
    brandName?: string | null | undefined;
    color?: string | null | undefined;
    colorEn?: string | null | undefined;
    colorCode?: string | null | undefined;
    oldPrice?: number | null | undefined;
    kermanStock?: number | null | undefined;
    tehranStock?: number | null | undefined;
    warranty?: string | null | undefined;
    sellType?: string | null | undefined;
    seller?: string | null | undefined;
    imageUrl?: string | null | undefined;
}, {
    productId: string;
    title: string;
    status?: "active" | "inactive" | undefined;
    parentProductId?: string | null | undefined;
    sku?: string | null | undefined;
    model?: string | null | undefined;
    categoryName?: string | null | undefined;
    brandName?: string | null | undefined;
    color?: string | null | undefined;
    colorEn?: string | null | undefined;
    colorCode?: string | null | undefined;
    price?: number | undefined;
    oldPrice?: number | null | undefined;
    discount?: number | undefined;
    stock?: number | undefined;
    kermanStock?: number | null | undefined;
    tehranStock?: number | null | undefined;
    otherStocks?: Record<string, number> | undefined;
    warranty?: string | null | undefined;
    sellType?: string | null | undefined;
    seller?: string | null | undefined;
    promotion?: string | number | boolean | null | undefined;
    imageUrl?: string | null | undefined;
    gallery?: string[] | undefined;
    attributes?: {
        value: string;
        key: string;
    }[] | undefined;
    sortOrder?: number | undefined;
}>;
export type ProductWrite = z.infer<typeof productWriteSchema>;
export declare const productPatchSchema: z.ZodObject<{
    productId: z.ZodOptional<z.ZodString>;
    parentProductId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    sku: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    title: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    categoryName: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    brandName: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    color: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    colorEn: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    colorCode: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    price: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    oldPrice: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    discount: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    stock: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    kermanStock: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    tehranStock: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
    otherStocks: z.ZodOptional<z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    warranty: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    sellType: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    seller: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    promotion: z.ZodOptional<z.ZodDefault<z.ZodEffects<z.ZodUnion<[z.ZodBoolean, z.ZodString, z.ZodNumber, z.ZodNull, z.ZodUndefined]>, boolean, string | number | boolean | null | undefined>>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<["active", "inactive"]>>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    gallery: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    attributes: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        key: string;
    }, {
        value: string;
        key: string;
    }>, "many">>>;
    sortOrder: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "inactive" | undefined;
    productId?: string | undefined;
    parentProductId?: string | null | undefined;
    sku?: string | null | undefined;
    title?: string | undefined;
    model?: string | null | undefined;
    categoryName?: string | null | undefined;
    brandName?: string | null | undefined;
    color?: string | null | undefined;
    colorEn?: string | null | undefined;
    colorCode?: string | null | undefined;
    price?: number | undefined;
    oldPrice?: number | null | undefined;
    discount?: number | undefined;
    stock?: number | undefined;
    kermanStock?: number | null | undefined;
    tehranStock?: number | null | undefined;
    otherStocks?: Record<string, number> | undefined;
    warranty?: string | null | undefined;
    sellType?: string | null | undefined;
    seller?: string | null | undefined;
    promotion?: boolean | undefined;
    imageUrl?: string | null | undefined;
    gallery?: string[] | undefined;
    attributes?: {
        value: string;
        key: string;
    }[] | undefined;
    sortOrder?: number | undefined;
}, {
    status?: "active" | "inactive" | undefined;
    productId?: string | undefined;
    parentProductId?: string | null | undefined;
    sku?: string | null | undefined;
    title?: string | undefined;
    model?: string | null | undefined;
    categoryName?: string | null | undefined;
    brandName?: string | null | undefined;
    color?: string | null | undefined;
    colorEn?: string | null | undefined;
    colorCode?: string | null | undefined;
    price?: number | undefined;
    oldPrice?: number | null | undefined;
    discount?: number | undefined;
    stock?: number | undefined;
    kermanStock?: number | null | undefined;
    tehranStock?: number | null | undefined;
    otherStocks?: Record<string, number> | undefined;
    warranty?: string | null | undefined;
    sellType?: string | null | undefined;
    seller?: string | null | undefined;
    promotion?: string | number | boolean | null | undefined;
    imageUrl?: string | null | undefined;
    gallery?: string[] | undefined;
    attributes?: {
        value: string;
        key: string;
    }[] | undefined;
    sortOrder?: number | undefined;
}>;
export declare const categoryWriteSchema: z.ZodObject<{
    name: z.ZodString;
    faName: z.ZodString;
    iconUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    brandNames: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sortOrder: number;
    name: string;
    faName: string;
    brandNames: string[];
    iconUrl?: string | null | undefined;
}, {
    name: string;
    faName: string;
    sortOrder?: number | undefined;
    iconUrl?: string | null | undefined;
    brandNames?: string[] | undefined;
}>;
export type CategoryWrite = z.infer<typeof categoryWriteSchema>;
export declare const brandWriteSchema: z.ZodObject<{
    name: z.ZodString;
    faName: z.ZodString;
    iconUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sortOrder: number;
    name: string;
    faName: string;
    iconUrl?: string | null | undefined;
}, {
    name: string;
    faName: string;
    sortOrder?: number | undefined;
    iconUrl?: string | null | undefined;
}>;
export type BrandWrite = z.infer<typeof brandWriteSchema>;
export declare const colorWriteSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    faName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    name?: string | null | undefined;
    faName?: string | null | undefined;
}, {
    code: string;
    name?: string | null | undefined;
    faName?: string | null | undefined;
}>;
export type ColorWrite = z.infer<typeof colorWriteSchema>;
export declare const catalogQuerySchema: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    brands: z.ZodPipeline<z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>, string[], string | string[] | undefined>, z.ZodArray<z.ZodString, "many">>;
    promotion: z.ZodOptional<z.ZodBoolean>;
    inStock: z.ZodDefault<z.ZodBoolean>;
    sort: z.ZodDefault<z.ZodEnum<["price_asc", "price_desc", "newest", "title"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    perPage: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sort: "title" | "price_asc" | "price_desc" | "newest";
    page: number;
    perPage: number;
    brands: string[];
    inStock: boolean;
    promotion?: boolean | undefined;
    q?: string | undefined;
    category?: string | undefined;
}, {
    sort?: "title" | "price_asc" | "price_desc" | "newest" | undefined;
    page?: number | undefined;
    perPage?: number | undefined;
    promotion?: boolean | undefined;
    q?: string | undefined;
    category?: string | undefined;
    brands?: string | string[] | undefined;
    inStock?: boolean | undefined;
}>;
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
export declare const otpRequestSchema: z.ZodObject<{
    phone: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
}, "strip", z.ZodTypeAny, {
    phone: string;
}, {
    phone: string;
}>;
export declare const otpVerifySchema: z.ZodObject<{
    phone: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    code: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    phone: string;
}, {
    code: string;
    phone: string;
}>;
export declare const PROFILE_FIELDS: readonly ["name", "lastName", "storeName", "landline", "address", "postalCode", "certificateFileUrl", "activity", "pageWebsite"];
export declare const REQUIRED_PROFILE_FIELDS: readonly ["name", "lastName", "storeName", "address"];
export declare const PROFILE_FIELD_LABELS: Record<string, string>;
export declare const profileWriteSchema: z.ZodObject<{
    name: z.ZodDefault<z.ZodString>;
    lastName: z.ZodDefault<z.ZodString>;
    storeName: z.ZodDefault<z.ZodString>;
    landline: z.ZodDefault<z.ZodString>;
    address: z.ZodDefault<z.ZodString>;
    postalCode: z.ZodDefault<z.ZodString>;
    certificateFileUrl: z.ZodDefault<z.ZodString>;
    activity: z.ZodDefault<z.ZodString>;
    pageWebsite: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    lastName: string;
    storeName: string;
    landline: string;
    address: string;
    postalCode: string;
    certificateFileUrl: string;
    activity: string;
    pageWebsite: string;
}, {
    name?: string | undefined;
    lastName?: string | undefined;
    storeName?: string | undefined;
    landline?: string | undefined;
    address?: string | undefined;
    postalCode?: string | undefined;
    certificateFileUrl?: string | undefined;
    activity?: string | undefined;
    pageWebsite?: string | undefined;
}>;
export type ProfileWrite = z.infer<typeof profileWriteSchema>;
export declare const ORDER_STATUSES: readonly ["new", "confirmed", "preparing", "shipped", "delivered", "cancelled"];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export declare const ORDER_STATUS_LABELS: Record<OrderStatus, string>;
export declare const WAREHOUSES: readonly ["kerman", "tehran", "site"];
export type Warehouse = (typeof WAREHOUSES)[number];
export declare const WAREHOUSE_LABELS: Record<Warehouse, string>;
export declare const orderItemInputSchema: z.ZodObject<{
    productId: z.ZodString;
    warehouse: z.ZodDefault<z.ZodEnum<["kerman", "tehran", "site"]>>;
    qty: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    productId: string;
    warehouse: "kerman" | "tehran" | "site";
    qty: number;
}, {
    productId: string;
    qty: number;
    warehouse?: "kerman" | "tehran" | "site" | undefined;
}>;
export declare const orderCreateSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        warehouse: z.ZodDefault<z.ZodEnum<["kerman", "tehran", "site"]>>;
        qty: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        warehouse: "kerman" | "tehran" | "site";
        qty: number;
    }, {
        productId: string;
        qty: number;
        warehouse?: "kerman" | "tehran" | "site" | undefined;
    }>, "many">;
    address: z.ZodOptional<z.ZodString>;
    paymentMethod: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        productId: string;
        warehouse: "kerman" | "tehran" | "site";
        qty: number;
    }[];
    address?: string | undefined;
    paymentMethod?: string | undefined;
    note?: string | undefined;
}, {
    items: {
        productId: string;
        qty: number;
        warehouse?: "kerman" | "tehran" | "site" | undefined;
    }[];
    address?: string | undefined;
    paymentMethod?: string | undefined;
    note?: string | undefined;
}>;
export type OrderCreate = z.infer<typeof orderCreateSchema>;
export declare const orderPatchSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["new", "confirmed", "preparing", "shipped", "delivered", "cancelled"]>>;
    paymentMethod: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: "new" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled" | undefined;
    paymentMethod?: string | undefined;
    note?: string | undefined;
}, {
    status?: "new" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled" | undefined;
    paymentMethod?: string | undefined;
    note?: string | undefined;
}>;
export declare const userPatchSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    storeName: z.ZodOptional<z.ZodString>;
    landline: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    certificateFileUrl: z.ZodOptional<z.ZodString>;
    activity: z.ZodOptional<z.ZodString>;
    pageWebsite: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    role: z.ZodOptional<z.ZodEnum<["customer", "admin"]>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    lastName?: string | undefined;
    storeName?: string | undefined;
    landline?: string | undefined;
    address?: string | undefined;
    postalCode?: string | undefined;
    certificateFileUrl?: string | undefined;
    activity?: string | undefined;
    pageWebsite?: string | undefined;
    isActive?: boolean | undefined;
    role?: "customer" | "admin" | undefined;
}, {
    name?: string | undefined;
    lastName?: string | undefined;
    storeName?: string | undefined;
    landline?: string | undefined;
    address?: string | undefined;
    postalCode?: string | undefined;
    certificateFileUrl?: string | undefined;
    activity?: string | undefined;
    pageWebsite?: string | undefined;
    isActive?: boolean | undefined;
    role?: "customer" | "admin" | undefined;
}>;
export declare const settingWriteSchema: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value: string;
    key: string;
}, {
    key: string;
    value?: string | undefined;
}>;
export declare const SYNC_ENTITIES: readonly ["products", "categories", "brands", "colors", "users", "orders", "settings"];
export type SyncEntity = (typeof SYNC_ENTITIES)[number];
export declare const SYNC_ENTITY_LABELS: Record<SyncEntity, string>;
export declare const syncRunSchema: z.ZodObject<{
    direction: z.ZodDefault<z.ZodEnum<["pull", "push", "both"]>>;
    entities: z.ZodDefault<z.ZodArray<z.ZodEnum<["products", "categories", "brands", "colors", "users", "orders", "settings"]>, "many">>;
    dryRun: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    direction: "push" | "pull" | "both";
    entities: ("brands" | "products" | "categories" | "colors" | "users" | "orders" | "settings")[];
    dryRun: boolean;
}, {
    direction?: "push" | "pull" | "both" | undefined;
    entities?: ("brands" | "products" | "categories" | "colors" | "users" | "orders" | "settings")[] | undefined;
    dryRun?: boolean | undefined;
}>;
export type SyncRun = z.infer<typeof syncRunSchema>;
export declare const UPLOAD_KINDS: readonly ["product", "brand", "category", "slide", "certificate", "other"];
export type UploadKind = (typeof UPLOAD_KINDS)[number];
export declare const uploadQuerySchema: z.ZodObject<{
    kind: z.ZodOptional<z.ZodEnum<["product", "brand", "category", "slide", "certificate", "other"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    perPage: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    perPage: number;
    kind?: "category" | "product" | "brand" | "slide" | "certificate" | "other" | undefined;
}, {
    page?: number | undefined;
    perPage?: number | undefined;
    kind?: "category" | "product" | "brand" | "slide" | "certificate" | "other" | undefined;
}>;
