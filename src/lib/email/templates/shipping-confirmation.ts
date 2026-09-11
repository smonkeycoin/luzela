import { escapeHtml, renderEmailLayout, renderInfoBlock, type EmailRenderResult } from "./shared";

export type ShippingConfirmationEmailData = {
  orderNumber: string;
  firstName?: string | null;
  carrier: string;
  minDays: number;
  maxDays: number;
  businessDays: boolean;
  trackingNumber: string;
  trackingUrl: string;
  items: Array<{
    name: string;
    physicalUnits: number;
  }>;
};

export function renderShippingConfirmationEmail(
  data: ShippingConfirmationEmailData,
): EmailRenderResult {
  const firstName = data.firstName || "cliente";
  const itemsSummary = data.items
    .map(
      (item) =>
        `${item.name} - ${item.physicalUnits} Luzela${item.physicalUnits === 1 ? "" : "s"}`,
    )
    .join("\n");
  const deliveryWindow = `${data.minDays} a ${data.maxDays} ${
    data.businessDays ? "días hábiles" : "días"
  }`;
  const body = `
    <p style="margin:22px 0 0;font-size:15px;line-height:1.75;color:#171310;">Hola ${escapeHtml(firstName)},</p>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.75;color:#171310;">Tu pedido ya salió y va rumbo a ti.</p>
    ${renderInfoBlock("Pedido", [{ label: "Número", value: `#${data.orderNumber}` }])}
    <div style="margin:24px 0;padding:18px;border:1px solid #e7ded2;background:#ffffff;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;font-weight:700;">Shipping</p>
      <p style="margin:0 0 6px;font-size:12px;color:#716a63;">Carrier</p>
      <p style="margin:0 0 14px;font-size:15px;color:#171310;font-weight:700;">${escapeHtml(data.carrier)}</p>
      <p style="margin:0 0 6px;font-size:12px;color:#716a63;">Guía</p>
      <p style="margin:0;font-size:22px;letter-spacing:0.03em;color:#171310;font-weight:700;">${escapeHtml(data.trackingNumber)}</p>
    </div>
    <a href="${escapeHtml(data.trackingUrl)}" style="display:inline-block;margin:0 0 24px;background:#0f766e;color:#ffffff;text-decoration:none;padding:14px 20px;font-size:14px;font-weight:700;">Rastrear mi pedido</a>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.75;color:#716a63;">El tiempo estimado de entrega es de ${escapeHtml(deliveryWindow)}, dependiendo del destino.</p>
    ${
      data.items.length
        ? renderInfoBlock(
            "Resumen",
            data.items.map((item) => ({
              label: item.name,
              value: `${item.physicalUnits} Luzela${item.physicalUnits === 1 ? "" : "s"}`,
            })),
          )
        : ""
    }
    <p style="margin:18px 0 0;font-size:14px;line-height:1.75;color:#171310;">Gracias por elegir Luzela.</p>
  `;

  return {
    html: renderEmailLayout({
      preview: "Tu pedido Luzela ya salió y va rumbo a ti.",
      title: "Ya va en camino",
      body,
    }),
    text: [
      "LUZELA",
      "",
      `Hola ${firstName},`,
      "Tu pedido ya salió y va rumbo a ti.",
      "",
      `Pedido: #${data.orderNumber}`,
      `Carrier: ${data.carrier}`,
      `Guía: ${data.trackingNumber}`,
      `Tracking: ${data.trackingUrl}`,
      "",
      `El tiempo estimado de entrega es de ${deliveryWindow}, dependiendo del destino.`,
      "",
      itemsSummary ? `Resumen:\n${itemsSummary}` : "",
      "",
      "Gracias por elegir Luzela.",
      "luzela.mx",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
