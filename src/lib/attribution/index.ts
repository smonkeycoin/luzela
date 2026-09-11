export const ATTRIBUTION_STORAGE_KEY = "luzela_attribution_v1";
export const ATTRIBUTION_COOKIE_KEY = "luzela_attr";
export const ATTRIBUTION_EXPIRY_DAYS = 30;

const MAX_FIELD_LENGTH = 160;
const MAX_URL_LENGTH = 512;
const INTERNAL_HOSTS = new Set(["luzela.mx", "www.luzela.mx"]);
const OWNED_HOSTS = new Set(["about.luzela.mx"]);

export type AttributionTouch = {
  ref?: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  referrer: string;
  landing_path: string;
  landing_url: string;
  first_seen_at: string;
  last_seen_at: string;
};

export type AttributionSnapshot = {
  collab_touch?: AttributionTouch;
  first_touch: AttributionTouch;
  last_touch: AttributionTouch;
  expires_at: string;
};

export type AttributionOrderSnapshot = {
  first_touch_source: string;
  first_touch_medium: string;
  first_touch_campaign: string;
  first_touch_content: string;
  first_touch_term: string;
  first_touch_referrer: string;
  first_touch_landing_path: string;
  first_touch_landing_url: string;
  first_seen_at: string;
  last_touch_source: string;
  last_touch_medium: string;
  last_touch_campaign: string;
  last_touch_content: string;
  last_touch_term: string;
  last_touch_referrer: string;
  last_touch_landing_path: string;
  last_touch_landing_url: string;
  last_seen_at: string;
};

type CaptureInput = {
  url: string;
  referrer?: string | null;
  now?: Date;
};

export function captureAttribution(
  current: AttributionSnapshot | null,
  input: CaptureInput,
): AttributionSnapshot {
  const now = input.now || new Date();
  const expiresAt = addDays(now, ATTRIBUTION_EXPIRY_DAYS).toISOString();
  const existing = current && new Date(current.expires_at).getTime() > now.getTime() ? current : null;
  const touch = deriveTouch(input, now);
  const shouldUpdateLast = isMeaningfulTouch(touch) || !existing;
  const firstTouch = existing?.first_touch || touch;
  const lastTouch = shouldUpdateLast ? touch : existing?.last_touch || touch;

  return {
    first_touch: firstTouch,
    last_touch: lastTouch,
    ...((touch.campaign === "luzela_x_chavolines" || touch.ref === "chavolines" || touch.landing_path.split("?")[0] === "/chavolines") ? {collab_touch:touch} : existing?.collab_touch ? {collab_touch:existing.collab_touch} : {}),
    expires_at: expiresAt,
  };
}

export function parseAttributionPayload(value: unknown): AttributionSnapshot | null {
  if (!value) {
    return null;
  }

  try {
    const parsed =
      typeof value === "string" ? (JSON.parse(value) as Partial<AttributionSnapshot>) : value;

    return normalizeAttributionSnapshot(parsed);
  } catch {
    return null;
  }
}

export function normalizeAttributionSnapshot(value: unknown): AttributionSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<AttributionSnapshot>;
  const now = new Date();
  const firstTouch = normalizeTouch(candidate.first_touch, now);
  const lastTouch = normalizeTouch(candidate.last_touch || candidate.first_touch, now);

  if (!firstTouch || !lastTouch) {
    return null;
  }

  return {
    first_touch: firstTouch,
    last_touch: lastTouch,
    ...(candidate.collab_touch ? {collab_touch:normalizeTouch(candidate.collab_touch,now) || undefined} : {}),
    expires_at: sanitizeIsoDate(candidate.expires_at) || addDays(now, ATTRIBUTION_EXPIRY_DAYS).toISOString(),
  };
}

