import { test } from "node:test";
import assert from "node:assert/strict";
import { managementNavigation } from "../src/web-policy";
import { execFileSync } from "node:child_process";

test("management embeds only the exact HTTPS storefront origin", () => {
  assert.equal(
    managementNavigation("https://tamasmarket.com/admin/orders"),
    "internal",
  );
  assert.equal(
    managementNavigation("https://tamasmarket.com/api/auth/me"),
    "internal",
  );
  assert.equal(
    managementNavigation("https://tamasmarket.com.evil.invalid/admin"),
    "external",
  );
  assert.equal(managementNavigation("http://tamasmarket.com/admin"), "block");
  assert.equal(
    managementNavigation("https://user:password@tamasmarket.com/admin"),
    "block",
  );
});
test("embedded management cannot open local files, scripts or arbitrary app intents", () => {
  for (const value of [
    "javascript:alert(1)",
    "file:///data/data/private",
    "data:text/html,hello",
    "intent://settings",
    "about:blank",
    "not-a-url",
  ])
    assert.equal(managementNavigation(value), "block");
  assert.equal(managementNavigation("tel:09135006644"), "external");
  assert.equal(managementNavigation("mailto:support@example.com"), "external");
});
test("native design tokens remain in sync with the website in both themes", () => {
  assert.match(
    execFileSync(
      process.execPath,
      ["scripts/sync-design-system.mjs", "--check"],
      { encoding: "utf8" },
    ),
    /match storefront/,
  );
});
