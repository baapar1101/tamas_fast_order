# Tamas Fast Order — Project Rules

## Product source of truth

The site database is authoritative for product existence, codes, descriptions, prices and stock. Google Sheets and CRM are downstream mirrors of active site products.

- Product codes are strings of digits beginning with `0`. Never coerce them to numbers or strip leading zeros.
- Creating, editing or deleting a product starts on the site. Publish those changes to Google Sheets and CRM.
- A product deleted on the site must be absent from the Products sheet and removed from CRM. Keep local order history intact.
- Spreadsheet edits must not recreate deleted products or overwrite site-owned product fields. Excel imports update the site first, then publish outward.
- Other sheet tabs may have their own merge rules; do not infer product ownership from those tabs.

For repository layout and documentation entry points, see [`README.md`](../README.md).