export function toOrderAttributionSnapshot(
  snapshot: AttributionSnapshot | null,
): AttributionOrderSnapshot {
  const safeSnapshot = snapshot || directAttributionSnapshot(new Date());
  const { first_touch: firstTouch, last_touch: lastTouch } = safeSnapshot;

  return {
    first_touch_source: firstTouch.source,
    first_touch_medium: firstTouch.medium,
    first_touch_campaign: firstTouch.campaign,
    first_touch_content: firstTouch.content,
    first_touch_term: firstTouch.term,
    first_touch_referrer: firstTouch.referrer,
    first_touch_landing_path: firstTouch.landing_path,
    first_touch_landing_url: firstTouch.landing_url,
    first_seen_at: firstTouch.first_seen_at,
    last_touch_source: lastTouch.source,
    last_touch_medium: lastTouch.medium,
    last_touch_campaign: lastTouch.campaign,
    last_touch_content: lastTouch.content,
    last_touch_term: lastTouch.term,
    last_touch_referrer: lastTouch.referrer,
    last_touch_landing_path: lastTouch.landing_path,
    last_touch_landing_url: lastTouch.landing_url,
    last_seen_at: lastTouch.last_seen_at,
  };
}

export function classifyAttributionGroup(source: string, medium: string) {
  const normalizedSource = sanitizeLower(source) || "unknown";
  const normalizedMedium = sanitizeLower(medium) || "unknown";

  if (normalizedSource === "direct" || normalizedMedium === "none") {
    return "direct";
  }

  if (normalizedSource === "meta" || normalizedMedium === "paid_social") {
    return "paid_social";
  }

  if (normalizedSource === "luzelaexperience" || normalizedMedium === "owned") {
    return "owned";
  }

  if (normalizedSource === "email" || normalizedMedium === "transactional") {
    return "email";
  }

  if (normalizedMedium === "organic") {
    return "organic";
  }

  return "referral";
}

export function isInternalReferrer(referrer: string | null | undefined, currentUrl?: string) {
  if (!referrer) {
    return false;
  }

  const referrerHost = safeHostname(referrer);
  const currentHost = currentUrl ? safeHostname(currentUrl) : "";

  return Boolean(referrerHost && (INTERNAL_HOSTS.has(referrerHost) || referrerHost === currentHost));
}

function deriveTouch({ url, referrer, now = new Date() }: CaptureInput, seenAt: Date) {
  const parsedUrl = safeUrl(sanitizeUrl(url));
  const params = parsedUrl?.searchParams || new URLSearchParams();
  const landingPath = sanitizePath(parsedUrl ? `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}` : "/");
  const landingUrl = sanitizeLandingUrl(parsedUrl);
  const utmSource = sanitizeLower(params.get("utm_source"));
  const utmMedium = sanitizeLower(params.get("utm_medium"));
  const collab = params.get('ref')?.toLowerCase() === 'chavolines' || parsedUrl?.pathname === '/chavolines' || params.get('utm_campaign') === 'luzela_x_chavolines';
  const campaign = sanitizeText(params.get("utm_campaign")) || (collab ? 'luzela_x_chavolines' : '');
  const content = sanitizeText(params.get("utm_content"));
  const term = sanitizeText(params.get("utm_term"));
  const safeReferrer = sanitizeUrl(referrer || "");

  if (utmSource || utmMedium || campaign || content || term) {
    return buildTouch({
      source: utmSource || (collab ? "elmundoenpareja" : "unknown"),
      medium: utmMedium || (collab ? "creator" : "unknown"),
      campaign,
      content,
      term,
      referrer: safeReferrer,
      landingPath,
      landingUrl,
      seenAt,
    });
  }

  const referrerHost = safeHostname(referrer || "");
  const currentHost = parsedUrl?.hostname || "";

  if (referrerHost && !INTERNAL_HOSTS.has(referrerHost) && referrerHost !== currentHost) {
    const classified = classifyReferrer(referrerHost);

    return buildTouch({
      source: classified.source,
      medium: classified.medium,
      campaign: "",
      content: "",
      term: "",
      referrer: safeReferrer,
      landingPath,
      landingUrl,
      seenAt,
    });
  }

  return buildTouch({
    source: "direct",
    medium: "none",
    campaign: "",
    content: "",
    term: "",
    referrer: safeReferrer,
    landingPath,
    landingUrl,
    seenAt: now,
  });
}

function directAttributionSnapshot(now: Date): AttributionSnapshot {
  const touch = buildTouch({
    source: "direct",
    medium: "none",
    campaign: "",
    content: "",
    term: "",
    referrer: "",
    landingPath: "/",
    landingUrl: "",
    seenAt: now,
  });

  return {
    first_touch: touch,
    last_touch: touch,
    expires_at: addDays(now, ATTRIBUTION_EXPIRY_DAYS).toISOString(),
  };
}

