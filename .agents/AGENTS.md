# Tamas Fast Order — Project Rules

## Google Sheet is the Source of Truth for Price & Stock

**RULE: Price and stock values must ALWAYS be read from Google Sheet. Google Sheet wins all conflicts.**

- `price`, `comparePrice` (or any price-related field) must **never** be taken from the local database as the authoritative value.
- `stock` / `quantity` / `inStock` must **never** be taken from the local database as the authoritative value.
- When a conflict exists between the database and Google Sheet, **Google Sheet always wins**.
- Any code that writes price or stock to the DB must treat the DB copy as a **cache** only — it must be refreshed from Google Sheet before serving to clients.
- Sync jobs, API endpoints, and UI logic must follow this hierarchy:

```
Google Sheet  →  (sync/cache)  →  Database  →  API  →  Client
      ↑
  Source of Truth
```

### Enforcement Checklist for Code Changes
- [ ] Does this change read price/stock from the DB without first checking Google Sheet freshness? → **Fix it.**
- [ ] Does this change allow a user or admin action to permanently override price/stock in the DB? → **Disallow it.**
- [ ] Does this change add a price or stock field to a form/mutation? → **Ensure it still syncs from Sheet before persisting.**
