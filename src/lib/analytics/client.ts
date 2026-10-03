"use client";

import { ATTRIBUTION_STORAGE_KEY, parseAttributionPayload } from "@/lib/attribution";
import type { CommerceEventName } from "./commerce";

const SESSION_KEY = "luzela_funnel_session_v1";
const QA_KEY = "luzela_funnel_qa_v1";
const SESSION_LENGTH = 30 * 60 * 1000;
type Detail = { product_id?: string; product_sku?: string; quantity?: number; value_cents?: number; campaign?: string; ref?: string; metadata?: { item_count?: number } };
const safePath = () => ["/", "/cart", "/checkout", "/checkout/payment", "/checkout/success", "/chavolines"].includes(location.pathname)
  ? location.pathname : "/other";

function session() {
  const now = Date.now();
  try {
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") as { id?: string; at?: number } | null;
    const active = stored?.id && stored.at && now - stored.at < SESSION_LENGTH;
    const id = active ? stored.id! : crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, at: now }));
    return { id, fresh: !active };
  } catch { return { id: crypto.randomUUID(), fresh: true }; }
}

export function currentAnalyticsSessionId() { return typeof window === "undefined" ? "" : session().id; }

export function isAnalyticsQa() {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(location.search).get("funnel_qa") === "1") sessionStorage.setItem(QA_KEY, "1");
    return sessionStorage.getItem(QA_KEY) === "1" || navigator.webdriver;
  } catch { return navigator.webdriver; }
}

function attribution() {
  try {
    const snapshot = parseAttributionPayload(localStorage.getItem(ATTRIBUTION_STORAGE_KEY));
    const first = snapshot?.first_touch;
    const last = snapshot?.last_touch;
    const params = new URLSearchParams(location.search);
    const landingPath = first?.ref === "chavolines" || first?.campaign === "luzela_x_chavolines"
      ? "/chavolines" : first?.landing_path?.split(/[?#]/)[0] || safePath();
    const safe = (value?: string | null) => value?.slice(0, 160) || undefined;
    return {
      first_source: safe(first?.source), first_medium: safe(first?.medium), first_campaign: safe(first?.campaign),
      first_content: safe(first?.content), first_ref: safe(first?.ref),
      source: safe(last?.source || params.get("utm_source")), medium: safe(last?.medium || params.get("utm_medium")),
      campaign: safe(last?.campaign || params.get("utm_campaign")), content: safe(last?.content || params.get("utm_content")),
      ref: safe(last?.ref || params.get("ref")),
      landing_path: ["/", "/cart", "/checkout", "/checkout/payment", "/checkout/success", "/chavolines"].includes(landingPath) ? landingPath : "/other",
      referrer_domain: (() => { try { return new URL(document.referrer).hostname.slice(0, 160); } catch { return undefined; } })(),
    };
  } catch { return { landing_path: safePath() }; }
}

export function trackCommerce(event_name: CommerceEventName, detail: Detail = {}, onceKey?: string) {
  if (typeof window === "undefined") return;
  try {
  const { id, fresh } = session();
  const send = (name: CommerceEventName, payload: Detail, key?: string) => {
    if (key) {
      const storageKey = `luzela_evt:${id}:${key}`;
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
    }
    const campaignAttribution = payload.campaign
      ? { campaign: payload.campaign, ...(payload.ref ? { ref: payload.ref } : {}) }
      : payload.product_sku === "LUZ-SUMMER-3X"
      ? { campaign: "summer_drop", ref: "summerdrop" }
      : {};
    const body = JSON.stringify({ event_name: name, anonymous_session_id: id,
      ...(key ? { event_key: `${id}:${key}` } : {}), ...payload, ...attribution(), ...campaignAttribution, is_qa: isAnalyticsQa(), currency: "mxn" });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/analytics", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch { /* Telemetry never blocks navigation. */ }
    const pixelEvent = ({ view_product: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout" } as Record<string, string>)[name];
    try {
      if (pixelEvent && localStorage.getItem("luzela_marketing_consent_v1") === "granted" && window.fbq) {
        window.fbq("track", pixelEvent, { currency: "MXN", value: payload.value_cents ? payload.value_cents / 100 : undefined, content_ids: payload.product_sku ? [payload.product_sku] : undefined });
      }
    } catch { /* Marketing analytics is optional. */ }
  };
  if (fresh) send("session_started", {}, "session_started");
  send(event_name, detail, onceKey);
  } catch { /* Analytics must never interrupt commerce actions. */ }
}
