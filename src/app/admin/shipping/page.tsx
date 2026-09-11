import { getAdminShipping } from "@/lib/admin/queries";

import { ShippingOperationsCenter } from "./shipping-operations-center";

export default async function AdminShippingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const value = (key: string) => {
    const current = query[key];

    return Array.isArray(current) ? current[0] : current;
  };
  const shipping = await getAdminShipping({
    view: value("view"),
    filter: value("filter"),
    q: value("q") || "",
    product: value("product") || "all",
    email: value("email") || "all",
    carrier: value("carrier") || "all",
    page: value("page") || "1",
    pageSize: value("pageSize") || "25",
  });

  return (
    <ShippingOperationsCenter
      {...shipping}
      result={value("result") || ""}
      emailResult={value("emailResult") || ""}
      reason={value("reason") || ""}
    />
  );
}
