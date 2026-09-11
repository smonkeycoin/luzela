alter table public.product_variants
  add column if not exists offer_price_cents integer,
  add column if not exists offer_active boolean not null default false;

alter table public.product_variants
  drop constraint if exists product_variants_offer_price_cents_check,
  add constraint product_variants_offer_price_cents_check
  check (offer_price_cents is null or offer_price_cents > 0);

alter table public.product_variants
  drop constraint if exists product_variants_offer_price_lower_than_original_check,
  add constraint product_variants_offer_price_lower_than_original_check
  check (
    offer_active = false
    or (
      offer_price_cents is not null
      and offer_price_cents > 0
      and offer_price_cents < price_cents
    )
  );

create index if not exists product_variants_offer_active_idx
  on public.product_variants(offer_active)
  where deleted_at is null;
