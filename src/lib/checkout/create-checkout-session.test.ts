import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  getCheckoutProduct: vi.fn(),
  getPaymentProvider: vi.fn(),
  getStripe: vi.fn(),
}));

vi.mock("@/lib/catalog/get-checkout-product", () => ({
  getCheckoutProduct: mocks.getCheckoutProduct,
}));

vi.mock("@/lib/env", () => ({
  getAppUrl: () => "http://localhost:3001",
}));

vi.mock("@/lib/payments/provider", () => ({
  getPaymentProvider: mocks.getPaymentProvider,
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: mocks.getStripe,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

import { createCheckoutSession, createPaymentAttempt } from "./create-checkout-session";

type DbRow = Record<string, unknown>;

function createFakeSupabase(initial?: Partial<Record<string, DbRow[]>>) {
  const db: Record<string, DbRow[]> = {
    app_settings: [],
    checkout_sessions: [],
    customer_addresses: [],
    customers: [],
    order_items: [],
    orders: [],
    payments: [],
    ...initial,
  };
  const counters: Record<string, number> = {};

  function nextId(table: string) {
    counters[table] = (counters[table] || 0) + 1;
    return `${table}-${counters[table]}`;
  }

  function matches(row: DbRow, filters: Array<{ column: string; value: unknown }>) {
    return filters.every((filter) => row[filter.column] === filter.value);
  }

  class Builder {
    private filters: Array<{ column: string; value: unknown }> = [];
    private operation: "select" | "insert" | "update" | "upsert" = "select";
    private values: DbRow | DbRow[] | null = null;

    constructor(private table: string) {}

    select() {
      return this;
    }

    insert(values: DbRow | DbRow[]) {
      this.operation = "insert";
      this.values = values;
      return this;
    }

    update(values: DbRow) {
      this.operation = "update";
      this.values = values;
      return this;
    }

    upsert(values: DbRow) {
      this.operation = "upsert";
      this.values = values;
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value });
      return this;
    }

    maybeSingle() {
      const result = this.execute();
      const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
      return Promise.resolve({
        data: rows[0] || null,
        error: result.error,
      });
    }

    single() {
      const result = this.execute();
      const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
      return Promise.resolve({
        data: rows[0] || null,
        error: result.error,
      });
    }

    then(resolve: (value: unknown) => void, reject: (reason?: unknown) => void) {
      Promise.resolve(this.execute()).then(resolve, reject);
    }

    private execute() {
      if (this.operation === "select") {
        return {
          data: db[this.table].filter((row) => matches(row, this.filters)),
          error: null,
        };
      }

      if (this.operation === "upsert") {
        const value = this.values as DbRow;
        const existing = db[this.table].find((row) => row.email === value.email);

        if (existing) {
          Object.assign(existing, value);
          return { data: [existing], error: null };
        }

        const row = { id: nextId(this.table), ...value };
        db[this.table].push(row);
        return { data: [row], error: null };
      }

      if (this.operation === "insert") {
        const values = Array.isArray(this.values) ? this.values : [this.values as DbRow];
        const inserted: DbRow[] = [];

        for (const value of values) {
          if (
            this.table === "checkout_sessions" &&
            db.checkout_sessions.some((row) => row.idempotency_key === value.idempotency_key)
          ) {
            return {
              data: null,
              error: { code: "23505", message: "duplicate checkout idempotency" },
            };
          }

          if (
            this.table === "payments" &&
            db.payments.some((row) => row.idempotency_key === value.idempotency_key)
          ) {
            return {
              data: null,
              error: { code: "23505", message: "duplicate payment idempotency" },
            };
          }

          const row = { id: nextId(this.table), ...value };
          db[this.table].push(row);
          inserted.push(row);
        }

        return { data: inserted, error: null };
      }

      const value = this.values as DbRow;
      const updated: DbRow[] = [];

      for (const row of db[this.table]) {
        if (matches(row, this.filters)) {
          Object.assign(row, value);
          updated.push(row);
        }
      }

      return { data: updated, error: null };
    }
  }

  return {
    db,
    client: {
      rpc: vi.fn(async (_name: string, _args?: Record<string, unknown>) => ({ data: true as boolean, error: null as null })),
      from(table: string) {
        if (!db[table]) {
          db[table] = [];
        }

        return new Builder(table);
      },
    },
  };
}

const checkoutInput = {
  address_line1: "Calle Luz 123",
  city: "Cancun",
  country: "MX",
  email: "client@example.com",
  full_name: "Cliente Luz",
  idempotency_key: "11111111-1111-4111-8111-111111111111",
  neighborhood: "Centro",
  phone: "5555555555",
  postal_code: "77500",
  product_variant_id: "22222222-2222-4222-8222-222222222222",
  quantity: 1,
  state: "Quintana Roo",
};

const checkoutProduct = {
  product: {
    id: "product-1",
    slug: "summer-1x",
    name: "SUMMER 1X",
    description: null,
    free_shipping: true,
    sort_order: 10,
    image_url: null,
    variant: {
      analytics_item_id: "summer_1x",
      compare_at_price_cents: null,
      currency: "mxn",
      discount_cents: 0,
      effective_price_cents: 45900,
      id: checkoutInput.product_variant_id,
      inventory_variant_id: "physical-variant-1",
      name: "1 Luzela",
      offer_active: false,
      offer_price_cents: null,
      physical_stock_on_hand: 12,
      price_cents: 45900,
      price_per_unit_cents: 45900,
      sku: "LUZ-SUMMER-1X",
      stock_label: "Disponible",
      stock_on_hand: 12,
      units_per_pack: 1,
    },
  },
};

const wholesalePack10Product = {
  product: {
    id: "product-pack-10",
    slug: "luzela-pack-10",
    name: "LUZELA · Pack 10",
    description: "Pack mayorista de 10 piezas Luzela.",
    free_shipping: true,
    sort_order: 40,
    image_url: null,
    variant: {
      analytics_item_id: "luzela_pack_10",
      compare_at_price_cents: null,
      currency: "mxn",
      discount_cents: 0,
      effective_price_cents: 222000,
      id: checkoutInput.product_variant_id,
      inventory_variant_id: "physical-variant-1",
      name: "10 piezas",
      offer_active: false,
      offer_price_cents: null,
      physical_stock_on_hand: 10,
      price_cents: 222000,
      price_per_unit_cents: 22200,
      sku: "LUZ-PACK-10",
      stock_label: "Disponible",
      stock_on_hand: 1,
      units_per_pack: 10,
    },
  },
};

describe("createCheckoutSession idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPaymentProvider.mockReturnValue("mercadopago");
    mocks.getStripe.mockReturnValue(null);
    mocks.getCheckoutProduct.mockResolvedValue(checkoutProduct);
  });

  it("reuses the same checkout attempt without creating another payment row", async () => {
    const supabase = createFakeSupabase();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    const first = await createCheckoutSession(checkoutInput);
    const second = await createCheckoutSession(checkoutInput);

    expect(first).toEqual({
      ok: true,
      url: "http://localhost:3001/checkout/payment?checkout_session=checkout_sessions-1",
    });
    expect(second).toEqual(first);
    expect(supabase.db.checkout_sessions).toHaveLength(1);
    expect(supabase.db.orders).toHaveLength(1);
    expect(supabase.db.payments).toHaveLength(1);
    expect(supabase.db.payments[0].idempotency_key).toBe(
      `payment:${checkoutInput.idempotency_key}`,
    );
  });

  it("uses a new payment idempotency key for a new checkout attempt", async () => {
    const supabase = createFakeSupabase();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    await createCheckoutSession(checkoutInput);
    await createCheckoutSession({
      ...checkoutInput,
      idempotency_key: "33333333-3333-4333-8333-333333333333",
    });

    expect(supabase.db.checkout_sessions).toHaveLength(2);
    expect(supabase.db.payments).toHaveLength(2);
    expect(supabase.db.payments.map((payment) => payment.idempotency_key)).toEqual([
      `payment:${checkoutInput.idempotency_key}`,
      "payment:33333333-3333-4333-8333-333333333333",
    ]);
  });

  it("rejects the same idempotency key with a different logical payload", async () => {
    const supabase = createFakeSupabase();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    await createCheckoutSession(checkoutInput);
    const result = await createCheckoutSession({
      ...checkoutInput,
      quantity: 2,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      error: "idempotency_key_payload_mismatch",
    });
    expect(supabase.db.orders).toHaveLength(1);
    expect(supabase.db.payments).toHaveLength(1);
  });

  it("reuses an existing payment row for the same internal attempt", async () => {
    const supabase = createFakeSupabase({
      payments: [
        {
          amount_cents: 45900,
          currency: "mxn",
          id: "payment-existing",
          idempotency_key: "payment:same-attempt",
          order_id: "order-1",
          provider: "mercadopago",
          status: "requires_payment",
        },
      ],
    });

    const result = await createPaymentAttempt({
      amountCents: 45900,
      currency: "mxn",
      idempotencyKey: "payment:same-attempt",
      orderId: "order-1",
      paymentProvider: "mercadopago",
      supabase: supabase.client as never,
    });

    expect(result).toMatchObject({
      ok: true,
      payment: { id: "payment-existing", order_id: "order-1" },
    });
    expect(supabase.db.payments).toHaveLength(1);
  });

  it("rejects same-key payment collisions for another logical operation", async () => {
    const supabase = createFakeSupabase({
      payments: [
        {
          amount_cents: 45900,
          currency: "mxn",
          id: "payment-existing",
          idempotency_key: "payment:collision",
          order_id: "order-1",
          provider: "mercadopago",
          status: "requires_payment",
        },
      ],
    });

    const result = await createPaymentAttempt({
      amountCents: 69000,
      currency: "mxn",
      idempotencyKey: "payment:collision",
      orderId: "order-2",
      paymentProvider: "mercadopago",
      supabase: supabase.client as never,
    });

    expect(result).toMatchObject({
      ok: false,
      result: {
        status: 409,
        error: "payment_idempotency_collision",
      },
    });
    expect(supabase.db.payments).toHaveLength(1);
  });

  it("creates the Pack 10 order snapshot without changing payment semantics", async () => {
    const supabase = createFakeSupabase();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);
    mocks.getCheckoutProduct.mockResolvedValue(wholesalePack10Product);

    const result = await createCheckoutSession(checkoutInput);

    expect(result).toEqual({
      ok: true,
      url: "http://localhost:3001/checkout/payment?checkout_session=checkout_sessions-1",
    });
    expect(supabase.db.orders[0]).toMatchObject({
      currency: "mxn",
      discount_cents: 0,
      payment_provider: "mercadopago",
      payment_status: "requires_payment",
      shipping_cents: 0,
      subtotal_cents: 222000,
      tax_cents: 0,
      total_cents: 222000,
    });
    expect(supabase.db.orders[0].metadata).toMatchObject({
      pack_quantity: 1,
      units_per_pack: 10,
      physical_units: 10,
      effective_price_cents: 222000,
    });
    expect(supabase.db.order_items[0]).toMatchObject({
      sku: "LUZ-PACK-10",
      quantity: 1,
      units_per_pack: 10,
      physical_units: 10,
      inventory_variant_id: "physical-variant-1",
      unit_price_cents: 222000,
      subtotal_cents: 222000,
    });
    expect(supabase.db.payments[0]).toMatchObject({
      amount_cents: 222000,
      currency: "mxn",
      provider: "mercadopago",
    });
    expect(supabase.db.checkout_sessions[0].metadata).toMatchObject({
      quantity: 1,
      units_per_pack: 10,
      physical_units: 10,
      inventory_variant_id: "physical-variant-1",
    });
  });

  it("blocks Pack 10 checkout when fewer than ten physical units remain", async () => {
    const supabase = createFakeSupabase();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);
    mocks.getCheckoutProduct.mockResolvedValue({
      product: {
        ...wholesalePack10Product.product,
        variant: {
          ...wholesalePack10Product.product.variant,
          physical_stock_on_hand: 9,
          stock_on_hand: 0,
        },
      },
    });

    const result = await createCheckoutSession(checkoutInput);

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      error: "insufficient_stock",
    });
    expect(supabase.db.orders).toHaveLength(0);
    expect(supabase.db.order_items).toHaveLength(0);
    expect(supabase.db.payments).toHaveLength(0);
  });
});


