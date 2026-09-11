import Link from "next/link";
import { requireCollabSession } from "@/lib/collabs/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CollabReportView } from "@/components/collab-report";
import { CollabShareTools } from "@/components/collab-share-tools";
import type { ReportParams } from "@/lib/collabs/report";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mi colaboración | LUZELA",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ReportParams>;
}) {
  const session = await requireCollabSession();
  const params = await searchParams;
  const collab =
    session.collaborators.find((c) => c.id === params.collaborator) ||
    session.collaborators[0];
  // Membership was checked above. Only return this member's private campaign codes.
  const couponDb = createSupabaseAdminClient();
  const { data: coupons } = couponDb
    ? await couponDb.from("coupons").select("id,code,percent_off")
        .eq("collaborator_id", collab.id).eq("status", "active").is("deleted_at", null)
    : { data: [] };
  const coupon = coupons?.[0];
  const campaignUrl = "https://www.luzela.mx/?ref=chavolines";
  const utmUrl = `${campaignUrl}&utm_source=elmundoenpareja&utm_medium=creator&utm_campaign=chavolin`;
  return (
    <main className="min-h-screen bg-[#f7f6f1] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
          <Link href="/" className="text-xl font-semibold tracking-[.15em]">
            LUZELA
          </Link>
          <Link
            href="/auth/logout?next=collab"
            prefetch={false}
            className="text-sm underline"
          >
            Cerrar sesión
          </Link>
        </header>
        <p className="mt-10 text-xs font-semibold tracking-[.2em] text-[var(--teal)]">
          HOLA 👋
        </p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">
          {collab.brand_name}
        </h1>
        <p className="mt-4 inline-flex rounded-full border border-[var(--teal)]/25 bg-white px-4 py-2 text-sm font-semibold text-[var(--teal)]">
          CAMPAÑA ACTIVA
        </p>
        <Link
          href="/#tienda"
          className="mt-4 inline-block text-sm underline"
        >
          Ver tienda
        </Link>
        {session.collaborators.length > 1 ? (
          <nav className="mt-5 flex gap-4">
            {session.collaborators.map((c) => (
              <Link key={c.id} href={`/collab?collaborator=${c.id}`}>
                {c.display_name}
              </Link>
            ))}
          </nav>
        ) : null}
        {coupon ? (
          <CollabShareTools
            campaignUrl={campaignUrl}
            code={coupon.code}
            discount={coupon.percent_off}
            utmUrl={utmUrl}
          />
        ) : null}
        <CollabReportView target={collab.id} params={params} />
      </div>
    </main>
  );
}
