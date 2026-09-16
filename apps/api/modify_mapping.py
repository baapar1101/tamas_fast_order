import re

path = 'src/services/sheets/mapping.ts'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# PRODUCT
text = re.sub(
    r"const PRODUCT_COLUMNS = \[.*?\];",
    "const PRODUCT_COLUMNS = ['product_id', 'Category', 'Brand', 'title', 'model', 'color', 'sku', 'RIAL PRICE', 'price', 'old_price', 'sell_type', 'discount%', 'kerman_stock', 'tehran_stock', 'warranty', 'promotion', 'status', 'image_url', 'attribute_key', 'attribute_value'];",
    text,
    flags=re.DOTALL
)

text = re.sub(
    r"price: String\(r\.price\),\s*old_price: r\.oldPrice == null \? '' : String\(r\.oldPrice\),\s*discount: String\(r\.discount\),\s*stock: String\(r\.stock\),\s*kerman_stock: String\(r\.kermanStock\)",
    "price: String(r.price),\n          'RIAL PRICE': String(r.price),\n          old_price: r.oldPrice == null ? '' : String(r.oldPrice),\n          'discount%': String(r.discount),\n          kerman_stock: String(r.kermanStock)",
    text
)

# CATEGORY
text = re.sub(
    r"const CATEGORY_COLUMNS = \['category_name', 'category_fa_name', 'icon_url', 'Brand', 'sort_order', UPDATED_AT_COLUMN\];",
    "const CATEGORY_COLUMNS = ['category_name', 'category_fa_name', 'icon_url', 'Brand'];",
    text
)

# BRAND
text = re.sub(
    r"const BRAND_COLUMNS = \['brand_name', 'brand_fa_name', 'icon_url', 'sort_order', UPDATED_AT_COLUMN\];",
    "const BRAND_COLUMNS = ['brand_name', 'brand_fa_name', 'icon_url'];",
    text
)

# COLOR
text = re.sub(
    r"const COLOR_COLUMNS = \['color_code', 'color_fa_name', 'color_name', UPDATED_AT_COLUMN\];",
    "const COLOR_COLUMNS = ['color_name', 'color_fa_name', 'color_code'];",
    text
)

# USER
text = re.sub(
    r"const USER_COLUMNS = \[.*?\];",
    "const USER_COLUMNS = ['name', 'last_name', 'Store_name', 'phone_number', 'mobile_number', 'address', 'postal_code', 'certificate_file_url', 'activity', 'page_website', 'actived'];",
    text,
    flags=re.DOTALL
)

# ORDER
text = re.sub(
    r"const ORDER_COLUMNS = \[.*?\];",
    "const ORDER_COLUMNS = ['order_id', 'created_at', 'customer_name', 'phone', 'address', 'items_json', 'total', 'payment', 'status'];",
    text,
    flags=re.DOTALL
)
text = text.replace("date: iso(r.createdAt),", "created_at: iso(r.createdAt),")
text = text.replace("total_price: String(r.totalPrice),", "total: String(r.totalPrice),")

# SETTING
text = re.sub(
    r"const SETTING_COLUMNS = \['key', 'value', UPDATED_AT_COLUMN\];",
    "const SETTING_COLUMNS = ['key', 'value'];",
    text
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Done")
