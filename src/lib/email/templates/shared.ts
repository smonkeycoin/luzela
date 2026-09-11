export type EmailRenderResult = {
  html: string;
  text: string;
};

export function escapeHtml(value: string | null | undefined) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatEmailDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function renderEmailLayout({
  preview,
  title,
  body,
}: {
  preview: string;
  title: string;
  body: string;
}) {
  return `
    <div style="margin:0;background:#faf7f1;padding:28px 14px;font-family:Montserrat,Arial,sans-serif;color:#171310;">
      <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">
        ${escapeHtml(preview)}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border-collapse:collapse;background:#fffdf8;border:1px solid #e7ded2;">
              <tr>
                <td style="padding:32px 28px 18px;">
                  <p style="margin:0 0 26px;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#0f766e;font-weight:700;">LUZELA</p>
                  <h1 style="margin:0;font-size:30px;line-height:1.15;font-weight:700;color:#171310;">${escapeHtml(title)}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px 34px;">
                  ${body}
                  <div style="margin-top:32px;padding-top:18px;border-top:1px solid #e7ded2;color:#716a63;font-size:12px;line-height:1.7;">
                    <p style="margin:0 0 4px;font-weight:700;color:#171310;">Luzela</p>
                    <p style="margin:0;">Protección solar mineral hecha en México.</p>
                    <p style="margin:8px 0 0;"><a href="https://luzela.mx" style="color:#0f766e;text-decoration:none;font-weight:700;">luzela.mx</a></p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export function renderInfoBlock(title: string, rows: Array<{ label: string; value: string }>) {
  return `
    <div style="margin:24px 0;padding:18px;border:1px solid #e7ded2;background:#ffffff;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#0f766e;font-weight:700;">${escapeHtml(title)}</p>
      ${rows
        .map(
          (row) => `
            <div style="padding:7px 0;border-top:1px solid #f1e9df;">
              <p style="margin:0;font-size:12px;color:#716a63;">${escapeHtml(row.label)}</p>
              <p style="margin:2px 0 0;font-size:15px;line-height:1.5;color:#171310;font-weight:700;">${escapeHtml(row.value)}</p>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}
