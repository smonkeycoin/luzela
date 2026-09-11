"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { requireAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEmailSettings } from "@/lib/settings";
import { renderEmailLayout, escapeHtml } from "@/lib/email/templates/shared";
async function adminDb() {
  const session = await requireAdminSession();
  if (!["owner", "admin"].includes(session.admin.role))
    throw new Error("Acceso de administrador requerido.");
  const db = await createSupabaseServerClient();
  if (!db) throw new Error("Sesión no disponible.");
  return { db, session };
}
function done(message: string): never {
  revalidatePath("/admin/collaborations");
  revalidatePath("/chavolines");
  redirect(`/admin/collaborations?notice=${encodeURIComponent(message)}`);
}
export async function saveMember(form: FormData) {
  const { db } = await adminDb();
  const parsed = z
    .object({
      collaborator_id: z.uuid(),
      display_name: z.string().trim().min(2).max(100),
      email: z.email().transform((v) => v.toLowerCase().trim()),
      role: z.enum(["viewer", "manager"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) done("Revisa nombre, correo y rol.");
  const { error } = await db
    .from("collaborator_members")
    .insert({ ...parsed.data, status: "active" });
  done(
    error
      ? "No se pudo agregar. Comprueba si el correo ya está autorizado."
      : "Correo autorizado. Ya puedes enviar la invitación.",
  );
}
export async function setMemberStatus(form: FormData) {
  const { db } = await adminDb();
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(["active", "revoked"]) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) done("Datos inválidos.");
  const { data, error } = await db
    .from("collaborator_members")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("id")
    .single();
  done(
    error || !data ? "No se pudo cambiar el acceso." : "Acceso actualizado.",
  );
}
export async function savePromo(form: FormData) {
  const { db } = await adminDb();
  const id = z.uuid().safeParse(form.get("id"));
  const variants = z
    .array(z.uuid())
    .safeParse(form.getAll("eligible_variant_ids"));
  if (!id.success || !variants.success) done("Datos inválidos.");
  const date = (v: FormDataEntryValue | null) =>
    v ? new Date(String(v) + "T00:00:00-05:00") : null;
  const starts = date(form.get("starts_at")),
    ends = date(form.get("ends_at"));
  if (
    (starts && !Number.isFinite(starts.getTime())) ||
    (ends && !Number.isFinite(ends.getTime())) ||
    (starts && ends && starts >= ends)
  )
    done("Revisa las fechas de vigencia.");
  const { error } = await db
    .from("coupons")
    .update({
      status: form.get("active") === "on" ? "active" : "inactive",
      starts_at: starts?.toISOString() || null,
      ends_at: ends?.toISOString() || null,
      eligible_variant_ids: variants.data,
    })
    .eq("id", id.data);
  done(
    error
      ? "No se pudo guardar el cupón."
      : "Cupón actualizado para compras futuras.",
  );
}
export async function sendInvitation(form: FormData) {
  const { db, session } = await adminDb();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) done("Miembro inválido.");
  const { data: member } = await db
    .from("collaborator_members")
    .select("id,display_name,email,status,collaborator_id,invited_at")
    .eq("id", id.data)
    .single();
  if (!member || member.status !== "active")
    done("Autoriza el correo antes de invitar.");
  if (
    member.invited_at &&
    Date.now() - new Date(member.invited_at).getTime() < 60000
  )
    done("La invitación se envió recientemente. Espera un minuto.");
  const settings = await getEmailSettings();
  if (!settings.transactionalEmailsEnabled || !process.env.RESEND_API_KEY)
    done("El envío de correo no está configurado o está desactivado.");
  const { data: collab } = await db
    .from("collaborators")
    .select("brand_name")
    .eq("id", member.collaborator_id)
    .single();
  const brand = collab?.brand_name || "LUZELA";
  const url = "https://www.luzela.mx/collab/login";
  const html = renderEmailLayout({
    preview: `Tu acceso a ${brand}`,
    title: brand,
    body: `<p>Hola ${escapeHtml(member.display_name)},</p><p>Ya puedes consultar el desempeño de ${escapeHtml(brand)}.</p><p>Entra con la cuenta de Google asociada a este correo.</p><p style="margin:30px 0"><a href="${url}" style="background:#173f3a;color:white;padding:16px 24px;text-decoration:none">VER MI PANEL</a></p>`,
  });
  const eventKey = `collab_invitation:${member.id}:${Math.floor(Date.now() / 60000)}`;
  const { data: event, error: eventError } = await db
    .from("email_events")
    .insert({
      template_key: "collab_invitation",
      event_type: "COLLAB_INVITATION",
      recipient: member.email,
      status: "pending",
      provider: "resend",
      idempotency_key: eventKey,
      payload: {
        collaborator_id: member.collaborator_id,
        member_id: member.id,
      },
    })
    .select("id")
    .single();
  if (eventError || !event) done("No se pudo registrar la invitación.");
  let sent = false;
  try {
    const response = await new Resend(process.env.RESEND_API_KEY).emails.send(
      {
        from: settings.from,
        to: member.email,
        subject: `Tu acceso a ${brand}`,
        html,
        text: `Hola ${member.display_name},\nYa puedes consultar el desempeño de ${brand}.\nEntra con la cuenta de Google asociada a este correo.\nVER MI PANEL: ${url}`,
        replyTo: settings.replyTo || undefined,
      },
      { idempotencyKey: eventKey },
    );
    if (response.error) throw new Error("send_failed");
    const { error: logError } = await db
      .from("email_events")
      .update({
        status: "sent",
        provider_message_id: response.data?.id,
        sent_at: new Date().toISOString(),
        attempt_count: 1,
      })
      .eq("id", event.id);
    if (logError) throw new Error("log_failed");
    sent = true;
  } catch {
    await db
      .from("email_events")
      .update({
        status: "failed",
        error_code: "invitation_failed",
        attempt_count: 1,
      })
      .eq("id", event.id);
  }
  if (sent) {
    await db
      .from("collaborator_members")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", member.id);
    await db
      .from("audit_log")
      .insert({
        actor_user_id: session.user.id,
        action: "collab_invitation_sent",
        table_name: "collaborator_members",
        row_id: member.id,
        after_data: { email_event_id: event.id },
      });
  }
  done(
    sent
      ? "Invitación enviada."
      : "No pudimos completar el envío. Revisa el registro antes de reintentar.",
  );
}
