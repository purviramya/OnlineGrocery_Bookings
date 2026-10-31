import { useEffect, useState } from 'react';
import { getCategories, getProducts } from '../services/api';
import ProductCard from '../components/ProductCard';
import { useShop } from '../context/ShopContext';
import { APP, LOYALTY } from '../../shared/config';

export default function Home() {
  const { catalogue } = useShop();
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);
  useEffect(() => {
    // Debounce the search box; category clicks feel instant enough with the same delay.
    const t = setTimeout(() => {
      getProducts({ category, q: q.trim() }).then((p) => { setError(null); setProducts(p); }).catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [category, q, catalogue]); // catalogue changes after an order (stock), so refetch

  return (
    <div className="container">
      <section className="hero">
        <h1>{APP.emoji} Fresh groceries, delivered</h1>
        <p>Earn {LOYALTY.pointsPerPound} loyalty point for every £1 you spend. Once you reach {LOYALTY.minBalanceToRedeem} points, spend them at {LOYALTY.penceValue}p each.</p>
      </section>

      <input className="search" type="search" placeholder="Search groceries…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search groceries" />

      <div className="chips">
        {['', ...categories].map((c) => (
          <button key={c} className={`chip ${c === category ? 'active' : ''}`} onClick={() => setCategory(c)}>{c || 'All'}</button>
        ))}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {!products && !error && <p className="muted">Loading…</p>}
      {products?.length === 0 && <p className="muted">No groceries match your search.</p>}
      <div className="grid">
        {products?.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}
