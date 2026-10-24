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
} from "../src/domain";
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