describe('collab checkout integration', () => {
  const coupon = {id:'coupon-1',code:'TEST-COLLAB10',status:'active',discount_type:'percent',percent_off:10,collaborator_id:'collab-1',eligible_variant_ids:[checkoutInput.product_variant_id],minimum_subtotal_cents:0,starts_at:null,ends_at:null,deleted_at:null,max_redemptions:null,per_customer_limit:null,allowed_customer_emails:[]};
  it('freezes the discount and sends the exact discounted amount to the existing payment path', async () => {
    const fake=createFakeSupabase({coupons:[coupon],collaborators:[{id:'collab-1',slug:'chavolines',status:'active',campaign_code:'CHAVOLIN',display_name:'El Mundo en Pareja',brand_name:'LUZELA × CHAVOLINES'}]});
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.getCheckoutProduct.mockResolvedValue(checkoutProduct);
    mocks.getPaymentProvider.mockReturnValue('mercadopago');
    const result=await createCheckoutSession({...checkoutInput,coupon_code:'test-collab10'});
    expect(result.ok).toBe(true);
    expect(fake.db.orders[0]).toMatchObject({subtotal_cents:45900,discount_cents:4590,total_cents:41310,discount_code:'TEST-COLLAB10',discount_type:'percentage',discount_value:10,collaborator_id:'collab-1',subtotal_after_discount_cents:41310,collab_attribution_reason:'coupon'});
    expect(fake.db.payments[0].amount_cents).toBe(41310);
    expect(fake.db.order_items[0]).toMatchObject({quantity:1,physical_units:1,subtotal_cents:45900});
  });
  it('rejects a disabled code before reserving or touching payments',async()=>{
    const fake=createFakeSupabase({coupons:[{...coupon,status:'inactive'}]});mocks.createSupabaseAdminClient.mockReturnValue(fake.client);mocks.getCheckoutProduct.mockResolvedValue(checkoutProduct);mocks.getPaymentProvider.mockReturnValue('mercadopago');
    expect(await createCheckoutSession({...checkoutInput,coupon_code:'TEST-COLLAB10'})).toMatchObject({ok:false,error:'invalid_promo'});
    expect(fake.db.orders).toHaveLength(0);expect(fake.db.payments).toHaveLength(0);expect(fake.db.checkout_sessions).toHaveLength(0);
  });
});