function buildTouch({
  source,
  medium,
  campaign,
  content,
  term,
  referrer,
  landingPath,
  landingUrl,
  seenAt,
}: {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  referrer: string;
  landingPath: string;
  landingUrl: string;
  seenAt: Date;
}): AttributionTouch {
  return {
    ref: sanitizeLower(safeUrl(landingUrl)?.searchParams.get("ref")),
    source: sanitizeLower(source) || "unknown",
    medium: sanitizeLower(medium) || "unknown",
    campaign: sanitizeText(campaign),
    content: sanitizeText(content),
    term: sanitizeText(term),
    referrer: sanitizeUrl(referrer),
    landing_path: sanitizePath(landingPath),
    landing_url: sanitizeUrl(landingUrl),
    first_seen_at: seenAt.toISOString(),
    last_seen_at: seenAt.toISOString(),
  };
}

function normalizeTouch(value: unknown, now: Date): AttributionTouch | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const touch = value as Partial<AttributionTouch>;

  return {
    ref: sanitizeLower(touch.ref || safeUrl(touch.landing_url || "")?.searchParams.get("ref")),
    source: sanitizeLower(touch.source) || "unknown",
    medium: sanitizeLower(touch.medium) || "unknown",
    campaign: sanitizeText(touch.campaign),
    content: sanitizeText(touch.content),
    term: sanitizeText(touch.term),
    referrer: sanitizeUrl(touch.referrer || ""),
    landing_path: sanitizePath(touch.landing_path || "/"),
    landing_url: sanitizeUrl(touch.landing_url || ""),
    first_seen_at: sanitizeIsoDate(touch.first_seen_at) || now.toISOString(),
    last_seen_at: sanitizeIsoDate(touch.last_seen_at) || sanitizeIsoDate(touch.first_seen_at) || now.toISOString(),
  };
}

function classifyReferrer(host: string) {
  const normalized = host.replace(/^www\./, "");

  if (OWNED_HOSTS.has(normalized)) {
    return { source: "luzelaexperience", medium: "owned" };
  }

  if (normalized.includes("google.")) {
    return { source: "google", medium: "organic" };
  }

  if (normalized.includes("instagram.")) {
    return { source: "instagram", medium: "organic" };
  }

  if (normalized.includes("facebook.") || normalized.includes("fb.")) {
    return { source: "facebook", medium: "organic" };
  }

  if (normalized.includes("tiktok.")) {
    return { source: "tiktok", medium: "organic" };
  }

  return { source: normalized, medium: "referral" };
}

function isMeaningfulTouch(touch: AttributionTouch) {
  return !(touch.source === "direct" && touch.medium === "none");
}

function sanitizeText(value: unknown, maxLength = MAX_FIELD_LENGTH) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeLower(value: unknown) {
  return sanitizeText(value).toLowerCase();
}

function sanitizePath(value: unknown) {
  const path = sanitizeText(value, MAX_URL_LENGTH);

  return path.startsWith("/") ? path : "/";
}

function sanitizeUrl(value: unknown) {
  const raw = sanitizeText(value, MAX_URL_LENGTH);
  const url = safeUrl(raw);

  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
    return "";
  }

  for (const key of [...url.searchParams.keys()]) {
    if (!['utm_source','utm_medium','utm_campaign','utm_content','utm_term','ref'].includes(key)) url.searchParams.delete(key);
  }
  url.hash = '';
  url.username = "";
  url.password = "";
  return url.toString().slice(0, MAX_URL_LENGTH);
}

function sanitizeLandingUrl(url: URL | null) {
  if (!url) {
    return "";
  }

  const clone = new URL(url.toString());
  clone.username = "";
  clone.password = "";

  return sanitizeUrl(clone.toString());
}

function sanitizeIsoDate(value: unknown) {
  const date = new Date(String(value || ""));

  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function safeUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function safeHostname(value: string) {
  return safeUrl(value)?.hostname.replace(/^www\./, "") || "";
}

function addDays(date: Date, days: number) {
  const next = new Date(date);

  next.setDate(next.getDate() + days);
  return next;
}
