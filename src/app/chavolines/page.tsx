import { redirect } from "next/navigation";

// The previous public campaign landing is retired in the private-code phase.
export default function Page() {
  redirect("/#tienda");
}
