import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { PasswordField } from "../PasswordField";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setDone((await api.resetPassword(token, password)).message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="narrow">
        <section className="panel">
          <h1 className="h2">This link is incomplete</h1>
          <p className="muted">Open the link from your email again, or ask for a new one.</p>
          <Link to="/forgot-password" className="btn btn--primary" style={{ justifySelf: "start" }}>Get a new link</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="narrow">
      {done ? (
        <section className="panel">
          <h1 className="h2">Password changed</h1>
          <p>{done} For safety, you've been signed out on other devices.</p>
          <Link to="/signin" className="btn btn--primary" style={{ justifySelf: "start" }}>Sign in</Link>
        </section>
      ) : (
        <form className="panel" onSubmit={submit}>
          <h1 className="h2">Choose a new password</h1>
          <PasswordField label="New password" value={password} onChange={setPassword} minLength={8} autoComplete="new-password" hint="At least 8 characters." />
          <PasswordField label="Type it again" value={confirm} onChange={setConfirm} minLength={8} autoComplete="new-password" />
          {error && (
            <p className="error" role="alert">
              {error} {error.includes("expired") && <Link to="/forgot-password">Get a new link</Link>}
            </p>
          )}
          <button className="btn btn--primary btn--big" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
        </form>
      )}
    </main>
  );
}
