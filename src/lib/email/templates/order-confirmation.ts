import { formatMoney } from "@/lib/money";

import {
  escapeHtml,
  formatEmailDate,
  renderEmailLayout,
  renderInfoBlock,
  type EmailRenderResult,
} from "./shared";

export type OrderConfirmationEmailData = {
  orderNumber: string;
  createdAt: string;
  firstName?: string | null;
  totalCents: number;
  discountCents?: number;
  discountCode?: string | null;
  discountLabel?: string | null;
  discountPercent?: number | null;
  subtotalCents: number;
  shippingCents: number;
  currency: string;
  carrierDisplayName: string;
  items: Array<{
    name: string;
    quantity: number;
    unitsPerPack: number;
    physicalUnits: number;
    unitPriceCents: number;
    subtotalCents: number;
  }>;
  shippingAddress?: {
    fullName?: string | null;
    line1?: string | null;
    line2?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
};

export function renderOrderConfirmationEmail(data: OrderConfirmationEmailData): EmailRenderResult {
  const firstName = data.firstName || "cliente";
  const itemsText = data.items
    .map(
      (item) =>
        `${item.name} - ${item.physicalUnits} Luzela${item.physicalUnits === 1 ? "" : "s"} - ${formatMoney(
          item.subtotalCents,
          data.currency,
        )}`,
    )
    .join("\n");
  const addressLines = [
    data.shippingAddress?.fullName,
    data.shippingAddress?.line1,
    data.shippingAddress?.line2,
    data.shippingAddress?.neighborhood,
    [data.shippingAddress?.city, data.shippingAddress?.state, data.shippingAddress?.postalCode]
      .filter(Boolean)
      .join(", "),
    data.shippingAddress?.country,
  ].filter(Boolean) as string[];
  const body = `
    <p style="margin:22px 0 0;font-size:15px;line-height:1.75;color:#171310;">Hola ${escapeHtml(firstName)},</p>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.75;color:#171310;">Recibimos tu pedido y tu pago fue confirmado correctamente.</p>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.75;color:#171310;">Estamos preparando tu Luzela para enviarla lo antes posible.</p>
    ${renderInfoBlock("Pedido", [
      { label: "Número", value: `#${data.orderNumber}` },
      { label: "Fecha", value: formatEmailDate(data.createdAt) },
    ])}
    <div style="margin:24px 0;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;font-weight:700;">Items</p>
      ${data.items
        .map(
          (item) => `
            <div style="padding:14px 0;border-top:1px solid #e7ded2;">
              <p style="margin:0;font-size:15px;line-height:1.5;color:#171310;font-weight:700;">${escapeHtml(item.name)}</p>
              <p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:#716a63;">${item.quantity} pack · ${item.physicalUnits >= 10 ? `Incluye: ${item.physicalUnits} piezas` : `${item.physicalUnits} Luzela${item.physicalUnits === 1 ? "" : "s"}`} · ${formatMoney(item.unitPriceCents, data.currency)} por pack</p>
              <p style="margin:6px 0 0;font-size:15px;color:#171310;font-weight:700;">${formatMoney(item.subtotalCents, data.currency)}</p>
            </div>
          `,
        )
        .join("")}
    </div>
    <div style="margin:24px 0;padding:18px;background:#ffffff;border:1px solid #e7ded2;">
      <div style="display:flex;justify-content:space-between;gap:18px;font-size:14px;color:#716a63;">
        <span>Subtotal</span><strong style="color:#171310;">${formatMoney(data.subtotalCents, data.currency)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;gap:18px;margin-top:10px;font-size:14px;color:#716a63;">
        ${data.discountCents ? `<span>${escapeHtml(data.discountLabel || `Beneficio ${data.discountCode || ""}${data.discountPercent ? ` (${data.discountPercent}%)` : ""}`)}</span><strong>−${formatMoney(data.discountCents,data.currency)}</strong></div><div style="display:flex;justify-content:space-between;margin-top:10px">` : ''}
        <span>Envío</span><strong style="color:#171310;">${data.shippingCents ? formatMoney(data.shippingCents, data.currency) : "Incluido"}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;gap:18px;margin-top:14px;padding-top:14px;border-top:1px solid #e7ded2;font-size:16px;color:#171310;">
        <span style="font-weight:700;">Total</span><strong>${formatMoney(data.totalCents, data.currency)}</strong>
      </div>
    </div>
    ${
      addressLines.length
        ? renderInfoBlock("Dirección de entrega", [
            { label: "Enviar a", value: addressLines.join("\n") },
          ])
        : ""
    }
    <p style="margin:18px 0 0;font-size:14px;line-height:1.75;color:#716a63;">Cuando tu pedido salga, te enviaremos otro correo con tu guía ${escapeHtml(data.carrierDisplayName)} para que puedas rastrearlo.</p>
  `;

  return {
    html: renderEmailLayout({
      preview: "Recibimos tu pedido y tu pago fue confirmado correctamente.",
      title: "Gracias por tu compra",
      body,
    }),
    text: [
      "LUZELA",
      "",
      `Hola ${firstName},`,
      "Recibimos tu pedido y tu pago fue confirmado correctamente.",
      "Estamos preparando tu Luzela para enviarla lo antes posible.",
      "",
      `Pedido: #${data.orderNumber}`,
      `Fecha: ${formatEmailDate(data.createdAt)}`,
      "",
      "Items:",
      itemsText,
      "",
      `Subtotal: ${formatMoney(data.subtotalCents, data.currency)}`,
      data.discountCents ? `${data.discountLabel || `Beneficio ${data.discountCode || ""}${data.discountPercent ? ` (${data.discountPercent}%)` : ""}`}: −${formatMoney(data.discountCents,data.currency)}` : "",
      `Envío: ${data.shippingCents ? formatMoney(data.shippingCents, data.currency) : "Incluido"}`,
      `Total: ${formatMoney(data.totalCents, data.currency)}`,
      "",
      addressLines.length ? `Dirección de entrega:\n${addressLines.join("\n")}` : "",
      "",
      `Cuando tu pedido salga, te enviaremos otro correo con tu guía ${data.carrierDisplayName} para que puedas rastrearlo.`,
      "luzela.mx",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
