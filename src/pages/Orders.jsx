import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrders } from '../services/api';
import { formatWhen, money } from '../context/AppContext';

export default function Orders() {
  const { id } = useParams();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { getOrders().then(setOrders).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="container"><p className="error" role="alert">{error}</p></div>;
  if (!orders) return <div className="container"><p className="muted">Loading…</p></div>;

  const shown = id ? orders.filter((o) => o.id === id) : orders;
  return (
    <div className="container narrow">
      <h1>{id ? 'Order' : 'My orders'}</h1>
      {id && <Link to="/orders" className="back">← All orders</Link>}
      {shown.length === 0 && (
        <div className="empty"><p className="muted">{id ? 'Order not found.' : 'No orders yet.'}</p><Link to="/" className="btn btn-primary">Start shopping</Link></div>
      )}
      {shown.map((o) => (
        <article key={o.id} className="panel">
          <div className="row-between">
            <strong><Link to={`/orders/${o.id}`}>{o.id}</Link></strong>
            <span className="status placed">{o.status}</span>
          </div>
          <p className="muted">{formatWhen(o.createdAt)}</p>
          {o.items.map((i) => <div key={i.productId} className="row-between"><span>{i.emoji} {i.qty} × {i.name} <small className="muted">{i.unit}</small></span><span>{money(i.pricePence * i.qty)}</span></div>)}
          <div className="summary">
            <div><span>Groceries</span><span>{money(o.totals.subtotal)}</span></div>
            <div><span>Delivery</span><span>{o.totals.delivery ? money(o.totals.delivery) : 'Free'}</span></div>
            {o.totals.discount > 0 && <div><span>Loyalty points ({o.totals.pointsRedeemed})</span><span>−{money(o.totals.discount)}</span></div>}
            <div className="total"><span>Total</span><span>{money(o.totals.total)}</span></div>
          </div>
          <p className="earn">⭐ Earned {o.totals.pointsEarned} point{o.totals.pointsEarned === 1 ? '' : 's'}</p>
          {id && <p className="muted">Delivering to {o.customer.name}, {o.customer.address}, {o.customer.city} {o.customer.postcode}</p>}
        </article>
      ))}
    </div>
  );
}
