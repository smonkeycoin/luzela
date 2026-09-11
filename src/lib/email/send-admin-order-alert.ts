import { formatMoney } from "@/lib/money";
import {
  EMAIL_EVENT_TYPES,
  sendTransactionalEmail,
  type TransactionalEmailResult,
} from "@/lib/email/transactional";
import {
  escapeHtml,
  formatEmailDate,
  renderEmailLayout,
  renderInfoBlock,
} from "@/lib/email/templates/shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminOrderAlertInput = {
  orderId: string;
};

type AdminOrderAlertResult = {
  sent: number;
  failed: number;
  skipped: number;
  reason?: string;
  results: TransactionalEmailResult[];
};

type AdminRecipientRow = {
  email: string;
  role: string;
};

type AdminAlertOrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  paid_at: string | null;
  metadata?: {collab?: {name?:string;code?:string;reason?:string}};
  total_cents: number;
  currency: string;
  customer_id: string | null;
  customers:
    | {
        email: string | null;
        phone: string | null;
        first_name: string | null;
        last_name: string | null;
      }
    | {
        email: string | null;
        phone: string | null;
        first_name: string | null;
        last_name: string | null;
      }[]
    | null;
  customer_addresses:
    | {
        full_name: string | null;
        phone: string | null;
        line1: string | null;
        line2: string | null;
        neighborhood: string | null;
        city: string | null;
        state: string | null;
        postal_code: string | null;
        country: string | null;
      }
    | {
        full_name: string | null;
        phone: string | null;
        line1: string | null;
        line2: string | null;
        neighborhood: string | null;
        city: string | null;
        state: string | null;
        postal_code: string | null;
        country: string | null;
      }[]
    | null;
  order_items:
    | Array<{
        name: string;
        sku: string;
        quantity: number;
        units_per_pack: number | null;
        physical_units: number | null;
        subtotal_cents: number;
      }>
    | null;
};

export async function sendAdminOrderAlertEmail({
  orderId,
}: AdminOrderAlertInput): Promise<AdminOrderAlertResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return emptyResult("supabase_not_configured");
  }

  const [{ data: orderData }, { data: recipientData }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, created_at, paid_at, metadata, total_cents, currency, customer_id, customers(email, phone, first_name, last_name), customer_addresses(full_name, phone, line1, line2, neighborhood, city, state, postal_code, country), order_items(name, sku, quantity, units_per_pack, physical_units, subtotal_cents)",
      )
      .eq("id", orderId)
      .maybeSingle(),
    supabase
      .from("admin_users")
      .select("email, role")
      .eq("active", true)
      .in("role", ["owner", "admin", "operations"]),
  ]);

  const order = orderData as AdminAlertOrderRow | null;
  const recipients = dedupeRecipients((recipientData || []) as AdminRecipientRow[]);

  if (!order) {
    return emptyResult("order_missing");
  }

  if (!recipients.length) {
    return emptyResult("admin_recipients_missing");
  }

  const rendered = renderAdminOrderAlert(order);
  const results = await Promise.all(
    recipients.map((recipient) =>
      sendTransactionalEmail({
        eventType: EMAIL_EVENT_TYPES.ADMIN_ORDER_ALERT,
        orderId: order.id,
        customerId: order.customer_id,
        recipient: recipient.email,
        subject: `Nueva orden pagada Luzela ${order.order_number}`,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: `admin_order_alert:${order.id}:${recipient.email.toLowerCase()}`,
        payload: {
          order_number: order.order_number,
          total_cents: order.total_cents,
          currency: order.currency,
          recipient_role: recipient.role,
          item_count: order.order_items?.length || 0,
        },
      }),
    ),
  );

  return {
    sent: results.filter((result) => result.sent).length,
    failed: results.filter((result) => result.failed).length,
    skipped: results.filter((result) => result.skipped).length,
    results,
  };
}

function emptyResult(reason: string): AdminOrderAlertResult {
  return {
    sent: 0,
    failed: 0,
    skipped: 0,
    reason,
    results: [],
  };
}

