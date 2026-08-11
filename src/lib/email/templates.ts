export const emailTemplateKeys = [
  "order_received",
  "payment_confirmed",
  "order_shipped",
  "order_delivered",
] as const;

export type EmailTemplateKey = (typeof emailTemplateKeys)[number];

export function getEmailSubject(template: EmailTemplateKey) {
  const subjects: Record<EmailTemplateKey, string> = {
    order_received: "Recibimos tu orden Luzela",
    payment_confirmed: "Tu pago Luzela fue confirmado",
    order_shipped: "Tu Luzela va en camino",
    order_delivered: "Tu pedido Luzela fue entregado",
  };

  return subjects[template];
}
