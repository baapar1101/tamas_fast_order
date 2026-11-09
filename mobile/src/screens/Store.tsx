import React, { useEffect, useState } from "react";
import { FlatList, useWindowDimensions, View, Share } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { ProductDTO, Warehouse } from "@tamas/shared";
import {
  isPhoneProduct,
  phoneDefaultVariantIndex,
  phoneDisplayVariants,
} from "@tamas/shared";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { api } from "../api";
import { useStore } from "../state";
import { money, ORIGIN, plain, stockFor, total } from "../domain";
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
  Select,
  Txt,
  useColors,
} from "../ui";
import type { RootRoutes, ScreenProps } from "../navigation";
import {
  NativeProductTile,
  PurchaseQuantity,
  ProductGallery,
} from "./Storefront";
type Nav = NativeStackNavigationProp<RootRoutes>;
export const ProductTile = NativeProductTile;
export const Quantity = PurchaseQuantity;
export function ProductScreen({ route, navigation }: ScreenProps<"Product">) {
  const { id } = route.params;
  const [selected, setSelected] = useState(id);
  const c = useColors();
  const { width } = useWindowDimensions();
  const { user } = useStore();
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
  return (
    <Page
      refresh={() => void product.refetch()}
      refreshing={product.isRefetching}
    >
      <Card>
        <ProductGallery
          products={allVariants.length ? allVariants : [p]}
          height={Math.min(width - 56, 340)}
        />
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
              label: `${v.subTitle || v.color || v.title}${user?.isActive ? ` — ${money(v.price)}` : ""}`,
            }))}
            onChange={setSelected}
          />
        )}
        {user?.isActive && stockFor(p, "kerman") + stockFor(p, "tehran") > 0 ? (
          <Money amount={p.price} size={24} />
        ) : (
          <Txt bold size={20}>
            {user?.isActive ? "ناموجود" : "قیمت ویژه همکاران پس از ورود"}
          </Txt>
        )}
        {user?.isActive &&
        p.oldPrice &&
        p.oldPrice > p.price &&
        stockFor(p, "kerman") + stockFor(p, "tehran") > 0 ? (
          <Txt muted style={{ textDecorationLine: "line-through" }}>
            {money(p.oldPrice)}
          </Txt>
        ) : null}
        <Txt>{p.warranty}</Txt>
        <Txt muted>شرایط تسویه: {p.sellType || "طبق شرایط فروشگاه"}</Txt>
        {user?.isActive ? (
          (p.kermanStock + p.tehranStock > 0
            ? (["kerman", "tehran"] as Warehouse[])
            : (["site"] as Warehouse[])
          )
            .filter((w) => stockFor(p, w) > 0 && p.price > 0)
            .map((w) => <Quantity key={w} product={p} warehouse={w} />)
        ) : (
          <Button
            label="ورود / ثبت‌نام همکار"
            onPress={() => navigation.navigate("Login")}
          />
        )}
        <Button
          label="اشتراک‌گذاری کالا"
          secondary
          icon="share-social-outline"
          onPress={() =>
            void Share.share({
              message: `${p.title}\n${ORIGIN}/p/${p.productId}`,
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
