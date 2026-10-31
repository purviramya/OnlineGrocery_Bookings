import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authClient } from '../services/auth-client';
import { getLoyalty, getProducts } from '../services/api';
import { load, save } from '../services/storage';

const ShopContext = createContext(null);

// The basket is [{ productId, qty }] in localStorage (guests can fill it before signing in).
// Names and prices always come from the catalogue the server returned, never from storage.
export function ShopProvider({ children }) {
  const { data: session } = authClient.useSession();
  const [items, setItems] = useState(() => load('basket', []));
  const [catalogue, setCatalogue] = useState(null);
  const [loyalty, setLoyalty] = useState(null);

  useEffect(() => { save('basket', items); }, [items]);

  const refreshCatalogue = useCallback(() => getProducts().then(setCatalogue).catch(() => setCatalogue([])), []);
  useEffect(() => { refreshCatalogue(); }, [refreshCatalogue]);

  const refreshLoyalty = useCallback(() => {
    if (!session) return setLoyalty(null);
    return getLoyalty().then(setLoyalty).catch(() => {});
  }, [session]);
  useEffect(() => { refreshLoyalty(); }, [refreshLoyalty]);

  const setQty = useCallback((productId, qty) => {
    setItems((prev) => {
      const rest = prev.filter((i) => i.productId !== productId);
      return qty > 0 ? [...rest, { productId, qty }].sort((a, b) => (a.productId < b.productId ? -1 : 1)) : rest;
    });
  }, []);
  const clear = useCallback(() => setItems([]), []);

  // Basket lines joined with live catalogue data; unknown products are dropped.
  const lines = useMemo(() => {
    if (!catalogue) return [];
    const byId = new Map(catalogue.map((p) => [p.id, p]));
    return items.filter((i) => byId.has(i.productId)).map((i) => ({ ...byId.get(i.productId), qty: i.qty }));
  }, [items, catalogue]);

  const count = items.reduce((n, i) => n + i.qty, 0);
  const value = { items, lines, count, catalogue, loyalty, setQty, clear, refreshLoyalty, refreshCatalogue };
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside ShopProvider');
  return ctx;
}
