"use client";

import { useMemo, useState } from "react";

const CART_KEY = "luzela_cart";

export type CartItem = {
  variantId: string;
  quantity: number;
};

function readCart(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_KEY) || "[]") as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistCart(items: CartItem[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  }
}

function mergeItems(items: CartItem[]) {
  return items.reduce<CartItem[]>((merged, item) => {
    const existing = merged.find((candidate) => candidate.variantId === item.variantId);
    if (existing) {
      existing.quantity += item.quantity;
      return merged;
    }

    return [...merged, { ...item }];
  }, []);
}

export function useCart(initialItems: CartItem[] = []) {
  const [items, setItems] = useState<CartItem[]>(() => {
    const stored = readCart();
    return mergeItems([...stored, ...initialItems]).filter((item) => item.quantity > 0);
  });

  const api = useMemo(
    () => ({
      update(variantId: string, quantity: number, stock: number) {
        const current = items.some((item) => item.variantId === variantId)
          ? items
          : [...items, { variantId, quantity: 1 }];
        const next = current
          .map((item) =>
            item.variantId === variantId
              ? { ...item, quantity: Math.max(1, Math.min(stock, quantity)) }
              : item,
          )
          .filter((item) => item.quantity > 0);
        setItems(next);
        persistCart(next);
      },
      remove(variantId: string) {
        const next = items.filter((item) => item.variantId !== variantId);
        setItems(next);
        persistCart(next);
      },
      clear() {
        setItems([]);
        persistCart([]);
      },
    }),
    [items],
  );

  return { items, ready: true, ...api };
}
