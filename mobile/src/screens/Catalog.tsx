import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import ViewShot from "react-native-view-shot";
import { Image } from "expo-image";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import type { ProductDTO, ProductGroupDTO } from "@tamas/shared";
import { api } from "../api";
import { catalogEntries, catalogPrice, date, publicUrl } from "../domain";
import { useBootstrap } from "../hooks";
import {
  Button,
  Card,
  Empty,
  Loading,
  Notice,
  Page,
  Row,
  Select,
  Txt,
  useAction,
} from "../ui";
import { SECTIONS } from "../terms";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function TermsScreen() {
  return (
    <Page>
      <Txt bold size={25}>
        شرایط و قوانین تماس مارکت
      </Txt>
      {SECTIONS.map((s) => (
        <Card key={s.id}>
          <Txt bold size={20}>
            {s.title}
          </Txt>
          {s.items.map((i, j) => (
            <View key={j} style={{ gap: 5 }}>
              <Txt bold>{i.lead}</Txt>
              <Txt>{i.body}</Txt>
            </View>
          ))}
        </Card>
      ))}
    </Page>
  );
}
export function CatalogScreen() {
  const boot = useBootstrap(),
    a = useAction();
  const [kind, setKind] = useState("pdf"),
    [category, setCategory] = useState(""),
    [brand, setBrand] = useState(""),
    [stock, setStock] = useState("true");
  const [products, setProducts] = useState<ProductDTO[]>([]),
    [page, setPage] = useState("0"),
    [progress, setProgress] = useState(""),
    [loaded, setLoaded] = useState<Set<string>>(new Set()),
    [failed, setFailed] = useState<Set<string>>(new Set());
  const controller = useRef<AbortController | null>(null),
    shot = useRef<React.ElementRef<typeof ViewShot>>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const invalidate = () => {
    controller.current?.abort();
    a.reset();
    setProducts([]);
    setLoaded(new Set());
    setFailed(new Set());
    setPage("0");
    setProgress("");
  };
  const pageSize = 4;
  const pages = Math.max(1, Math.ceil(products.length / pageSize));
  const visible = products.slice(
    Number(page) * pageSize,
    (Number(page) + 1) * pageSize,
  );
  const imagesReady = visible.every(
    (p) => !publicUrl(p.imageUrl) || loaded.has(p.productId),
  );
  const load = () =>
    a.run(async () => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      const all: ProductDTO[] = [];
      let next = 1;
      let total: number;
      do {
        const r = await api.get<{
          groups: ProductGroupDTO[];
          total: number;
          perPage: number;
        }>(
          "/catalog/products",
          {
            category,
            brands: brand,
            inStock: stock === "true",
            sort: "title",
            page: next,
            perPage: 120,
          },
          abort.signal,
        );
        total = r.total;
        all.push(...catalogEntries(r.groups, kind === "glass"));
        setProgress(`${all.length.toLocaleString("fa-IR")} کالا دریافت شد`);
        next++;
        if (next > 50)
          throw new Error(
            "تعداد کالاها زیاد است؛ دسته‌بندی یا برند را محدود کنید.",
          );
      } while ((next - 1) * 120 < total);
      if (abort.signal.aborted) return false;
      const filtered = all;
      setProducts(filtered);
      setPage("0");
      setLoaded(new Set());
      setFailed(new Set());
      if (!filtered.length)
        throw new Error(
          "کالایی با این فیلترها پیدا نشد؛ دسته‌بندی، برند یا شرط موجودی را تغییر دهید.",
        );
    }, "کاتالوگ آماده شد؛ حالا می‌توانید خروجی بگیرید.");
  const share = () =>
    a.run(async () => {
      let uri: string | undefined;
      try {
        if (kind === "glass") {
          if (!imagesReady)
            throw new Error("لطفاً تا بارگذاری تصاویر صبر کنید.");
          uri = await shot.current?.capture?.();
        } else {
          const rows = products
            .map(
              (p) =>
                `<article>${publicUrl(p.imageUrl) ? `<img src="${escape(publicUrl(p.imageUrl)!)}"/>` : "<p>تصویر موجود نیست</p>"}<h3>${escape(p.title)}</h3><p>${escape(p.color || "")} • ${escape(p.productId)}</p><strong>${escape(catalogPrice(p))}</strong><p>کرمان: ${p.kermanStock} — تهران: ${p.tehranStock}</p></article>`,
            )
            .join("");
          const r = await Print.printToFileAsync({
            html: `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"/><style>@page{size:A4;margin:12mm}body{font-family:sans-serif;color:#123}h1{color:#087f92}main{display:flex;flex-wrap:wrap;gap:12px}article{width:30%;border:1px solid #ddd;border-radius:12px;padding:10px;break-inside:avoid;box-sizing:border-box}img{width:100%;height:120px;object-fit:contain}h3{font-size:12px}p{font-size:11px}strong{font-size:14px;color:#087f92}</style></head><body><h1>کاتالوگ تماس مارکت</h1><p>${escape(date(new Date().toISOString()))} — قیمت و موجودی در زمان خروجی؛ قیمت قطعی هنگام ثبت سفارش مشخص می‌شود.</p><main>${rows}</main></body></html>`,
          });
          uri = r.uri;
        }
        if (!uri) throw new Error("ساخت فایل ناموفق بود.");
        await Sharing.shareAsync(uri, {
          mimeType: kind === "glass" ? "image/png" : "application/pdf",
          dialogTitle: "ذخیره یا ارسال کاتالوگ",
        });
      } finally {
        if (uri)
          await FileSystem.deleteAsync(uri, { idempotent: true }).catch(
            () => {},
          );
      }
    }, "خروجی آماده و به پنجرهٔ ذخیره / اشتراک‌گذاری ارسال شد.");
  return (
    <Page>
      <Card>
        <Txt bold size={23}>
          کاتالوگ فروشگاه
        </Txt>
        <Txt muted>
          ابتدا فیلترها را انتخاب کنید؛ خروجی فقط با دکمهٔ ساخت فایل باز می‌شود.
        </Txt>
        <Select
          label="نوع کاتالوگ"
          disabled={a.busy}
          value={kind}
          options={[
            { label: "کاتالوگ PDF موجودی", value: "pdf" },
            { label: "کاتالوگ شیشه‌ای موبایل (عکس ۱۰۸۰×۱۹۲۰)", value: "glass" },
          ]}
          onChange={(v) => {
            setKind(v);
            invalidate();
          }}
        />
        <Select
          label="دسته‌بندی"
          disabled={a.busy}
          value={category}
          options={[
            { label: "همه دسته‌بندی‌ها", value: "" },
            ...(boot.data?.categories || []).map((c) => ({
              label: c.faName || c.name,
              value: c.name,
            })),
          ]}
          onChange={(v) => {
            setCategory(v);
            invalidate();
          }}
        />
        <Select
          label="برند"
          disabled={a.busy}
          value={brand}
          options={[
            { label: "همه برندها", value: "" },
            ...(boot.data?.brands || []).map((b) => ({
              label: b.faName || b.name,
              value: b.name,
            })),
          ]}
          onChange={(v) => {
            setBrand(v);
            invalidate();
          }}
        />
        <Select
          label="وضعیت موجودی"
          disabled={a.busy}
          value={stock}
          options={[
            { label: "فقط موجود", value: "true" },
            { label: "همه کالاها", value: "false" },
          ]}
          onChange={(v) => {
            setStock(v);
            invalidate();
          }}
        />
        <Button
          label="آماده‌سازی کاتالوگ با این فیلترها"
          busy={a.busy}
          onPress={() => void load()}
        />
        <Notice text={progress} />
        {a.feedback}
      </Card>
      {!!products.length && (
        <Card>
          <Txt bold>
            {products.length.toLocaleString("fa-IR")} کالا آمادهٔ خروجی است
          </Txt>
          {kind === "glass" && (
            <>
              <Select
                label="صفحهٔ عکس"
                value={page}
                options={Array.from({ length: pages }, (_, i) => ({
                  value: String(i),
                  label: `صفحه ${(i + 1).toLocaleString("fa-IR")} از ${pages.toLocaleString("fa-IR")}`,
                }))}
                onChange={setPage}
              />
              <ViewShot
                ref={shot}
                options={{
                  format: "png",
                  quality: 1,
                  width: 1080,
                  height: 1920,
                  result: "tmpfile",
                }}
                style={{
                  backgroundColor: "#101f38",
                  padding: 14,
                  borderRadius: 18,
                  aspectRatio: 1080 / 1920,
                  gap: 10,
                }}
              >
                <Txt color="#ffffff" bold size={18} allowFontScaling={false}>
                  تماس مارکت | لیست قیمت موبایل
                </Txt>
                <Txt color="#a5c1d8" size={11} allowFontScaling={false}>
                  {date(new Date().toISOString())} • صفحه {Number(page) + 1}
                </Txt>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row-reverse",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {visible.map((p) => (
                    <View
                      key={p.productId}
                      style={{
                        width: "48%",
                        height: "47%",
                        padding: 7,
                        borderRadius: 10,
                        backgroundColor: "#233a54",
                        gap: 3,
                      }}
                    >
                      {publicUrl(p.imageUrl) && !failed.has(p.productId) ? (
                        <Image
                          source={{ uri: publicUrl(p.imageUrl) }}
                          contentFit="contain"
                          style={{
                            flex: 1,
                            minHeight: 25,
                            width: "100%",
                            backgroundColor: "#ffffff",
                            borderRadius: 7,
                          }}
                          onLoad={() =>
                            setLoaded((s) => new Set(s).add(p.productId))
                          }
                          onError={() => {
                            setLoaded((s) => new Set(s).add(p.productId));
                            setFailed((s) => new Set(s).add(p.productId));
                          }}
                        />
                      ) : (
                        <View
                          style={{
                            flex: 1,
                            minHeight: 25,
                            backgroundColor: "#ffffff",
                            borderRadius: 7,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Txt
                            size={10}
                            color="#64788c"
                            allowFontScaling={false}
                          >
                            تصویر موجود نیست
                          </Txt>
                        </View>
                      )}
                      <Txt
                        color="#ffffff"
                        bold
                        size={10}
                        numberOfLines={2}
                        allowFontScaling={false}
                      >
                        {p.title}
                      </Txt>
                      <Txt
                        color="#adc8df"
                        size={9}
                        numberOfLines={1}
                        allowFontScaling={false}
                      >
                        {p.color} • {p.productId}
                      </Txt>
                      <Txt
                        color="#6ee2e1"
                        bold
                        size={12}
                        allowFontScaling={false}
                      >
                        {catalogPrice(p)}
                      </Txt>
                    </View>
                  ))}
                </View>
                <Txt color="#a5c1d8" size={9} allowFontScaling={false}>
                  قیمت‌ها به تومان • tamasmarket.com • موجودی و قیمت در زمان
                  صدور
                </Txt>
              </ViewShot>
              {!imagesReady && (
                <Notice text="تصاویر در حال دریافت‌اند؛ پس از تکمیل، ذخیره فعال می‌شود." />
              )}
            </>
          )}
          <Button
            label={
              kind === "glass"
                ? "ذخیره / ارسال عکس این صفحه"
                : "ساخت و ذخیره PDF"
            }
            busy={a.busy}
            disabled={kind === "glass" && !imagesReady}
            onPress={() => void share()}
          />
        </Card>
      )}
    </Page>
  );
}
