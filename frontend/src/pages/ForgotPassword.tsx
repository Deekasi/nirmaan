import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setSent((await api.forgotPassword(email)).message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="narrow">
      {sent ? (
        <section className="panel">
          <h1 className="h2">Check your email</h1>
          <p>{sent}</p>
          <p className="muted">The link expires in 30 minutes. Check your spam folder if you don't see it.</p>
          <Link to="/signin" className="btn btn--ghost" style={{ justifySelf: "start" }}>Back to sign in</Link>
        </section>
      ) : (
        <form className="panel" onSubmit={submit}>
          <h1 className="h2">Forgot your password?</h1>
          <p className="muted">Enter the email you signed up with, and we'll send you a link to choose a new password.</p>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn--primary btn--big" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          <Link to="/signin" className="btn btn--link">Back to sign in</Link>
        </form>
      )}
    </main>
  );
}
