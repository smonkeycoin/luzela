import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getStripe } from "@/lib/stripe/client";
import { processStripeEvent } from "@/lib/stripe/process-event";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = (await headers()).get("stripe-signature");

  if (!stripe || !webhookSecret || !signature) {
    return NextResponse.json(
      { error: "stripe_webhook_not_configured" },
      { status: 501 },
    );
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  await processStripeEvent(event);

  return NextResponse.json({ received: true });
}
