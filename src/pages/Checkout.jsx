import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authClient } from '../services/auth-client';
import { createOrder } from '../services/api';
import { load, save } from '../services/storage';
import { money, useApp } from '../context/AppContext';
import { useShop } from '../context/ShopContext';
import { calcOrder } from '../../shared/pricing';
import { validateDelivery } from '../../shared/validation';
import { LOYALTY } from '../../shared/config';

const EMPTY = { name: '', email: '', phone: '', address: '', city: '', postcode: '', notes: '' };

export default function Checkout() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const { showToast } = useApp();
  const { items, lines, catalogue, loyalty, clear, refreshLoyalty, refreshCatalogue } = useShop();
  const [form, setForm] = useState(() => ({ ...EMPTY, ...load('delivery', {}) }));
  const [redeem, setRedeem] = useState(0);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Prefill from the account (details saved earlier win).
  useEffect(() => {
    if (session) setForm((f) => ({ ...f, name: f.name || session.user.name, email: f.email || session.user.email.replace(/^instagram-.*@users\.invalid$/, '') }));
  }, [session]);

  if (!catalogue || !loyalty) return <div className="container"><p className="muted">Loading…</p></div>;
  if (lines.length === 0) return <div className="container empty"><h2>Your basket is empty</h2><Link to="/" className="btn btn-primary">Start shopping</Link></div>;

  const t = calcOrder({ lines, redeemPoints: redeem, balance: loyalty.points });
  const canRedeem = loyalty.points >= LOYALTY.minBalanceToRedeem;
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = validateDelivery(form);
    setErrors(errs);
    if (Object.keys(errs).length || t.redeemError) return;

    setSubmitting(true);
    setServerError(null);
    const { notes, ...remembered } = form;
    save('delivery', remembered);
    try {
      const order = await createOrder({ items, redeemPoints: redeem, customer: form });
      clear();
      refreshLoyalty();
      refreshCatalogue();
      showToast('Order placed');
      navigate(`/orders/${order.id}`);
    } catch (err) {
      setErrors(err.details ?? {});
      setServerError(err.message || 'Could not place your order. Please try again.');
      setSubmitting(false);
      if (err.status === 401) navigate('/signin', { state: { from: '/checkout' } });
      if (err.status === 409 || err.status === 400) { refreshCatalogue(); refreshLoyalty(); }
    }
  };

  const field = (name, label, props = {}) => (
    <label className={`field ${errors[name] ? 'has-error' : ''}`}>
      <span>{label}</span>
      <input name={name} value={form[name]} onChange={onChange} {...props} />
      {errors[name] && <small className="error">{errors[name]}</small>}
    </label>
  );

  return (
    <div className="container">
      <h1>Checkout</h1>
      <div className="cols">
        <form className="panel" onSubmit={onSubmit} noValidate id="checkout">
          <h3>Delivery details</h3>
          {field('name', 'Full name', { autoComplete: 'name' })}
          {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
          {field('phone', 'Phone', { type: 'tel', autoComplete: 'tel' })}
          {field('address', 'Address', { autoComplete: 'address-line1' })}
          {field('city', 'Town / city', { autoComplete: 'address-level2' })}
          {field('postcode', 'Postcode', { autoComplete: 'postal-code' })}
          {field('notes', 'Delivery notes (optional)')}
        </form>

        <div>
          <section className="panel">
            <h3>⭐ Loyalty points</h3>
            <p>You have <strong>{loyalty.points}</strong> point{loyalty.points === 1 ? '' : 's'} ({money(loyalty.points * LOYALTY.penceValue)}).</p>
            {canRedeem ? (
              <label className={`field ${errors.redeemPoints || t.redeemError ? 'has-error' : ''}`}>
                <span>Points to spend (1 point = {LOYALTY.penceValue}p)</span>
                <input type="number" min="0" max={t.maxRedeem} step="1" value={redeem}
                  onChange={(e) => setRedeem(e.target.value === '' ? 0 : Number(e.target.value))} />
                <div className="row">
                  <button type="button" className="btn btn-sm" onClick={() => setRedeem(0)}>None</button>
                  <button type="button" className="btn btn-sm" onClick={() => setRedeem(t.maxRedeem)}>Use maximum ({t.maxRedeem})</button>
                </div>
                {(errors.redeemPoints || t.redeemError) && <small className="error">{errors.redeemPoints || t.redeemError}</small>}
              </label>
            ) : (
              <p className="muted">You can spend points once you've collected {LOYALTY.minBalanceToRedeem}. {LOYALTY.minBalanceToRedeem - loyalty.points} to go.</p>
            )}
          </section>

          <section className="panel">
            <h3>Order summary</h3>
            {lines.map((l) => <div key={l.id} className="row-between"><span>{l.qty} × {l.name}</span><span>{money(l.pricePence * l.qty)}</span></div>)}
            <div className="summary">
              <div><span>Groceries</span><span>{money(t.subtotal)}</span></div>
              <div><span>Delivery</span><span>{t.delivery ? money(t.delivery) : 'Free'}</span></div>
              {t.discount > 0 && <div><span>Loyalty points ({t.redeemed})</span><span>−{money(t.discount)}</span></div>}
              <div className="total"><span>Total</span><span>{money(t.total)}</span></div>
            </div>
            <p className="earn">⭐ You'll earn {t.earned} point{t.earned === 1 ? '' : 's'} (on {money(Math.floor(t.total / 100) * 100)}).</p>
            {serverError && <p className="error" role="alert">{serverError}</p>}
            <button className="btn btn-primary btn-block" form="checkout" disabled={submitting || Boolean(t.redeemError)}>
              {submitting ? 'Placing order…' : `Place order · ${money(t.total)}`}
            </button>
            <small className="muted">Payment is not taken in this demo; pay on delivery.</small>
          </section>
        </div>
      </div>
    </div>
  );
}