describe("approved pricing and private attribution", () => {
  for (const [units, cents, discounted] of [[1,45900,41310],[2,76900,69210],[3,81900,73710]]) {
    for (const provider of ["mercadopago", "stripe"] as const) {
      for (const withCode of [false,true]) {
        it(`${provider}: ${units}X ${withCode ? "with manual code" : "without code"}`, async () => {
          const coupon = {id:"coupon-1",code:"TEST-COLLAB10",status:"active",discount_type:"percent",percent_off:10,collaborator_id:"collab-1",eligible_variant_ids:[checkoutInput.product_variant_id],minimum_subtotal_cents:0,starts_at:null,ends_at:null,deleted_at:null,max_redemptions:null,per_customer_limit:null,allowed_customer_emails:[]};
          const fake = createFakeSupabase({coupons:[coupon],collaborators:[{id:"collab-1",slug:"chavolines",status:"active",campaign_code:"CHAVOLIN",display_name:"El Mundo en Pareja",brand_name:"LUZELA × CHAVOLINES"}]});
          mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
          mocks.getCheckoutProduct.mockResolvedValue({product:{...checkoutProduct.product,variant:{...checkoutProduct.product.variant,units_per_pack:units,price_cents:cents,effective_price_cents:cents}}});
          mocks.getPaymentProvider.mockReturnValue(provider);
          const createStripe = vi.fn().mockResolvedValue({id:"cs_test_private",url:"https://checkout.stripe.com/test"});
          mocks.getStripe.mockReturnValue({checkout:{sessions:{create:createStripe}}});
          const {captureAttribution} = await import("@/lib/attribution");
          // Even a collaborator referral cannot attribute the order without manual redemption.
          const attribution = captureAttribution(null,{url:"https://www.luzela.mx/?ref=chavolines&utm_source=elmundoenpareja"});
          const result = await createCheckoutSession({...checkoutInput, attribution:JSON.stringify(attribution),coupon_code:withCode ? "test-collab10" : ""});
          expect(result.ok).toBe(true);
          const total=withCode ? discounted : cents;
          expect(fake.db.orders[0]).toMatchObject({subtotal_cents:cents,total_cents:total,discount_cents:cents-total});
          expect(fake.db.payments[0].amount_cents).toBe(total);
          expect(fake.db.order_items[0]).toMatchObject({quantity:1,physical_units:units,subtotal_cents:cents});
          if(withCode) expect(fake.db.orders[0]).toMatchObject({campaign_code:"CHAVOLIN",collab_attribution_reason:"coupon",metadata:{collab:{source:"El Mundo en Pareja",collaborators:"Chava & Nat",code:"TEST-COLLAB10",campaign:"CHAVOLIN"}}});
          else expect(fake.db.orders[0].collaborator_id).toBeUndefined();
          if(provider==="stripe") expect(createStripe.mock.calls[0][0].line_items[0]).toMatchObject({price_data:{unit_amount:total},quantity:1});
        });
      }
    }
  }
});

