"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/routing";

export type CartLine = {
  lineId: string;
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  shape: string;
  size: string;
  finish: string;
  customSizing?: string;
};

type AddCartLine = Omit<CartLine, "lineId">;

type StoreContextValue = {
  hydrated: boolean;
  cart: CartLine[];
  wishlist: string[];
  cartCount: number;
  subtotal: number;
  syncStatus: "local" | "syncing" | "synced" | "error";
  addItem: (line: AddCartLine) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  toggleWishlist: (productId: string) => void;
  clearCart: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);
const CART_KEY = "lunaria-cart-v1";
const WISHLIST_KEY = "lunaria-wishlist-v1";

function readStoredArray<T>(key: string): T[] {
  const value = window.localStorage.getItem(key);
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale() as Locale;
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [remoteEnabled, setRemoteEnabled] = useState(false);
  const [syncStatus, setSyncStatus] =
    useState<StoreContextValue["syncStatus"]>("local");

  useEffect(() => {
    const frame = window.requestAnimationFrame(async () => {
      const localCart = readStoredArray<CartLine>(CART_KEY);
      const localWishlist = readStoredArray<string>(WISHLIST_KEY);
      try {
        const response = await fetch(`/api/store-state?locale=${locale}`);
        const remote = (await response.json()) as {
          mode?: "local" | "database";
          cart?: CartLine[];
          wishlist?: string[];
        };
        const enabled = response.ok && remote.mode === "database";
        setRemoteEnabled(enabled);
        setCart((current) =>
          current.length
            ? current
            : localCart.length
              ? localCart
              : (remote.cart ?? []),
        );
        setWishlist((current) =>
          current.length
            ? current
            : localWishlist.length
              ? localWishlist
              : (remote.wishlist ?? []),
        );
        setSyncStatus(enabled ? "synced" : "local");
      } catch {
        setCart((current) => (current.length ? current : localCart));
        setWishlist((current) => (current.length ? current : localWishlist));
        setSyncStatus("error");
      } finally {
        setHydrated(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [locale]);

  useEffect(() => {
    if (!hydrated || !remoteEnabled) return;
    const timer = window.setTimeout(() => {
      setSyncStatus("syncing");
      void fetch("/api/store-state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart, wishlist }),
      })
        .then((response) => setSyncStatus(response.ok ? "synced" : "error"))
        .catch(() => setSyncStatus("error"));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [cart, hydrated, remoteEnabled, wishlist]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
    }
  }, [wishlist, hydrated]);

  const addItem = useCallback((incoming: AddCartLine) => {
    const lineId = [
      incoming.productId,
      incoming.shape,
      incoming.size,
      incoming.finish,
      incoming.customSizing ?? "",
    ].join(":");

    setCart((current) => {
      const existing = current.find((line) => line.lineId === lineId);
      if (!existing) return [...current, { ...incoming, lineId }];
      return current.map((line) =>
        line.lineId === lineId
          ? { ...line, quantity: line.quantity + incoming.quantity }
          : line,
      );
    });
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    if (quantity < 1) {
      setCart((current) => current.filter((line) => line.lineId !== lineId));
      return;
    }
    setCart((current) =>
      current.map((line) =>
        line.lineId === lineId ? { ...line, quantity } : line,
      ),
    );
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setCart((current) => current.filter((line) => line.lineId !== lineId));
  }, []);

  const toggleWishlist = useCallback((productId: string) => {
    setWishlist((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      hydrated,
      cart,
      wishlist,
      cartCount: cart.reduce((total, line) => total + line.quantity, 0),
      subtotal: cart.reduce(
        (total, line) => total + line.price * line.quantity,
        0,
      ),
      syncStatus,
      addItem,
      updateQuantity,
      removeItem,
      toggleWishlist,
      clearCart: () => setCart([]),
    }),
    [
      addItem,
      cart,
      hydrated,
      removeItem,
      toggleWishlist,
      updateQuantity,
      wishlist,
      syncStatus,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return context;
}
