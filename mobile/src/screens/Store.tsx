import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Switch,
  useWindowDimensions,
  View,
  Share,
} from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ProductDTO, ProductGroupDTO, Warehouse } from "@tamas/shared";
import {
  isPhoneProduct,
  phoneDefaultVariantIndex,
  phoneDisplayVariants,
} from "@tamas/shared";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { api } from "../api";
import { useStore } from "../state";
import { useBootstrap } from "../hooks";
import {
  date,
  money,
  ORIGIN,
  plain,
  productImages,
  stockFor,
  total,
} from "../domain";
import {
  Button,
  Card,
  Empty,
  Field,
  Loading,
  Money,
  Notice,
  Page,
  Photo,
  Row,
  Select,
  Txt,
  useColors,
} from "../ui";
import type { RootRoutes, ScreenProps } from "../navigation";
type Nav = NativeStackNavigationProp<RootRoutes>;
export function ProductTile({
  variants: allVariants,
  quick = false,
}: {
  variants: ProductDTO[];
  quick?: boolean;
}) {
  const variants = allVariants.some(isPhoneProduct)
    ? phoneDisplayVariants(allVariants)
    : allVariants;
  const p = variants[0];
  const nav = useNavigation<Nav>();
  const store = useStore();
  const c = useColors();
  if (!p) return null;
  const images = productImages(allVariants);
  const available = variants.some(
    (v) => stockFor(v, "kerman") + stockFor(v, "tehran") > 0,
  );
  return (
    <Card style={{ flex: 1, padding: 12, gap: 10 }}>
      <Pressable
        onPress={() => nav.navigate("Product", { id: p.productId })}
        accessibilityRole="button"
        accessibilityLabel={`جزئیات ${p.title}`}
      >
        <Photo url={images[0]} height={quick ? 100 : 160} />
      </Pressable>
      {images.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {images.slice(1).map((img) => (
            <Pressable
              key={img}
              onPress={() => nav.navigate("Product", { id: p.productId })}
            >
              <View style={{ width: 48 }}>
                <Photo url={img} height={44} />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => nav.navigate("Product", { id: p.productId })}
      >
        <Txt bold size={13} numberOfLines={3}>
          {p.title}
        </Txt>
      </Pressable>
      <Row>
        <Txt muted size={12}>
          {p.brandFaName || p.brandName}{" "}
          {variants.length > 1
            ? ` • ${variants.length.toLocaleString("fa-IR")} مدل`
            : ""}
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            store.favorites.includes(p.productId)
              ? "حذف از علاقه‌مندی"
              : "افزودن به علاقه‌مندی"
          }
          onPress={() => store.toggleFavorite(p.productId)}
          hitSlop={10}
          style={{ marginRight: "auto", padding: 6 }}
        >
          <Ionicons
            name={
              store.favorites.includes(p.productId) ? "heart" : "heart-outline"
            }
            size={22}
            color={c.primary}
          />
        </Pressable>
      </Row>
      {available ? (
        <Money
          amount={Math.min(
            ...variants
              .filter((v) => stockFor(v, "kerman") + stockFor(v, "tehran") > 0)
              .map((v) => v.price),
          )}
          size={15}
        />
      ) : (
        <Txt muted>ناموجود</Txt>
      )}
      {quick ? (
        variants.map((v) => (
          <View
            key={v.productId}
            style={{
              gap: 7,
              borderTopWidth: 1,
              borderColor: c.border,
              paddingTop: 9,
            }}
          >
            <Txt size={12}>{v.color || v.subTitle || v.title}</Txt>
            {(["kerman", "tehran"] as Warehouse[])
              .filter((w) => stockFor(v, w) > 0)
              .map((w) => (
                <Quantity key={w} product={v} warehouse={w} />
              ))}
          </View>
        ))
      ) : (
        <Button
          label="مشاهده و خرید"
          secondary
          onPress={() => nav.navigate("Product", { id: p.productId })}
        />
      )}
    </Card>
  );
}
export function Quantity({
  product,
  warehouse,
}: {
  product: ProductDTO;
  warehouse: Warehouse;
}) {
  const store = useStore();
  const n =
    store.lines.find(
      (l) =>
        l.product.productId === product.productId && l.warehouse === warehouse,
    )?.qty || 0;
  const c = useColors();
  const stock = stockFor(product, warehouse);
  return (
    <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
      <Txt size={12}>
        {warehouse === "kerman" ? "انبار کرمان" : "انبار تهران"} •{" "}
        {stock.toLocaleString("fa-IR")} عدد
      </Txt>
      <Row>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="افزایش تعداد"
          disabled={n >= stock}
          onPress={() => store.setQty(product, warehouse, n + 1)}
          style={{
            padding: 10,
            backgroundColor: c.soft,
            borderRadius: 10,
            opacity: n >= stock ? 0.4 : 1,
          }}
        >
          <Ionicons name="add" size={20} color={c.primary} />
        </Pressable>
        <Txt bold>{n.toLocaleString("fa-IR")}</Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="کاهش تعداد"
          disabled={!n}
          onPress={() => store.setQty(product, warehouse, n - 1)}
          style={{
            padding: 10,
            backgroundColor: c.soft,
            borderRadius: 10,
            opacity: n ? 1 : 0.4,
          }}
        >
          <Ionicons
            name={n === 1 ? "trash-outline" : "remove"}
            size={20}
            color={c.primary}
          />
        </Pressable>
      </Row>
    </Row>
  );
}
export function StoreScreen() {
  const nav = useNavigation<Nav>();
  const c = useColors();
  const { width, fontScale } = useWindowDimensions();
  const boot = useBootstrap();
  const [input, setInput] = useState(""),
    [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [brand, setBrand] = useState(""),
    [sort, setSort] = useState("price_asc");
  const [inStock, setInStock] = useState(true),
    [quick, setQuick] = useState(false),
    [flag, setFlag] = useState("all");
  useEffect(() => {
    const t = setTimeout(() => setQ(input), 350);
    return () => clearTimeout(t);
  }, [input]);
  const filters = useMemo(() => {
    try {
      const v = JSON.parse(boot.data?.settings.storefront_filters || "[]");
      return Array.isArray(v)
        ? v.filter(
            (f: { enabled?: boolean; type?: string }) =>
              f.enabled && ["promotion", "basket"].includes(f.type || ""),
          )
        : [];
    } catch {
      return [];
    }
  }, [boot.data?.settings.storefront_filters]);
  const products = useInfiniteQuery({
    queryKey: ["products", { q, category, brand, sort, inStock, flag }],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api.get<{
        groups: ProductGroupDTO[];
        total: number;
        page: number;
        perPage: number;
      }>(
        "/catalog/products",
        {
          q,
          category,
          brands: brand,
          sort,
          inStock,
          promotion: flag === "promotion" ? true : undefined,
          basketOnly: flag === "basket" ? true : undefined,
          creditOnly: flag === "credit" ? true : undefined,
          page: pageParam,
          perPage: 24,
        },
        signal,
      ),
    getNextPageParam: (last) =>
      last.page * last.perPage < last.total ? last.page + 1 : undefined,
  });
  const columns =
    quick || width < 360 || fontScale > 1.4 ? 1 : width >= 850 ? 3 : 2;
  const groups = products.data?.pages.flatMap((p) => p.groups) || [];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        key={columns}
        data={groups}
        numColumns={columns}
        keyExtractor={(p) => p.key}
        contentContainerStyle={{
          padding: 12,
          gap: 12,
          maxWidth: 1100,
          width: "100%",
          alignSelf: "center",
        }}
        columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
        refreshing={products.isRefetching}
        onRefresh={() => void products.refetch()}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 4 }}>
            <Card>
              <Txt bold size={24}>
                تماس مارکت
              </Txt>
              <Txt muted>خرید عمدهٔ کالای دیجیتال، مستقیم و مطمئن</Txt>
              <Field
                label="جست‌وجوی کالا"
                placeholder="نام محصول، مدل یا کد کالا…"
                value={input}
                onChangeText={setInput}
                returnKeyType="search"
              />
              <Row style={{ flexWrap: "wrap" }}>
                <Select
                  label="دسته‌بندی"
                  value={category}
                  options={[
                    { label: "همه کالاها", value: "" },
                    ...(boot.data?.categories || []).map((x) => ({
                      label: x.faName || x.name,
                      value: x.name,
                    })),
                  ]}
                  onChange={setCategory}
                />
                <Select
                  label="برند"
                  value={brand}
                  options={[
                    { label: "همه برندها", value: "" },
                    ...(boot.data?.brands || []).map((x) => ({
                      label: x.faName || x.name,
                      value: x.name,
                    })),
                  ]}
                  onChange={setBrand}
                />
              </Row>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt>فقط کالاهای موجود</Txt>
                <Switch
                  accessibilityLabel="فقط موجودها"
                  value={inStock}
                  onValueChange={setInStock}
                  trackColor={{ true: c.primary }}
                />
              </Row>
              {filters.length > 0 && (
                <Select
                  label="فیلترهای فروشگاه"
                  value={flag}
                  onChange={setFlag}
                  options={[
                    { label: "همه کالاها", value: "all" },
                    ...filters.map((f: { label: string; type: string }) => ({
                      label: f.label,
                      value: f.type,
                    })),
                  ]}
                />
              )}
              <Row style={{ flexWrap: "wrap" }}>
                <Select
                  label="مرتب‌سازی"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { label: "ارزان‌ترین", value: "price_asc" },
                    { label: "گران‌ترین", value: "price_desc" },
                    { label: "جدیدترین", value: "newest" },
                    { label: "نام کالا", value: "title" },
                  ]}
                />
                <Select
                  label="نحوه نمایش"
                  value={quick ? "quick" : "grid"}
                  onChange={(v) => setQuick(v === "quick")}
                  options={[
                    { label: "شبکه‌ای", value: "grid" },
                    { label: "خرید سریع", value: "quick" },
                  ]}
                />
              </Row>
              <Button
                label="کاتالوگ کالاها"
                secondary
                icon="document-outline"
                onPress={() => nav.navigate("CatalogExport")}
              />
            </Card>
            {products.data && (
              <Txt muted>
                {products.data.pages[0]?.total.toLocaleString("fa-IR")} گروه
                کالا پیدا شد
              </Txt>
            )}
            {(products.error || boot.error) && (
              <Notice error text={(products.error || boot.error)?.message} />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: `${100 / columns}%` }}>
            <ProductTile variants={item.variants} quick={quick} />
          </View>
        )}
        ListEmptyComponent={
          products.isPending ? (
            <Loading />
          ) : (
            <Empty
              title="کالایی پیدا نشد"
              description="فیلترها یا عبارت جست‌وجو را تغییر دهید."
            />
          )
        }
        onEndReached={() => {
          if (products.hasNextPage && !products.isFetchingNextPage)
            void products.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          products.isFetchingNextPage ? (
            <Loading />
          ) : products.isError ? (
            <Button label="تلاش مجدد" onPress={() => void products.refetch()} />
          ) : undefined
        }
      />
    </View>
  );
}
export function ProductScreen({ route, navigation }: ScreenProps<"Product">) {
  const { id } = route.params;
  const [selected, setSelected] = useState(id);
  const c = useColors();
  const { width } = useWindowDimensions();
  useEffect(() => setSelected(id), [id]);
  const product = useQuery({
    queryKey: ["product", id],
    queryFn: ({ signal }) =>
      api.get<{
        product: ProductDTO;
        variants: ProductDTO[];
        bundleContents: { productId: string; title: string; qty: number }[];
      }>(`/catalog/products/${encodeURIComponent(id)}`, undefined, signal),
  });
  const allVariants = product.data?.variants || [];
  const variants = allVariants.some(isPhoneProduct)
    ? phoneDisplayVariants(allVariants)
    : allVariants;
  const p =
    variants.find((v) => v.productId === selected) ||
    variants[phoneDefaultVariantIndex(variants)] ||
    product.data?.product;
  if (!p)
    return (
      <Page>
        {product.isPending ? (
          <Loading />
        ) : (
          <Empty
            title="دریافت کالا ناموفق بود"
            description={product.error?.message}
            action={
              <Button
                label="تلاش مجدد"
                onPress={() => void product.refetch()}
              />
            }
          />
        )}
      </Page>
    );
  const images = productImages(allVariants.length ? allVariants : [p]);
  return (
    <Page
      refresh={() => void product.refetch()}
      refreshing={product.isRefetching}
    >
      <Card>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator
          contentContainerStyle={{ gap: 10 }}
        >
          {images.map((url) => (
            <View key={url} style={{ width: Math.min(width - 72, 660) }}>
              <Photo url={url} height={300} />
            </View>
          ))}
        </ScrollView>
        <Txt bold size={21}>
          {p.title}
        </Txt>
        <Txt muted>
          {p.brandFaName || p.brandName} • کد کالا: {p.productId}
        </Txt>
        {variants.length > 1 && (
          <Select
            label="مدل / رنگ"
            value={p.productId}
            options={variants.map((v) => ({
              value: v.productId,
              label: `${v.subTitle || v.color || v.title} — ${money(v.price)}`,
            }))}
            onChange={setSelected}
          />
        )}
        {stockFor(p, "kerman") + stockFor(p, "tehran") > 0 ? (
          <Money amount={p.price} size={24} />
        ) : (
          <Txt bold size={20}>
            ناموجود
          </Txt>
        )}
        {p.oldPrice &&
        p.oldPrice > p.price &&
        stockFor(p, "kerman") + stockFor(p, "tehran") > 0 ? (
          <Txt muted style={{ textDecorationLine: "line-through" }}>
            {money(p.oldPrice)}
          </Txt>
        ) : null}
        <Txt>{p.warranty}</Txt>
        <Txt muted>شرایط تسویه: {p.sellType || "طبق شرایط فروشگاه"}</Txt>
        {(["kerman", "tehran"] as Warehouse[]).map((w) => (
          <Quantity key={w} product={p} warehouse={w} />
        ))}
        <Button
          label="اشتراک‌گذاری کالا"
          secondary
          icon="share-social-outline"
          onPress={() =>
            void Share.share({
              message: `${p.title}\n${ORIGIN}/product/${p.productId}`,
            }).catch(() => {})
          }
        />
      </Card>
      {plain(p.description) && (
        <Card>
          <Txt bold size={18}>
            معرفی محصول
          </Txt>
          <Txt>{plain(p.description)}</Txt>
        </Card>
      )}
      {p.attributes.length > 0 && (
        <Card>
          <Txt bold size={18}>
            مشخصات فنی
          </Txt>
          {p.attributes.map((a, i) => (
            <Row
              key={i}
              style={{
                justifyContent: "space-between",
                borderBottomWidth: 1,
                borderColor: c.border,
                paddingBottom: 10,
                alignItems: "flex-start",
              }}
            >
              <Txt muted>{a.key}</Txt>
              <Txt style={{ maxWidth: "65%" }}>{a.value}</Txt>
            </Row>
          ))}
        </Card>
      )}
      {!!product.data?.bundleContents.length && (
        <Card>
          <Txt bold>محتویات سبد</Txt>
          {product.data.bundleContents.map((b) => (
            <Button
              key={b.productId}
              secondary
              label={`${b.title} × ${b.qty}`}
              onPress={() => navigation.push("Product", { id: b.productId })}
            />
          ))}
        </Card>
      )}
    </Page>
  );
}
export function FavoritesScreen() {
  const { favorites } = useStore();
  const c = useColors();
  const q = useQuery({
    queryKey: ["favorites", favorites],
    queryFn: async () => {
      const result = await Promise.allSettled(
        favorites.map((id) =>
          api.get<{ product: ProductDTO; variants: ProductDTO[] }>(
            `/catalog/products/${encodeURIComponent(id)}`,
          ),
        ),
      );
      return {
        items: result.flatMap((r) =>
          r.status === "fulfilled" ? [r.value] : [],
        ),
        failed: result.filter((r) => r.status === "rejected").length,
      };
    },
  });
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={q.data?.items || []}
        contentContainerStyle={{ padding: 16, gap: 14 }}
        keyExtractor={(x) => x.product.productId}
        renderItem={({ item }) => (
          <ProductTile
            variants={item.variants.length ? item.variants : [item.product]}
          />
        )}
        ListHeaderComponent={
          q.data?.failed ? (
            <Notice text="برخی کالاها حذف شده‌اند یا فعلاً در دسترس نیستند." />
          ) : undefined
        }
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        ListEmptyComponent={
          q.isPending ? (
            <Loading />
          ) : (
            <Empty
              title="علاقه‌مندی‌ها خالی است"
              description="با لمس قلب محصولات، آن‌ها را اینجا نگه دارید."
            />
          )
        }
      />
    </View>
  );
}
export function CartScreen() {
  const store = useStore();
  const nav = useNavigation<Nav>();
  return (
    <Page>
      <Txt bold size={24}>
        سبد خرید
      </Txt>
      {store.lines.map((l) => (
        <Card key={`${l.product.productId}-${l.warehouse}`}>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ width: 88 }}>
              <Photo url={l.product.imageUrl} height={88} />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <Txt bold>{l.product.title}</Txt>
              <Money amount={l.product.price * l.qty} size={16} />
            </View>
          </Row>
          <Quantity product={l.product} warehouse={l.warehouse} />
        </Card>
      ))}
      {!store.lines.length ? (
        <Empty
          title="سبد خرید خالی است"
          description="از فروشگاه، کالای موردنظرتان را اضافه کنید."
        />
      ) : (
        <Card>
          <Txt muted>
            قیمت نهایی و موجودی در مرحله پرداخت از سرور دریافت می‌شود.
          </Txt>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt bold>جمع کالاها</Txt>
            <Money amount={total(store.lines)} />
          </Row>
          <Button
            label={
              store.user ? "ادامه و انتخاب شرایط پرداخت" : "ورود و ادامه خرید"
            }
            onPress={() => nav.navigate(store.user ? "Checkout" : "Login")}
          />
        </Card>
      )}
    </Page>
  );
}