describe("Summer Drop checkout", () => {
  it("keeps 3X gross at $819, applies $50, and sends $769 to Mercado Pago", async () => {
    const fake = createFakeSupabase();
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.getCheckoutProduct.mockResolvedValue({ product: {
      ...checkoutProduct.product,
      id: "summer-3x-product",
      slug: "summer-3x",
      name: "SUMMER 3X",
      variant: {
        ...checkoutProduct.product.variant,
        sku: "LUZ-SUMMER-3X",
        name: "3 Luzelas",
        price_cents: 81900,
        offer_price_cents: 76900,
        offer_active: true,
        effective_price_cents: 76900,
        discount_cents: 5000,
        physical_stock_on_hand: 30,
        stock_on_hand: 10,
        units_per_pack: 3,
      },
    } });
    mocks.getPaymentProvider.mockReturnValue("mercadopago");

    const result = await createCheckoutSession(checkoutInput);

    expect(result.ok).toBe(true);
    expect(fake.db.orders[0]).toMatchObject({
      subtotal_cents: 81900,
      discount_cents: 5000,
      shipping_cents: 0,
      total_cents: 76900,
      metadata: { campaign: "summer_drop", promotion: {
        name: "SUMMER_DROP", gross_merchandise_cents: 81900,
        discount_amount_cents: 5000, net_merchandise_cents: 76900,
        physical_units: 3,
      } },
    });
    expect(fake.db.order_items[0]).toMatchObject({ quantity: 1, units_per_pack: 3, physical_units: 3, subtotal_cents: 76900 });
    expect(fake.db.payments[0].amount_cents).toBe(76900);
    expect(fake.client.rpc).toHaveBeenCalledWith("claim_summer_drop_allocation", { p_order_id: "orders-1", p_packs: 1 });
  });

  it("does not start payment when the campaign allocation is already claimed", async () => {
    const fake = createFakeSupabase();
    fake.client.rpc.mockResolvedValueOnce({ data: false, error: null });
    mocks.createSupabaseAdminClient.mockReturnValue(fake.client);
    mocks.getCheckoutProduct.mockResolvedValue({ product: {
      ...checkoutProduct.product,
      slug: "summer-3x",
      variant: { ...checkoutProduct.product.variant, sku: "LUZ-SUMMER-3X", units_per_pack: 3, price_cents: 81900, offer_price_cents: 76900, offer_active: true, effective_price_cents: 76900, stock_on_hand: 10, physical_stock_on_hand: 30 },
    } });
    mocks.getPaymentProvider.mockReturnValue("mercadopago");

    const result = await createCheckoutSession(checkoutInput);

    expect(result).toMatchObject({ ok: false, status: 409, error: "summer_drop_unavailable" });
    expect(fake.db.payments).toHaveLength(0);
  });
});
