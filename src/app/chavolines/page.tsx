import { redirect } from "next/navigation";

// Keep the retired campaign page's storefront redirect while preserving attribution.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const input = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref", "funnel_qa"]) {
    const value = input[key];
    if (typeof value === "string" && value.length <= 160 && !/[<>@]/.test(value)) params.set(key, value);
  }
  if (!params.has("ref")) params.set("ref", "chavolines");
  if (!params.has("utm_campaign")) params.set("utm_campaign", "luzela_x_chavolines");
  redirect(`/?${params.toString()}#tienda`);
}
