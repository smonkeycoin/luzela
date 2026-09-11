import { createHash } from "crypto";

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function createAttemptSignature(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function metadataAttemptSignature(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const signature = (metadata as Record<string, unknown>).attempt_signature;
  return typeof signature === "string" ? signature : null;
}

export function isSameAttemptSignature(metadata: unknown, signature: string) {
  const existingSignature = metadataAttemptSignature(metadata);
  return !existingSignature || existingSignature === signature;
}
