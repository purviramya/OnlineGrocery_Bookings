import { money } from '../context/AppContext';
import { useShop } from '../context/ShopContext';
import { MAX_QTY_PER_LINE } from '../../shared/config';

export default function ProductCard({ product: p }) {
  const { items, setQty } = useShop();
  const qty = items.find((i) => i.productId === p.id)?.qty ?? 0;
  const max = Math.min(p.stock, MAX_QTY_PER_LINE);

  return (
    <div className="card">
      <div className="card-media" style={{ background: p.color }}>{p.emoji}</div>
      <div className="card-body">
        <h3>{p.name}</h3>
        <p className="muted">{p.unit} · {p.category}</p>
        <p>{p.description}</p>
        <p className="price">{money(p.pricePence)}</p>
        {p.stock === 0 ? (
          <button className="btn btn-block" disabled>Out of stock</button>
        ) : qty === 0 ? (
          <button className="btn btn-primary btn-block" onClick={() => setQty(p.id, 1)}>Add to basket</button>
        ) : (
          <div className="stepper">
            <button className="btn btn-sm" aria-label={`Remove one ${p.name}`} onClick={() => setQty(p.id, qty - 1)}>−</button>
            <strong>{qty}</strong>
            <button className="btn btn-sm" aria-label={`Add one ${p.name}`} disabled={qty >= max} onClick={() => setQty(p.id, qty + 1)}>+</button>
          </div>
        )}
        {p.stock > 0 && p.stock <= 10 && <small className="error">Only {p.stock} left</small>}
      </div>
    </div>
  );
}
