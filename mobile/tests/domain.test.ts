import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProductDTO } from "@tamas/shared";
import {
  ascii,
  changeCart,
  checkoutItems,
  privateUrl,
  productImages,
  publicUrl,
  restoreCart,
  total,
  date,
  catalogEntries,
  catalogPrice,
  notificationDestination,
} from "../src/domain";
test("notification taps open the matching private area without trusting a payload URL", () => {
  assert.equal(notificationDestination("wallet.changed"), "wallet");
  assert.equal(notificationDestination("payment.paid"), "orders");
  assert.equal(notificationDestination("order.created"), "orders");
  assert.equal(notificationDestination("installment.reminder"), "credit");
  assert.equal(notificationDestination("cheque.changed"), "credit");
  assert.equal(notificationDestination("credit.updated"), "credit");
  assert.equal(notificationDestination("document.requested"), "documents");
  assert.equal(notificationDestination("https://example.invalid"), "account");
  assert.equal(notificationDestination(undefined), "account");
});
const product = {
  productId: "01234",
  title: "آزمون",
  price: 1000,
  kermanStock: 3,
  tehranStock: 2,
  gallery: ["/uploads/b.png"],
  imageUrl: "/uploads/a.png",
} as ProductDTO;
test("Persian and Arabic numbers become ASCII without removing leading zero", () => {
  assert.equal(ascii("۰۹۱۳١٢٣۴۵۶۷"), "09131234567");
});
test("cart clamps quantities to warehouse stock and does not mutate other warehouse", () => {
  const first = changeCart([], product, "kerman", 99);
  assert.equal(first[0]?.qty, 3);
  const both = changeCart(first, product, "tehran", 1);
  assert.equal(both.length, 2);
  assert.equal(total(both), 4000);
  assert.equal(changeCart(both, product, "kerman", 0).length, 1);
  assert.equal(first[0]?.qty, 3);
});
test("server receives identifiers and quantities, not trusted prices", () => {
  assert.deepEqual(checkoutItems([{ product, warehouse: "kerman", qty: 2 }]), [
    { productId: "01234", warehouse: "kerman", qty: 2 },
  ]);
});
test("legacy unsplit stock remains buyable and inactive stock does not", () => {
  assert.equal(
    changeCart(
      [],
      { ...product, kermanStock: 0, tehranStock: 0, stock: 4 },
      "kerman",
      2,
    )[0]?.qty,
    2,
  );
  assert.equal(
    changeCart([], { ...product, status: "inactive" }, "kerman", 2).length,
    0,
  );
});
test("private file access is same-origin, no query tokens, no external hosts", () => {
  assert.equal(
    privateUrl("/api/files/12"),
    "https://tamasmarket.com/api/files/12",
  );
  for (const url of [
    "https://evil.example/api/files/12",
    "//evil.example/api/files/12",
    "/api/files/12?token=secret",
    "/uploads/a.pdf",
    "javascript:alert(1)",
    "/api/files/12#x",
  ])
    assert.throws(() => privateUrl(url));
});
test("public media refuses unsafe schemes and all gallery images are deduplicated", () => {
  assert.equal(publicUrl("javascript:alert(1)"), undefined);
  assert.equal(publicUrl("http://example.com/a"), undefined);
  assert.deepEqual(productImages([product, product]), [
    "https://tamasmarket.com/uploads/a.png",
    "https://tamasmarket.com/uploads/b.png",
  ]);
});
test("invalid persisted cart cannot introduce arbitrary warehouse or quantity", () => {
  assert.deepEqual(
    restoreCart([
      { product, warehouse: "admin", qty: 1 },
      { product, warehouse: "tehran", qty: -2 },
    ]),
    [],
  );
  assert.equal(
    restoreCart([{ product, warehouse: "kerman", qty: 1 }]).length,
    1,
  );
});

test("display dates are Jalali and use Tehran day, independent of default device calendar", () => {
  assert.equal(date("2026-10-24"), "۱۴۰۵/۰۸/۰۲");
  assert.equal(date("2026-10-23T21:00:00Z"), "۱۴۰۵/۰۸/۰۲");
  assert.equal(date("2025-03-20"), "۱۴۰۳/۱۲/۳۰");
  assert.equal(date(null), "—");
  assert.equal(date("not-a-date"), "—");
});

test("catalog inherits model images without promoting photo-only phone rows to products", () => {
  const phone = {
    ...product,
    categoryName: "Mobile phones",
    categoryFaName: "گوشی موبایل",
    color: "مشکی",
    sku: "01234",
    imageUrl: null,
    gallery: [],
  };
  const media = {
    ...phone,
    productId: "photo",
    color: "",
    sku: null,
    price: 0,
    stock: 0,
    kermanStock: 0,
    tehranStock: 0,
    imageUrl: "/uploads/model.png",
  };
  const entries = catalogEntries(
    [{ variants: [phone, media] }],
    true,
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.productId, phone.productId);
  assert.equal(entries[0]?.imageUrl, "/uploads/model.png");
  assert.equal(phone.imageUrl, null);
  assert.equal(
    catalogEntries([{ variants: [product] }], true).length,
    0,
  );
  assert.equal(catalogPrice({ ...product, price: 0 }), "استعلام قیمت");
});
