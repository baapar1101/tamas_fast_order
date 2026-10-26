import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  isPhoneProduct,
  phoneDefaultVariantIndex,
  phoneDisplayVariants,
  type CategoryDTO,
  type ProductDTO,
  type ProductGroupDTO,
  type Warehouse,
} from "@tamas/shared";
import { api } from "../api";
import { useStore } from "../state";
import { useBootstrap, type Bootstrap } from "../hooks";
import { useBrowse } from "../browse";
import { ORIGIN, productImages, publicUrl, stockFor } from "../domain";
import {
  Button,
  Card,
  Empty,
  Loading,
  Money,
  Notice,
  Page,
  Photo,
  Row,
  RtlRail,
  Select,
  Txt,
  useColors,
} from "../ui";
import { IconButton } from "../chrome";
import type { RootRoutes } from "../navigation";
import { QA_BUILD } from "../environment";

type Nav = NativeStackNavigationProp<RootRoutes>;
function categoryIcon(category: CategoryDTO) {
  const value = category.iconUrl;
  return value
    ? publicUrl(
        /^(https?:|\/)/.test(value)
          ? value
          : value.startsWith("img_")
            ? `/uploads/${value}`
            : `/assets/category/${value}`,
      )
    : undefined;
}
export function ProductGallery({
  products,
  compact = false,
  height,
}: {
  products: ProductDTO[];
  compact?: boolean;
  height?: number;
}) {
  const images = productImages(products);
  const [active, setActive] = useState(0);
  const [preview, setPreview] = useState(false);
  const c = useColors();
  const { width, height: screenHeight } = useWindowDimensions();
  const uri = images[active] || images[0] || `${ORIGIN}/logo.png`;
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="بزرگ‌نمایی تصویر محصول"
        onPress={() => setPreview(true)}
        style={{
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <Photo url={uri} height={height || (compact ? 96 : 280)} />
      </Pressable>
      {images.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 4 }}
        >
          {images.map((url, index) => (
            <Pressable
              key={url}
              accessibilityRole="button"
              accessibilityLabel={`تصویر ${index + 1} محصول`}
              accessibilityState={{ selected: index === active }}
              onPress={() => setActive(index)}
              style={{
                width: compact ? 36 : 52,
                borderRadius: 8,
                padding: 2,
                borderWidth: 1,
                borderColor: index === active ? c.primary : c.border,
              }}
            >
              <Photo url={url} height={compact ? 32 : 48} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <Modal
        visible={preview}
        transparent
        animationType="fade"
        onRequestClose={() => setPreview(false)}
      >
        <View
          style={{
            flex: 1,
            padding: 20,
            paddingTop: 48,
            backgroundColor: c.overlay,
            justifyContent: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              alignSelf: "flex-end",
              backgroundColor: c.surface,
              borderRadius: 22,
            }}
          >
            <IconButton
              icon="close"
              label="بستن تصویر"
              onPress={() => setPreview(false)}
            />
          </View>
          <Photo
            url={uri}
            height={Math.min(screenHeight * 0.65, width * 1.2)}
          />
          <Row style={{ justifyContent: "center" }}>
            <Button
              secondary
              label="قبلی"
              disabled={active === 0}
              onPress={() => setActive((v) => v - 1)}
            />
            <Txt color="#ffffff">
              {(active + 1).toLocaleString("fa-IR")} /{" "}
              {Math.max(images.length, 1).toLocaleString("fa-IR")}
            </Txt>
            <Button
              secondary
              label="بعدی"
              disabled={active >= images.length - 1}
              onPress={() => setActive((v) => v + 1)}
            />
          </Row>
        </View>
      </Modal>
    </View>
  );
}
export function PurchaseQuantity({
  product,
  warehouse,
}: {
  product: ProductDTO;
  warehouse: Warehouse;
}) {
  const store = useStore();
  const c = useColors();
  const quantity =
    store.lines.find(
      (l) =>
        l.product.productId === product.productId && l.warehouse === warehouse,
    )?.qty || 0;
  const stock = stockFor(product, warehouse);
  return (
    <Row style={{ gap: 6, flexWrap: "wrap" }}>
      <Txt muted size={12}>
        {warehouse === "kerman"
          ? "انبار کرمان"
          : warehouse === "tehran"
            ? "انبار تهران"
            : "موجودی فروشگاه"}
      </Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`افزایش تعداد از ${warehouse === "kerman" ? "کرمان" : warehouse === "tehran" ? "تهران" : "فروشگاه"}`}
        accessibilityState={{ disabled: quantity >= stock }}
        disabled={quantity >= stock}
        onPress={() => store.setQty(product, warehouse, quantity + 1)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: c.campaign,
          alignItems: "center",
          justifyContent: "center",
          opacity: quantity >= stock ? 0.4 : 1,
        }}
      >
        <Ionicons name="add" size={22} color={c.onPrimary} />
      </Pressable>
      {quantity > 0 ? (
        <>
          <Txt bold size={13}>
            {quantity.toLocaleString("fa-IR")}
          </Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="کاهش تعداد"
            onPress={() => store.setQty(product, warehouse, quantity - 1)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: c.subtle,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={quantity === 1 ? "trash-outline" : "remove"}
              size={17}
              color={c.muted}
            />
          </Pressable>
        </>
      ) : null}
    </Row>
  );
}
export function NativeProductTile({
  variants: allVariants,
  quick = false,
}: {
  variants: ProductDTO[];
  quick?: boolean;
}) {
  const variants = allVariants.some(isPhoneProduct)
    ? phoneDisplayVariants(allVariants)
    : allVariants;
  const [selected, setSelected] = useState("");
  const p =
    variants.find((v) => v.productId === selected) ||
    variants[phoneDefaultVariantIndex(variants)] ||
    variants[0];
  const nav = useNavigation<Nav>();
  const store = useStore();
  const c = useColors();
  const { width, fontScale } = useWindowDimensions();
  if (!p) return null;
  const canBuy = !!store.user?.isActive;
  const available =
    p.price > 0 && stockFor(p, "kerman") + stockFor(p, "tehran") > 0;
  const imageWidth = width < 360 || fontScale > 1.3 ? 84 : 96;
  const warehouses: Warehouse[] =
    p.kermanStock + p.tehranStock > 0 ? ["kerman", "tehran"] : ["site"];
  const details = () => nav.navigate("Product", { id: p.productId });
  return (
    <Card style={{ padding: 12, gap: 12, borderRadius: 14 }}>
      {p.promotion ? (
        <View
          style={{
            backgroundColor: c.campaignSoft,
            borderRadius: 8,
            padding: 6,
          }}
        >
          <Txt color={c.campaign} size={11} bold>
            کالای جشنواره
          </Txt>
        </View>
      ) : null}
      <Row style={{ alignItems: "flex-start", gap: 10 }}>
        <View style={{ width: imageWidth }}>
          <ProductGallery products={allVariants} compact />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={details}>
            <Txt bold size={12}>
              {p.title}
            </Txt>
          </Pressable>
          <Txt muted size={11}>
            برند: {p.brandFaName || p.brandName || "متفرقه"}
          </Txt>
          <Txt muted size={11}>
            رنگ: {p.color || "—"}
          </Txt>
          {p.warranty ? (
            <Txt muted size={10}>
              {p.warranty}
            </Txt>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            store.favorites.includes(p.productId)
              ? "حذف از علاقه‌مندی"
              : "افزودن به علاقه‌مندی"
          }
          hitSlop={8}
          onPress={() => store.toggleFavorite(p.productId)}
          style={{ paddingVertical: 4 }}
        >
          <Ionicons
            name={
              store.favorites.includes(p.productId) ? "heart" : "heart-outline"
            }
            size={21}
            color={c.muted}
          />
        </Pressable>
      </Row>
      {variants.length > 1 && !quick ? (
        <Select
          label="مدل / رنگ"
          value={p.productId}
          options={variants.map((v) => ({
            value: v.productId,
            label: v.subTitle || v.color || v.title,
          }))}
          onChange={setSelected}
        />
      ) : null}
      <View
        style={{
          borderTopWidth: 1,
          borderStyle: "dashed",
          borderColor: c.border,
          paddingTop: 12,
          gap: 12,
        }}
      >
        <Row
          style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}
        >
          {canBuy ? (
            available ? (
              <Money amount={p.price} size={16} />
            ) : (
              <Txt muted>ناموجود</Txt>
            )
          ) : (
            <Txt muted size={12}>
              قیمت ویژه همکاران پس از ورود
            </Txt>
          )}
          <Button
            secondary
            label="مشاهده جزئیات"
            icon="eye-outline"
            onPress={details}
          />
        </Row>
        {canBuy ? (
          quick ? (
            variants.map((v) => (
              <View
                key={v.productId}
                style={{
                  borderTopWidth: 1,
                  borderColor: c.border,
                  paddingTop: 8,
                  gap: 8,
                }}
              >
                <Row
                  style={{ justifyContent: "space-between", flexWrap: "wrap" }}
                >
                  <Txt size={12}>{v.subTitle || v.color || v.title}</Txt>
                  <Money amount={v.price} size={14} />
                </Row>
                {(v.kermanStock + v.tehranStock > 0
                  ? (["kerman", "tehran"] as Warehouse[])
                  : (["site"] as Warehouse[])
                )
                  .filter((w) => stockFor(v, w) > 0 && v.price > 0)
                  .map((w) => (
                    <PurchaseQuantity key={w} product={v} warehouse={w} />
                  ))}
              </View>
            ))
          ) : available ? (
            warehouses
              .filter((w) => stockFor(p, w) > 0)
              .map((w) => (
                <PurchaseQuantity key={w} product={p} warehouse={w} />
              ))
          ) : null
        ) : (
          <Button
            label={store.user ? "مشاهده وضعیت حساب" : "ورود / ثبت‌نام همکار"}
            secondary
            onPress={() =>
              store.user
                ? nav.navigate("Main", { screen: "Account" })
                : nav.navigate("Login")
            }
          />
        )}
      </View>
    </Card>
  );
}
function CategoryChip({
  category,
  active,
  onPress,
  large = false,
}: {
  category?: CategoryDTO;
  active?: boolean;
  onPress: () => void;
  large?: boolean;
}) {
  const c = useColors();
  const uri = category && categoryIcon(category);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={{
        width: large ? "100%" : 88,
        flex: large ? 1 : undefined,
        minHeight: large ? 128 : 80,
        padding: 12,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        borderRadius: 14,
        backgroundColor: active ? c.soft : c.subtle,
        borderWidth: 1,
        borderColor: active ? c.primary : c.border,
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="contain"
          style={{ width: large ? 48 : 28, height: large ? 48 : 28 }}
        />
      ) : (
        <Ionicons
          name="grid-outline"
          size={large ? 36 : 22}
          color={active ? c.primary : c.muted}
        />
      )}
      <Txt size={large ? 13 : 10} bold style={{ textAlign: "center" }}>
        {category ? category.faName || category.name : "همه کالاها"}
      </Txt>
    </Pressable>
  );
}
export function CategoriesScreen() {
  const q = useBootstrap();
  const browse = useBrowse();
  const nav = useNavigation<Nav>();
  const { fontScale, width } = useWindowDimensions();
  const columns = fontScale > 1.4 || width < 340 ? 1 : 2;
  return (
    <Page refresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Txt bold size={18}>
        دسته‌بندی محصولات
      </Txt>
      {q.error ? <Notice error text={q.error.message} /> : null}
      {q.isPending ? (
        <Loading />
      ) : (
        <View style={{ gap: 12 }}>
          {(q.data?.categories || [])
            .filter((_, i) => i % columns === 0)
            .map((_, row) => (
              <Row key={row} style={{ alignItems: "stretch" }}>
                {q
                  .data!.categories.slice(row * columns, (row + 1) * columns)
                  .map((category) => (
                    <View key={category.id} style={{ flex: 1 }}>
                      <CategoryChip
                        category={category}
                        large
                        active={browse.category === category.name}
                        onPress={() => {
                          browse.setCategory(category.name);
                          browse.setBrands([]);
                          nav.navigate("Main", { screen: "Store" });
                        }}
                      />
                    </View>
                  ))}
                {columns === 2 &&
                row * columns + 1 >= q.data!.categories.length ? (
                  <View style={{ flex: 1 }} />
                ) : null}
              </Row>
            ))}
        </View>
      )}
    </Page>
  );
}
function Hero({ slides }: { slides: Bootstrap["slides"] }) {
  const [active, setActive] = useState(0);
  const nav = useNavigation<Nav>();
  const c = useColors();
  const browse = useBrowse();
  const { user } = useStore();
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(
      () => setActive((v) => (v + 1) % slides.length),
      6500,
    );
    return () => clearInterval(timer);
  }, [slides.length]);
  const slide = slides[active] || slides[0];
  if (!slide) return null;
  const open = () => {
    if (!slide.linkUrl) return;
    let url: URL;
    try {
      url = new URL(slide.linkUrl, ORIGIN);
    } catch {
      return;
    }
    if (url.username || url.password) return;
    if (url.origin !== ORIGIN) {
      if (url.protocol === "https:")
        void Linking.openURL(url.href).catch(() => {});
      return;
    }
    if (/^\/p\//.test(url.pathname))
      nav.navigate("Product", {
        id: decodeURIComponent(url.pathname.slice(3)),
      });
    else if (url.pathname === "/terms") nav.navigate("Terms");
    else if (url.pathname === "/checkout")
      nav.navigate(user ? "Checkout" : "Login");
    else if (url.pathname.startsWith("/admin")) nav.navigate("Management");
    else if (
      url.pathname.startsWith("/account") ||
      ["/credit", "/wallet", "/orders"].includes(url.pathname)
    ) {
      if (!user) {
        nav.navigate("Login");
        return;
      }
      const route = url.pathname.includes("credit")
        ? "Credit"
        : url.pathname.includes("wallet")
          ? "Wallet"
          : url.pathname.includes("documents")
            ? "Documents"
            : url.pathname.includes("telegram")
              ? "Connections"
              : "Orders";
      nav.navigate(route);
    } else {
      if (url.searchParams.has("category"))
        browse.setCategory(url.searchParams.get("category") || "");
      if (url.searchParams.has("q"))
        browse.setSearch(url.searchParams.get("q") || "");
      const tab = url.searchParams.get("tab");
      nav.navigate("Main", {
        screen:
          tab === "categories"
            ? "Categories"
            : tab === "cart"
              ? "Cart"
              : tab === "search"
                ? "Search"
                : tab === "profile"
                  ? "Account"
                  : "Store",
      });
    }
  };
  return (
    <View
      style={{
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: c.surface,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={slide.title || "بنر فروشگاه"}
        onPress={open}
      >
        <Image
          source={{ uri: publicUrl(slide.mobileImageUrl || slide.imageUrl) }}
          contentFit={slide.mobileImageUrl ? 'cover' : 'contain'}
          style={{ width: "100%", aspectRatio: 16 / 7, backgroundColor: '#ffffff' }}
        />
      </Pressable>
      {slides.length > 1 ? (
        <Row style={{ position: 'absolute', left: 0, right: 0, bottom: 8, justifyContent: "center", gap: 4 }}>
          {slides.map((s, i) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`نمایش بنر ${i + 1}`}
              accessibilityState={{ selected: active === i }}
              onPress={() => setActive(i)}
              style={{ padding: 6 }}
            >
              <View
                style={{
                  width: active === i ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: active === i ? c.primary : c.border,
                }}
              />
            </Pressable>
          ))}
        </Row>
      ) : null}
    </View>
  );
}
export function StoreScreen({ searchOnly = false }: { searchOnly?: boolean }) {
  const c = useColors();
  const browse = useBrowse();
  const nav = useNavigation<Nav>();
  const boot = useBootstrap();
  const [q, setQ] = useState(browse.search);
  const [pagination, setPagination] = useState({ signature: "", page: 1 });
  const [brandsOpen, setBrandsOpen] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const list = useRef<FlatList<ProductGroupDTO>>(null);
  useEffect(() => {
    const t = setTimeout(() => setQ(browse.search), 350);
    return () => clearTimeout(t);
  }, [browse.search]);
  const signature = JSON.stringify([
    q,
    browse.category,
    browse.brands,
    browse.sort,
    browse.inStock,
    browse.flag,
  ]);
  const page = pagination.signature === signature ? pagination.page : 1;
  const products = useQuery({
    queryKey: ["products", signature, page],
    queryFn: ({ signal }) =>
      api.get<{
        groups: ProductGroupDTO[];
        total: number;
        page: number;
        perPage: number;
      }>(
        "/catalog/products",
        {
          q,
          category: browse.category,
          brands: browse.brands.join(","),
          sort: browse.sort,
          inStock: browse.inStock,
          promotion: browse.flag === "promotion" ? true : undefined,
          basketOnly: browse.flag === "basket" ? true : undefined,
          creditOnly: browse.flag === "credit" ? true : undefined,
          page,
          perPage: 24,
        },
        signal,
      ),
  });
  let filters: { id?: string; label: string; type: string }[] = [];
  try {
    const raw = JSON.parse(boot.data?.settings.storefront_filters || "[]");
    if (Array.isArray(raw))
      filters = raw.filter(
        (f) => f.enabled && ["promotion", "basket", "credit"].includes(f.type),
      );
  } catch {
    /* Invalid optional settings leave the default filters usable. */
  }
  const columns =
    browse.quick || width < 700 || fontScale > 1.4 ? 1 : width >= 1000 ? 3 : 2;
  const resultCount = products.data?.total || 0;
  const pages = Math.max(1, Math.ceil(resultCount / 24));
  const changePage = (next: number) => {
    setPagination({ signature, page: next });
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        ref={list}
        key={columns}
        data={products.data?.groups || []}
        numColumns={columns}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{
          padding: 12,
          gap: 12,
          paddingBottom: 28,
          maxWidth: 1100,
          alignSelf: "center",
          width: "100%",
        }}
        columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
        keyboardShouldPersistTaps="handled"
        refreshing={products.isRefetching}
        onRefresh={() => {
          void products.refetch();
          void boot.refetch();
        }}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 4 }}>
            {QA_BUILD ? (
              <Notice text="محیط آزمایشی — داده و پرداخت ساختگی" />
            ) : null}
            {!searchOnly ? (
              <>
                <Hero slides={boot.data?.slides || []} />
                <Card style={{ padding: 10 }}>
                  <RtlRail>
                    <CategoryChip
                      active={!browse.category}
                      onPress={() => {
                        browse.setCategory("");
                        browse.setBrands([]);
                      }}
                    />
                    {(boot.data?.categories || []).map((category) => (
                      <CategoryChip
                        key={category.id}
                        category={category}
                        active={browse.category === category.name}
                        onPress={() => {
                          browse.setCategory(
                            browse.category === category.name
                              ? ""
                              : category.name,
                          );
                          browse.setBrands([]);
                        }}
                      />
                    ))}
                  </RtlRail>
                </Card>
              </>
            ) : (
              <Txt bold size={18}>
                جستجوی محصولات
              </Txt>
            )}
            <Card>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="برندها"
                accessibilityState={{ expanded: brandsOpen }}
                onPress={() => setBrandsOpen((v) => !v)}
              >
                <Row style={{ justifyContent: "space-between", minHeight: 32 }}>
                  <Txt bold size={13}>
                    برندها
                    {browse.brands.length
                      ? ` (${browse.brands.length.toLocaleString("fa-IR")})`
                      : ""}
                  </Txt>
                  <Ionicons
                    name={brandsOpen ? "chevron-down" : "chevron-back"}
                    color={c.muted}
                    size={17}
                  />
                </Row>
              </Pressable>
              {brandsOpen ? (
                <View
                  style={{
                    flexDirection: "row-reverse",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {(boot.data?.brands || []).map((brand) => (
                    <Pressable
                      key={brand.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{
                        checked: browse.brands.includes(brand.name),
                      }}
                      onPress={() =>
                        browse.setBrands(
                          browse.brands.includes(brand.name)
                            ? browse.brands.filter((v) => v !== brand.name)
                            : [...browse.brands, brand.name],
                        )
                      }
                      style={{
                        padding: 10,
                        borderWidth: 1,
                        borderColor: browse.brands.includes(brand.name)
                          ? c.primary
                          : c.border,
                        borderRadius: 10,
                        backgroundColor: browse.brands.includes(brand.name)
                          ? c.soft
                          : c.subtle,
                      }}
                    >
                      <Txt size={12}>{brand.faName || brand.name}</Txt>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Txt bold size={13}>
                فیلترهای سریع
              </Txt>
              <Row
                style={{
                  justifyContent: "space-between",
                  backgroundColor: c.soft,
                  borderWidth: 1,
                  borderColor: c.border,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                }}
              >
                <Txt size={13}>موجودها</Txt>
                <Switch
                  accessibilityLabel="موجودها"
                  value={browse.inStock}
                  onValueChange={browse.setInStock}
                  trackColor={{ true: c.primary }}
                />
              </Row>
              {filters.length ? (
                <Select
                  label="فیلتر فروشگاه"
                  value={browse.flag}
                  options={[
                    { label: "همه کالاها", value: "all" },
                    ...filters.map((f) => ({ label: f.label, value: f.type })),
                  ]}
                  onChange={browse.setFlag}
                />
              ) : null}
              {browse.category || browse.brands.length || q ? (
                <Button
                  secondary
                  label="پاک‌سازی فیلترها"
                  onPress={() => {
                    browse.setCategory("");
                    browse.setBrands([]);
                    browse.setSearch("");
                    browse.setFlag("all");
                  }}
                />
              ) : null}
            </Card>
            <Card style={{ gap: 12 }}>
              <Row
                style={{
                  gap: 5,
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderColor: c.border,
                }}
              >
                <Txt bold size={17}>
                  {products.isPending
                    ? "…"
                    : resultCount.toLocaleString("fa-IR")}
                </Txt>
                <Txt muted size={12}>
                  کالا پیدا شد
                </Txt>
              </Row>
              <Txt muted bold size={12}>
                نحوه نمایش
              </Txt>
              <Row
                style={{
                  gap: 0,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 12,
                  padding: 3,
                  backgroundColor: c.subtle,
                }}
              >
                {[
                  { quick: true, label: "خرید سریع", icon: "filter-outline" },
                  { quick: false, label: "شبکه‌ای", icon: "grid-outline" },
                ].map((item) => (
                  <Pressable
                    key={item.label}
                    accessibilityRole="radio"
                    accessibilityLabel={item.label}
                    accessibilityState={{
                      checked: browse.quick === item.quick,
                    }}
                    onPress={() => browse.setQuick(item.quick)}
                    style={{
                      flex: 1,
                      padding: 10,
                      minHeight: 44,
                      borderWidth: 1,
                      borderColor:
                        browse.quick === item.quick ? c.primary : "transparent",
                      borderRadius: 9,
                      backgroundColor:
                        browse.quick === item.quick ? c.surface : "transparent",
                    }}
                  >
                    <Row style={{ justifyContent: "center", gap: 7 }}>
                      <Ionicons
                        name={item.icon as "grid-outline"}
                        size={16}
                        color={
                          browse.quick === item.quick ? c.primary : c.muted
                        }
                      />
                      <Txt
                        size={12}
                        bold
                        color={
                          browse.quick === item.quick ? c.primary : c.muted
                        }
                      >
                        {item.label}
                      </Txt>
                    </Row>
                  </Pressable>
                ))}
              </Row>
              <Select
                label="مرتب‌سازی"
                value={browse.sort}
                onChange={browse.setSort}
                options={[
                  { label: "ارزان‌ترین", value: "price_asc" },
                  { label: "گران‌ترین", value: "price_desc" },
                  { label: "جدیدترین", value: "newest" },
                  { label: "حروف الفبا", value: "title" },
                ]}
              />
            </Card>
            {products.error || boot.error ? (
              <Notice error text={(products.error || boot.error)?.message} />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: `${100 / columns}%` }}>
            <NativeProductTile variants={item.variants} quick={browse.quick} />
          </View>
        )}
        ListEmptyComponent={
          products.isPending ? (
            <Loading />
          ) : (
            <Empty
              title="کالایی پیدا نشد"
              description="فیلترها یا عبارت جستجو را تغییر دهید."
            />
          )
        }
        ListFooterComponent={
          <View style={{ gap: 16, marginTop: 8 }}>
            {products.error ? (
              <Button
                label="تلاش مجدد"
                onPress={() => void products.refetch()}
              />
            ) : (
              <Row
                style={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <Button
                  secondary
                  label="قبلی"
                  disabled={page <= 1 || products.isFetching}
                  onPress={() => changePage(page - 1)}
                />
                <Txt muted size={12}>
                  صفحه {page.toLocaleString("fa-IR")} از{" "}
                  {pages.toLocaleString("fa-IR")}
                </Txt>
                <Button
                  secondary
                  label="بعدی"
                  disabled={page >= pages || products.isFetching}
                  onPress={() => changePage(page + 1)}
                />
              </Row>
            )}
            <Button
              secondary
              icon="document-outline"
              label="کاتالوگ کالاها"
              onPress={() => nav.navigate("CatalogExport")}
            />
          </View>
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="چت با پشتیبانی"
        onPress={() => nav.navigate("Support")}
        style={{
          position: "absolute",
          bottom: 16,
          left: 12,
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.primary,
          elevation: 4,
        }}
      >
        <Ionicons name="chatbubbles-outline" color={c.onPrimary} size={25} />
      </Pressable>
    </View>
  );
}
export function SearchScreen() {
  return <StoreScreen searchOnly />;
}
