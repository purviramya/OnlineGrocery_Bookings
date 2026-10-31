import { Navigate, useLocation } from 'react-router-dom';
import { authClient } from '../services/auth-client';

export default function RequireAuth({ children }) {
  const { data: session, isPending } = authClient.useSession();
  const location = useLocation();
  if (isPending) return <div className="container"><p className="muted">Loading…</p></div>;
  if (!session) return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  return children;
}
