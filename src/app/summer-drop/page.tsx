import { redirect } from "next/navigation";

export default async function SummerDropPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["ref", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const value = query[key];
    if (typeof value === "string" && value.length <= 160) params.set(key, value);
  }
  if (!params.has("ref")) params.set("ref", "summerdrop");
  if (!params.has("utm_campaign")) params.set("utm_campaign", "summer_drop");
  redirect(`/?${params.toString()}#summer-drop`);
}
