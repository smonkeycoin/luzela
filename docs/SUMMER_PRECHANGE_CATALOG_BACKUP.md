# Summer Prechange Catalog Backup

Logical export taken before any SUMMER catalog mutation. No secrets included.
The SUMMER catalog was not applied because the current locked Commerce Engine
cannot safely consume physical bundle units.

```json
{
  "products": [
    {
      "slug": "luzela-spf-50",
      "name": "Luzela SPF 50+",
      "status": "active",
      "free_shipping": false,
      "is_bundle": false,
      "variants": [
        {
          "sku": "LUZ-SPF50-IND",
          "name": "Individual",
          "status": "active",
          "price_cents": 59000,
          "stock_on_hand": 24,
          "bundle_components": []
        }
      ]
    },
    {
      "slug": "luzela-duo",
      "name": "Luzela Duo",
      "status": "active",
      "free_shipping": true,
      "is_bundle": true,
      "variants": [
        {
          "sku": "LUZ-SPF50-DUO",
          "name": "Duo",
          "status": "active",
          "price_cents": 99000,
          "stock_on_hand": 15,
          "bundle_components": []
        }
      ]
    }
  ]
}
```

