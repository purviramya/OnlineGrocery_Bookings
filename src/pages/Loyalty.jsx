import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatWhen, money } from '../context/AppContext';
import { useShop } from '../context/ShopContext';
import { LOYALTY } from '../../shared/config';

export default function Loyalty() {
  const { loyalty, refreshLoyalty } = useShop();
  useEffect(() => { refreshLoyalty(); }, [refreshLoyalty]);

  if (!loyalty) return <div className="container"><p className="muted">Loading…</p></div>;
  const toGo = LOYALTY.minBalanceToRedeem - loyalty.points;
  return (
    <div className="container narrow">
      <h1>⭐ Loyalty points</h1>
      <section className="panel">
        <p className="big">{loyalty.points} <small className="muted">points · worth {money(loyalty.points * LOYALTY.penceValue)}</small></p>
        {toGo > 0
          ? <p className="muted">Spend £{toGo * LOYALTY.penceValue / LOYALTY.pointsPerPound} more to unlock spending (you need {LOYALTY.minBalanceToRedeem} points).</p>
          : <p>You can spend your points at checkout. <Link to="/">Shop now</Link></p>}
        <p className="muted">You earn {LOYALTY.pointsPerPound} point for every whole £1 you pay. Each point is worth {LOYALTY.penceValue}p once your balance reaches {LOYALTY.minBalanceToRedeem}.</p>
      </section>
      <section className="panel">
        <h3>History</h3>
        {loyalty.history.length === 0 && <p className="muted">No activity yet.</p>}
        {loyalty.history.map((h, i) => (
          <div key={i} className="row-between">
            <span><Link to={`/orders/${h.orderId}`}>{h.orderId}</Link> · {h.reason === 'earn' ? 'Earned' : 'Spent'} <small className="muted">{formatWhen(h.createdAt)}</small></span>
            <strong className={h.delta > 0 ? 'pos' : ''}>{h.delta > 0 ? '+' : ''}{h.delta}</strong>
          </div>
        ))}
      </section>
    </div>
  );
}
