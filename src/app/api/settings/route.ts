import { NextResponse } from "next/server";

import { getPublicSettings } from "@/lib/settings";

export async function GET() {
  const settings = await getPublicSettings();

  return NextResponse.json(settings, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
