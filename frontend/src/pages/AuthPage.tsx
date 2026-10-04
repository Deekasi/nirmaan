import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

const JOURNEY = [
  { title: "Research", body: "Who already does this, what users complain about, with links to every source." },
  { title: "Validate", body: "An honest go, pivot or rethink, with the reasons." },
  { title: "Plan", body: "Pick features for version one, see the stack, prepare for your viva." },
  { title: "Build", body: "Download a working starter project made for your idea." },
];

export default function AuthPage() {
  const { user, signIn } = useAuth();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = mode === "register" ? await api.register(email, name, password) : await api.login(email, password);
      signIn(res.access_token, res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth__plan blueprint">
        <div>
          <h1>Turn a rough idea into a project you can build and explain.</h1>
          <p className="lede" style={{ marginTop: "1rem" }}>
            Nirmaan researches your idea on the web, checks if it's worth building, and hands you a working starter project.
          </p>
        </div>
        <ol className="schematic">
          {JOURNEY.map((step, i) => (
            <li key={step.title}>
              <span className="schematic__box">{i + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="auth__side">
        <form className="auth__form" onSubmit={submit}>
          <h2>{mode === "signin" ? "Sign in" : "Create your account"}</h2>
          {mode === "register" && (
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
            {mode === "register" && <small className="muted">At least 8 characters.</small>}
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn--primary btn--big" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <button
            type="button"
            className="btn btn--link"
            onClick={() => {
              setMode(mode === "signin" ? "register" : "signin");
              setError("");
            }}
          >
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