function dedupeRecipients(recipients: AdminRecipientRow[]) {
  const byEmail = new Map<string, AdminRecipientRow>();

  for (const recipient of recipients) {
    const email = recipient.email?.trim().toLowerCase();

    if (email && !byEmail.has(email)) {
      byEmail.set(email, { ...recipient, email });
    }
  }

  return Array.from(byEmail.values());
}

function renderAdminOrderAlert(order: AdminAlertOrderRow) {
  const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const address = Array.isArray(order.customer_addresses)
    ? order.customer_addresses[0]
    : order.customer_addresses;
  const items = order.order_items || [];
  const totalPhysicalUnits = items.reduce(
    (total, item) =>
      total +
      Number(item.physical_units || Number(item.quantity || 0) * Number(item.units_per_pack || 1)),
    0,
  );
  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");
  const addressLines = [
    address?.full_name,
    address?.line1,
    address?.line2,
    address?.neighborhood,
    [address?.city, address?.state, address?.postal_code].filter(Boolean).join(", "),
    address?.country,
  ].filter(Boolean);
  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-top:1px solid #f1e9df;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#171310;">${escapeHtml(item.name)}</p>
            <p style="margin:3px 0 0;font-size:12px;color:#716a63;">${escapeHtml(item.sku)}</p>
          </td>
          <td align="right" style="padding:10px 0;border-top:1px solid #f1e9df;font-size:14px;color:#171310;">
            ${Number(item.quantity || 0)} pack · ${Number(item.physical_units || 0)} piezas
          </td>
          <td align="right" style="padding:10px 0;border-top:1px solid #f1e9df;font-size:14px;font-weight:700;color:#171310;">
            ${escapeHtml(formatMoney(Number(item.subtotal_cents || 0), order.currency))}
          </td>
        </tr>
      `,
    )
    .join("");
  const body = `
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#171310;">
      Mercado Pago confirmó una orden pagada. Revisa preparación, inventario y envío en admin.
    </p>
    ${renderInfoBlock("Orden", [
      { label: "Número", value: order.order_number },
      { label: "Total", value: formatMoney(Number(order.total_cents || 0), order.currency) },
      { label: "Pagada", value: formatEmailDate(order.paid_at || order.created_at) },
      { label: "Piezas físicas", value: String(totalPhysicalUnits) },
    ])}
    ${order.metadata?.collab ? renderInfoBlock("Atribución", [{label:"Colaboración",value:order.metadata.collab.name || ""},{label:"Código",value:order.metadata.collab.code || "Sin cupón"},{label:"Origen",value:order.metadata.collab.reason || ""}]) : ""}
    ${renderInfoBlock("Cliente", [
      { label: "Nombre", value: customerName || address?.full_name || "-" },
      { label: "Email", value: customer?.email || "-" },
      { label: "Teléfono", value: customer?.phone || address?.phone || "-" },
      { label: "Dirección", value: addressLines.join(" · ") || "-" },
    ])}
    <div style="margin:24px 0;padding:18px;border:1px solid #e7ded2;background:#ffffff;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;font-weight:700;">Productos</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${itemRows}
      </table>
    </div>
  `;
  const text = [
    `Nueva orden pagada Luzela ${order.order_number}`,
    `Total: ${formatMoney(Number(order.total_cents || 0), order.currency)}`,
    `Pagada: ${formatEmailDate(order.paid_at || order.created_at)}`,
    ...(order.metadata?.collab ? [`Atribución: ${order.metadata.collab.name}`, `Código: ${order.metadata.collab.code || "Sin cupón"}`] : []),
    `Cliente: ${customerName || address?.full_name || "-"}`,
    `Email: ${customer?.email || "-"}`,
    `Telefono: ${customer?.phone || address?.phone || "-"}`,
    `Direccion: ${addressLines.join(" · ") || "-"}`,
    "Productos:",
    ...items.map(
      (item) =>
        `- ${item.name} (${item.sku}) · ${Number(item.quantity || 0)} pack · ${Number(item.physical_units || 0)} piezas · ${formatMoney(Number(item.subtotal_cents || 0), order.currency)}`,
    ),
  ].join("\n");

  return {
    html: renderEmailLayout({
      preview: `Nueva orden pagada ${order.order_number}`,
      title: "Nueva orden pagada",
      body,
    }),
    text,
  };
}
