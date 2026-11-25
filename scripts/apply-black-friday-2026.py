"""Prepare or apply Black Friday prices through the current tamasmarket.com API.

Dry-run is the default. Application requires a reviewed plan hash and an admin
Bearer token supplied only through TAMAS_ADMIN_TOKEN. No SSH/database access.
"""
import argparse
import csv
import hashlib
import io
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://tamasmarket.com/api'
RIBBON = 'ویژه بلک فرایدی'
ITEMS = json.loads((ROOT / 'campaigns/black-friday-2026.json').read_text(encoding='utf-8'))['items']
OUT = ROOT / 'outputs'
PLAN_FILE = OUT / 'black-friday-2026-plan.csv'
MISSING_FILE = OUT / 'black-friday-2026-missing.csv'
FIELDS = [
    'id', 'productId', 'sku', 'title', 'sheet_quantity', 'site_available',
    'discount_percent', 'regular_price', 'sale_price', 'current_price',
    'current_old_price', 'current_ribbon', 'current_sell_type',
    'target_ribbon', 'target_sell_type', 'stock_action', 'has_photo',
]

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        raise urllib.error.HTTPError(request.full_url, code, 'API redirect refused', headers, file_pointer)


OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())


def api(path: str, *, method: str = 'GET', body: dict | None = None, token: str | None = None) -> dict:
    headers = {'Accept': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    if body is not None:
        headers['Content-Type'] = 'application/json'
    request = urllib.request.Request(
        BASE + path,
        data=json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None,
        headers=headers,
        method=method,
    )
    with OPENER.open(request, timeout=30) as response:
        return json.load(response)


def variants(response: dict) -> list[dict]:
    return [variant for group in response.get('groups', []) for variant in group.get('variants', [])]


def current_catalog() -> dict[str, dict]:
    first = api('/catalog/products?inStock=false&sort=title&perPage=120&page=1')
    count = (first['total'] + 119) // 120
    with ThreadPoolExecutor(max_workers=6) as executor:
        pages = list(executor.map(
            lambda page: api(f'/catalog/products?inStock=false&sort=title&perPage=120&page={page}'),
            range(2, count + 1),
        ))
    catalog: dict[str, dict] = {}
    for page in [first, *pages]:
        for row in variants(page):
            sku = str(row.get('sku') or '')
            if not sku:
                continue
            if sku in catalog and catalog[sku]['id'] != row['id']:
                raise RuntimeError(f'SKU {sku} belongs to multiple active products')
            catalog[sku] = row
    # Group pagination can omit a few title groups when their display title is
    # normalized differently. Search those source SKUs directly before declaring
    # them absent from the active catalogue.
    missing_skus = [item['sku'] for item in ITEMS if item['sku'] not in catalog]
    def find_exact(sku: str) -> tuple[str, dict | None]:
        query = urllib.parse.urlencode({'q': sku, 'inStock': 'false', 'perPage': 120})
        found = next((row for row in variants(api('/catalog/products?' + query)) if str(row.get('sku')) == sku), None)
        return sku, found
    with ThreadPoolExecutor(max_workers=6) as executor:
        for sku, found in executor.map(find_exact, missing_skus):
            if found:
                catalog[sku] = found
    return catalog


def build_plan(catalog: dict[str, dict]) -> tuple[list[dict], list[dict]]:
    plan, missing = [], []
    for item in ITEMS:
        product = catalog.get(item['sku'])
        if not product:
            missing.append({**item, 'reason': 'در کاتالوگ فعال سایت پیدا نشد'})
            continue
        available = int(product.get('kermanStock') or 0) + int(product.get('tehranStock') or 0)
        if not available:
            available = int(product.get('stock') or 0)
        if product.get('status') != 'active' or int(product.get('price') or 0) <= 0 or available <= 0:
            missing.append({**item, 'reason': 'قیمت یا موجودی فروش ندارد'})
            continue
        regular = int(product['oldPrice']) if product.get('ribbon') == RIBBON and product.get('oldPrice') else int(product['price'])
        sale = (regular * (100 - item['discountPercent']) + 50) // 100
        plan.append({
            'id': int(product['id']), 'productId': product['productId'],
            'sku': item['sku'], 'title': product['title'],
            'sheet_quantity': item['quantity'], 'site_available': available,
            'discount_percent': item['discountPercent'], 'regular_price': regular,
            'sale_price': sale, 'current_price': int(product['price']),
            'current_old_price': product.get('oldPrice') or '',
            'current_ribbon': product.get('ribbon') or '',
            'current_sell_type': product.get('sellType') or '',
            'target_ribbon': RIBBON, 'target_sell_type': 'فقط نقدی',
            'stock_action': 'بدون تغییر',
            'has_photo': 'yes' if product.get('imageUrl') else 'no',
        })
    return plan, missing


def csv_bytes(rows: list[dict], fields: list[str]) -> bytes:
    text = io.StringIO(newline='')
    writer = csv.DictWriter(text, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)
    return ('\ufeff' + text.getvalue()).encode('utf-8')


def main(apply: bool, approved_hash: str | None) -> None:
    assert len(ITEMS) == 261 and len({item['sku'] for item in ITEMS}) == len(ITEMS)
    assert all(re.fullmatch(r'\d{11}', item['sku']) and 0 < item['quantity'] <= 10_000 and 0 < item['discountPercent'] <= 65 for item in ITEMS)
    catalog = current_catalog()
    plan, missing = build_plan(catalog)
    expected = csv_bytes(plan, FIELDS)
    digest = hashlib.sha256(expected).hexdigest()
    OUT.mkdir(exist_ok=True)
    if not apply:
        PLAN_FILE.write_bytes(expected)
        MISSING_FILE.write_bytes(csv_bytes(missing, ['sku', 'title', 'quantity', 'discountPercent', 'reason']))
        print(json.dumps({
            'sheet_items': len(ITEMS), 'eligible': len(plan), 'not_eligible': len(missing),
            'max_discount': max((item['discount_percent'] for item in plan), default=0),
            'without_photo': sum(item['has_photo'] == 'no' for item in plan),
            'plan_sha256': digest, 'plan_file': str(PLAN_FILE), 'missing_file': str(MISSING_FILE),
        }, ensure_ascii=False))
        return
    if not approved_hash or not re.fullmatch(r'[0-9a-f]{64}', approved_hash):
        raise SystemExit('--apply requires --approved-plan-sha256 from the reviewed CSV')
    if not PLAN_FILE.exists() or hashlib.sha256(PLAN_FILE.read_bytes()).hexdigest() != approved_hash or digest != approved_hash:
        raise SystemExit('The live catalogue or approved CSV changed. Run dry-run again and obtain approval for the new plan.')
    token = os.environ.get('TAMAS_ADMIN_TOKEN')
    if not token:
        raise SystemExit('TAMAS_ADMIN_TOKEN is not set; no changes were sent.')
    for index, row in enumerate(plan, start=1):
        sku = row['sku']
        detail = api('/catalog/products/' + urllib.parse.quote(str(row['productId']), safe=''))['product']
        if (detail.get('sku') != sku or int(detail['price']) != row['current_price'] or
                (detail.get('oldPrice') or '') != row['current_old_price'] or
                (detail.get('ribbon') or '') != row['current_ribbon']):
            raise SystemExit(f'Product {sku} changed since the approved plan; stopped before its update.')
        body = {
            'price': row['sale_price'], 'oldPrice': row['regular_price'],
            'discount': row['discount_percent'], 'ribbon': RIBBON,
            'sellType': 'فقط نقدی',
        }
        try:
            updated = api(f"/admin/products/{row['id']}", method='PATCH', body=body, token=token)['product']
        except urllib.error.HTTPError as error:
            raise SystemExit(f'PATCH failed for SKU {sku} with HTTP {error.code}; {index - 1} items were updated.') from None
        if (int(updated['price']) != row['sale_price'] or updated.get('oldPrice') != row['regular_price'] or
                updated.get('ribbon') != RIBBON or updated.get('sellType') != 'فقط نقدی'):
            raise SystemExit(f'PATCH response mismatch for SKU {sku}; stopped for review.')
        print(f'{index}/{len(plan)} SKU {sku} updated')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--approved-plan-sha256')
    args = parser.parse_args()
    main(args.apply, args.approved_plan_sha256)
