import { Link, NavLink } from 'react-router-dom';
import { APP } from '../../shared/config';
import { authClient } from '../services/auth-client';
import { useShop } from '../context/ShopContext';

export default function Header() {
  const { data: session } = authClient.useSession();
  const { count, loyalty } = useShop();
  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">{APP.emoji} {APP.name}</Link>
        <nav className="nav">
          <NavLink to="/" end>Shop</NavLink>
          <NavLink to="/basket">Basket{count > 0 && <span className="badge">{count}</span>}</NavLink>
          {session ? (
            <>
              <NavLink to="/orders">Orders</NavLink>
              <NavLink to="/loyalty">⭐ {loyalty?.points ?? 0}</NavLink>
              <span className="muted who">{session.user.name}</span>
              <button className="btn btn-sm" onClick={() => authClient.signOut()}>Sign out</button>
            </>
          ) : (
            <>
              <NavLink to="/signin">Sign in</NavLink>
              <NavLink to="/signup" className="btn btn-sm btn-primary">Sign up</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
