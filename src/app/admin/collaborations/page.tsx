import { requireAdminSession } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CollabReportView } from "@/components/collab-report";
import type { ReportParams } from "@/lib/collabs/report";
import {
  saveMember,
  setMemberStatus,
  savePromo,
  sendInvitation,
} from "./actions";
export const dynamic = "force-dynamic";
const input =
  "w-full min-w-0 rounded-lg border border-[var(--line)] bg-white p-3";
const button =
  "focus-ring rounded-lg bg-[var(--ink)] px-4 py-3 text-sm text-white disabled:opacity-40";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ReportParams & { notice?: string }>;
}) {
  const session = await requireAdminSession();
  const db = await createSupabaseServerClient();
  const params = await searchParams;
  const write = ["owner", "admin"].includes(session.admin.role);
  const { data: collabs, error } = await db!
    .from("collaborators")
    .select("*")
    .order("created_at");
  if (error || !collabs?.length)
    return (
      <main className="p-8">
        <h2>Colaboraciones</h2>
        <p className="mt-5">
          El módulo todavía no está disponible en esta base de datos.
        </p>
      </main>
    );
  const collab =
    collabs.find((c) => c.id === params.collaborator) || collabs[0];
  const [
    { data: members },
    { data: promo },
    { data: variants },
    { data: audit },
    { count: usage },
  ] = await Promise.all([
    db!
      .from("collaborator_members")
      .select("*")
      .eq("collaborator_id", collab.id)
      .order("created_at"),
    db!
      .from("coupons")
      .select("*")
      .eq("collaborator_id", collab.id)
      .maybeSingle(),
    db!
      .from("product_variants")
      .select("id,name,offer_active,metadata,products(name)")
      .eq("status", "active"),
    db!
      .from("audit_log")
      .select("id,action,table_name,created_at")
      .like("action", "collab_%")
      .order("created_at", { ascending: false })
      .limit(20),
    db!
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("collaborator_id", collab.id)
      .not("coupon_id", "is", null),
  ]);
  return (
    <main className="p-4 sm:p-8">
      <p className="text-xs tracking-[.2em] text-[var(--teal)]">
        COLABORACIONES
      </p>
      <h2 className="mt-3 text-3xl font-semibold">{collab.display_name}</h2>
      <p className="mt-3">
        {collab.status.toUpperCase()} · {promo?.code || "Sin código"} ·{" "}
        {promo?.percent_off || 0}% ·{" "}
        {members?.filter((m) => m.status === "active").length || 0} miembros
        activos
      </p>
      {collabs.length > 1 ? (
        <form className="mt-4">
          <select
            name="collaborator"
            defaultValue={collab.id}
            className={input}
          >
            {collabs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
          <button className={button}>Ver colaboración</button>
        </form>
      ) : null}
      {params.notice ? (
        <p
          role="status"
          className="mt-5 rounded-lg border border-[var(--line)] bg-white p-4"
        >
          {params.notice}
        </p>
      ) : null}
      <CollabReportView target={collab.id} params={params} admin />
      <div className="mt-10 grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-[var(--line)] bg-white p-5">
          <h3 className="text-xl font-semibold">Acceso de colaboradores</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Autoriza el correo exacto que usarán en Google. Viewer y manager
            sólo consultan ventas en V1.
          </p>
          <form action={saveMember} className="mt-5 grid gap-3">
            <input type="hidden" name="collaborator_id" value={collab.id} />
            <label>
              Nombre
              <input
                className={input}
                name="display_name"
                required
                maxLength={100}
                disabled={!write}
              />
            </label>
            <label>
              Correo de Google
              <input
                className={input}
                type="email"
                name="email"
                required
                disabled={!write}
              />
            </label>
            <label>
              Rol
              <select
                className={input}
                name="role"
                defaultValue="viewer"
                disabled={!write}
              >
                <option value="viewer">Viewer</option>
                <option value="manager">Manager</option>
              </select>
            </label>
            <button className={button} disabled={!write}>
              Agregar colaborador
            </button>
          </form>
          <div className="mt-6 grid gap-4">
            {members?.map((m) => (
              <article
                key={m.id}
                className="border-t border-[var(--line)] pt-4"
              >
                <p className="font-semibold">{m.display_name}</p>
                <p className="break-all text-sm">
                  {m.email} · {m.role} · {m.status}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {m.accepted_at
                    ? "Acceso aceptado"
                    : "Pendiente de primer acceso"}{" "}
                  ·{" "}
                  {m.invited_at
                    ? "Invitación enviada"
                    : "Sin invitación enviada"}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <form action={sendInvitation}>
                    <input type="hidden" name="id" value={m.id} />
                    <button
                      className={button}
                      disabled={!write || m.status !== "active"}
                    >
                      Enviar invitación
                    </button>
                  </form>
                  <form action={setMemberStatus}>
                    <input type="hidden" name="id" value={m.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={m.status === "active" ? "revoked" : "active"}
                    />
                    <button
                      className="focus-ring p-3 text-sm underline"
                      disabled={!write}
                    >
                      {m.status === "active"
                        ? "Revocar acceso"
                        : "Reactivar acceso"}
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-[var(--line)] bg-white p-5">
          <h3 className="text-xl font-semibold">Promoción · {promo?.code}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {usage || 0} pedidos creados con cupón, incluidos intentos sin pago.
            Los ingresos del reporte sólo incluyen ventas pagadas. Comisión y
            pagos automáticos: desactivados.
          </p>
          {promo ? (
            <form action={savePromo} className="mt-5 grid gap-4">
              <input type="hidden" name="id" value={promo.id} />
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={promo.status === "active"}
                  disabled={!write}
                />
                Cupón activo
              </label>
              <label>
                Inicio · Cancún
                <input
                  type="date"
                  name="starts_at"
                  className={input}
                  defaultValue={promo.starts_at?.slice(0, 10)}
                  disabled={!write}
                />
              </label>
              <label>
                Fin exclusivo · Cancún
                <input
                  type="date"
                  name="ends_at"
                  className={input}
                  defaultValue={promo.ends_at?.slice(0, 10)}
                  disabled={!write}
                />
              </label>
              <fieldset>
                <legend className="mb-3 font-semibold">
                  Productos elegibles
                </legend>
                {variants?.map((v) => {
                  const excluded =
                    Number(v.metadata?.units_per_pack) >= 10 ||
                    v.metadata?.campaign === "wholesale" ||
                    v.offer_active;
                  return (
                    <label
                      key={v.id}
                      className="mb-3 flex items-start gap-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="eligible_variant_ids"
                        value={v.id}
                        defaultChecked={
                          promo.eligible_variant_ids.includes(v.id) && !excluded
                        }
                        disabled={!write || excluded}
                      />
                      {(Array.isArray(v.products) ? v.products[0] : v.products)
                        ?.name || v.name}
                      {excluded ? " · Excluido: oferta o mayoreo" : ""}
                    </label>
                  );
                })}
              </fieldset>
              <p className="text-xs text-[var(--muted)]">
                10% sobre mercancía, sin descontar envío ni acumular ofertas.
                Los pedidos anteriores conservan su descuento.
              </p>
              <button className={button} disabled={!write}>
                Guardar promoción
              </button>
            </form>
          ) : null}
        </section>
      </div>
      <section className="mt-8 rounded-xl border border-[var(--line)] bg-white p-5">
        <h3 className="font-semibold">Auditoría reciente · colaboraciones</h3>
        {audit?.map((a) => (
          <p key={a.id} className="mt-3 text-sm">
            {new Date(a.created_at).toLocaleString("es-MX", {
              timeZone: "America/Cancun",
            })}{" "}
            · {a.action} · {a.table_name}
          </p>
        ))}
      </section>
    </main>
  );
}
