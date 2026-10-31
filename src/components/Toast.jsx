import { useApp } from '../context/AppContext';

export default function Toast() {
  const { toast } = useApp();
  return toast ? <div className="toast" role="status">{toast}</div> : null;
}
