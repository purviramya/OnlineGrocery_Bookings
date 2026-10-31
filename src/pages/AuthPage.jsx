import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authClient } from '../services/auth-client';
import { getProviders } from '../services/api';
import { validateCredentials } from '../../shared/validation';

const SOCIAL = [
  { id: 'google', label: 'Google' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
];

// One page for both sign in and sign up; every method goes through Better Auth.
export default function AuthPage({ mode }) {
  const signUp = mode === 'signup';
  const navigate = useNavigate();
  const from = useLocation().state?.from ?? '/';
  const { data: session } = authClient.useSession();
  const [providers, setProviders] = useState({});
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { getProviders().then(setProviders).catch(() => {}); }, []);
  useEffect(() => { if (session) navigate(from, { replace: true }); }, [session]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = validateCredentials(form, { signUp });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    setServerError(null);
    const { error } = signUp
      ? await authClient.signUp.email({ name: form.name.trim(), email: form.email.trim(), password: form.password })
      : await authClient.signIn.email({ email: form.email.trim(), password: form.password });
    if (error) setServerError(error.message || 'Something went wrong. Please try again.');
    setSubmitting(false);
  };

  const social = (provider) => authClient.signIn.social({ provider, callbackURL: from });

  const field = (name, label, props = {}) => (
    <label className={`field ${errors[name] ? 'has-error' : ''}`}>
      <span>{label}</span>
      <input name={name} value={form[name]} onChange={onChange} {...props} />
      {errors[name] && <small className="error">{errors[name]}</small>}
    </label>
  );

  const missing = SOCIAL.some((p) => !providers[p.id]);
  return (
    <div className="container">
      <form className="panel auth-card" onSubmit={onSubmit} noValidate>
        <h1>{signUp ? 'Create your account' : 'Sign in'}</h1>
        {signUp && field('name', 'Full name', { autoComplete: 'name' })}
        {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
        {field('password', 'Password', { type: 'password', autoComplete: signUp ? 'new-password' : 'current-password' })}
        {serverError && <p className="error" role="alert">{serverError}</p>}
        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Please wait…' : signUp ? 'Sign up' : 'Sign in'}
        </button>
        {/* Always shown; a provider without credentials in .env is disabled, not hidden. */}
        <div className="divider">or</div>
        <div className="social">
          {SOCIAL.map((p) => (
            <button key={p.id} type="button" className="btn" disabled={!providers[p.id]}
              title={providers[p.id] ? '' : `Not configured: set ${p.id.toUpperCase()}_CLIENT_ID and ${p.id.toUpperCase()}_CLIENT_SECRET in .env`}
              onClick={() => social(p.id)}>
              Continue with {p.label}{!providers[p.id] && ' (not set up)'}
            </button>
          ))}
        </div>
        {missing && <small className="muted">Greyed-out options need their client ID and secret in <code>.env</code> (see README, "Social sign-in setup").</small>}
        <p className="muted" style={{ marginTop: 16 }}>
          {signUp ? <>Already have an account? <Link to="/signin" state={{ from }}>Sign in</Link></>
                  : <>New here? <Link to="/signup" state={{ from }}>Create an account</Link></>}
        </p>
      </form>
    </div>
  );
}
