"use client";

import { useEffect, useRef } from "react";

import { ATTRIBUTION_STORAGE_KEY, parseAttributionPayload } from "@/lib/attribution";

export function AttributionCheckoutField() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const snapshot = parseAttributionPayload(window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY));

    if (snapshot && inputRef.current) {
      inputRef.current.value = JSON.stringify(snapshot);
    }
  }, []);

  return <input ref={inputRef} type="hidden" name="attribution" data-testid="attribution-payload" />;
}
