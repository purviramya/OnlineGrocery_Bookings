import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { APP } from '../../shared/config';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((msg) => setToast(msg), []);
  const value = useMemo(() => ({ toast, showToast }), [toast, showToast]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

// Formatting lives in one place so currency/locale changes are a one-line config edit.
// All amounts in the app are integer pence.
const fmt = new Intl.NumberFormat(APP.locale, { style: 'currency', currency: APP.currency });
export const money = (pence) => fmt.format(pence / 100);

export const formatWhen = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) =>
  new Intl.DateTimeFormat(APP.locale, { timeZone: APP.timezone, ...opts }).format(new Date(iso));
