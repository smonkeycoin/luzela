const DHL_MEXICO_TRACKING_URL = "https://www.dhl.com/mx-es/home/rastreo.html";

export const DHL_CARRIER = "DHL";

export function normalizeDhlTrackingNumber(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function isValidDhlTrackingNumber(value: string) {
  const normalized = normalizeDhlTrackingNumber(value);

  return normalized.length >= 5 && /^[A-Z0-9-]+$/.test(normalized);
}

export function getDhlTrackingUrl() {
  return DHL_MEXICO_TRACKING_URL;
}
