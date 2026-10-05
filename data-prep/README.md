# Microbiology E.A LTD — Product Catalog Analysis

Source: [https://microbiology.co.ke/](https://microbiology.co.ke/)

## Site overview

| Field | Value |
|-------|--------|
| Company | Microbiology E.A LTD |
| Tagline | Redefining Point of Care Testing |
| Phone | 020 790 5150 |
| Email | info@microbiology.co.ke |
| Address | Garden Court Road, B46 (Garden Estate, Nairobi) |
| Platform | WordPress + WooCommerce-style product categories |
| Catalog URL pattern | `/product-category/{slug}/` |
| Product URL pattern | `/{product-slug}/` |

## Catalog structure

The public navigation exposes **8 top-level product categories**. Several categories have **nested subcategories** (especially Haematology and Immunoassay). Individual products are WordPress pages/posts with detail pages containing headings, feature bullets, and images — **prices are not published** on the public site.

```
Catalog
├── Haematology
│   ├── Haematology Analyzers
│   ├── Haematology Reagents
│   ├── Haematology Controls & Calibrators
│   └── Haemoglobin Meters
├── Clinical Chemistry
├── Immunoassay
│   └── I-Chroma Reagents (biomarker groupings)
├── Critical Care
├── Rapid Test Strips
├── Blood Sugar Testing
├── Specimen Collections
└── General Laboratory Equipments
```

## Files in this folder

| File | Purpose |
|------|---------|
| `catalog-overview.json` | Site metadata + hierarchical category tree |
| `categories.json` | Flat list of categories/subcategories for import |
| `products.json` | Flat product list with category assignments |
| `hampton-import-schema.json` | Field mapping to Hampton Scientific `Product` / `ProductCategory` models |

## Notes for import into Hampton Scientific

- **No public pricing** — all `price` fields should be `null` or `0` until admin sets them.
- **Images** are hotlinked from `microbiology.co.ke/wp-content/uploads/` — download and re-host for production.
- **Slugs** are inferred from nav + category pages; verify before bulk import.
- **I-Chroma Reagents** has biomarker sub-groups (Diabetes, Hormones, Infection, etc.) — model as subcategory or product tags.
