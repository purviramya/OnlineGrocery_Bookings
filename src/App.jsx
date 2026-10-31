import { Link, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Toast from './components/Toast';
import Home from './pages/Home';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Loyalty from './pages/Loyalty';
import AuthPage from './pages/AuthPage';
import RequireAuth from './components/RequireAuth';
import { APP } from '../shared/config';

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/basket" element={<Cart />} />
          <Route path="/signin" element={<AuthPage mode="signin" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/loyalty" element={<RequireAuth><Loyalty /></RequireAuth>} />
          <Route path="*" element={<div className="container empty"><h2>Page not found</h2><Link to="/" className="btn">Go home</Link></div>} />
        </Routes>
      </main>
      <footer className="footer">© {new Date().getFullYear()} {APP.name} · 1 point per £1 · 100 points to unlock · 1 point = 1p</footer>
      <Toast />
    </>
  );
}
