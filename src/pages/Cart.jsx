import { Link } from 'react-router-dom';
import { authClient } from '../services/auth-client';
import { money } from '../context/AppContext';
import { useShop } from '../context/ShopContext';
import { calcOrder } from '../../shared/pricing';
import { DELIVERY, MAX_QTY_PER_LINE } from '../../shared/config';

export default function Cart() {
  const { data: session } = authClient.useSession();
  const { lines, catalogue, setQty, clear } = useShop();

  if (!catalogue) return <div className="container"><p className="muted">Loading…</p></div>;
  if (lines.length === 0) {
    return <div className="container empty"><h2>Your basket is empty</h2><Link to="/" className="btn btn-primary">Start shopping</Link></div>;
  }

  const t = calcOrder({ lines });
  const away = DELIVERY.freeOverPence - t.subtotal;
  return (
    <div className="container narrow">
      <h1>Your basket</h1>
      <section className="panel">
        {lines.map((l) => (
          <div key={l.id} className="line">
            <span className="emoji">{l.emoji}</span>
            <div className="grow"><strong>{l.name}</strong><br /><small className="muted">{l.unit} · {money(l.pricePence)}</small></div>
            <div className="stepper">
              <button className="btn btn-sm" onClick={() => setQty(l.id, l.qty - 1)} aria-label={`Remove one ${l.name}`}>−</button>
              <strong>{l.qty}</strong>
              <button className="btn btn-sm" disabled={l.qty >= Math.min(l.stock, MAX_QTY_PER_LINE)} onClick={() => setQty(l.id, l.qty + 1)} aria-label={`Add one ${l.name}`}>+</button>
            </div>
            <strong className="line-total">{money(l.pricePence * l.qty)}</strong>
          </div>
        ))}
        <div className="summary">
          <div><span>Groceries</span><span>{money(t.subtotal)}</span></div>
          <div><span>Delivery</span><span>{t.delivery ? money(t.delivery) : 'Free'}</span></div>
          <div className="total"><span>Total</span><span>{money(t.total)}</span></div>
        </div>
        {away > 0 && <p className="muted">Spend {money(away)} more for free delivery.</p>}
        <p className="earn">⭐ You'll earn {t.earned} loyalty point{t.earned === 1 ? '' : 's'} on this order.</p>
      </section>
      <div className="row">
        <button className="btn" onClick={clear}>Empty basket</button>
        {session
          ? <Link to="/checkout" className="btn btn-primary">Checkout</Link>
          : <Link to="/signin" state={{ from: '/checkout' }} className="btn btn-primary">Sign in to check out</Link>}
      </div>
    </div>
  );
}
