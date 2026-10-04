import { useId, useState } from "react";

/** Password input with a show/hide button. */
export function PasswordField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <div className="password">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          required
          minLength={props.minLength}
          autoComplete={props.autoComplete}
        />
        <button
          type="button"
          className="password__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.5 9.5 0 0112 5c5 0 9 4.5 10 7-.4 1-1.2 2.3-2.4 3.5M6.6 6.6C4.5 8 3.1 10 2 12c1 2.5 5 7 10 7 1.7 0 3.3-.5 4.6-1.3" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
          )}
          <span>{visible ? "Hide" : "Show"}</span>
        </button>
      </div>
      {props.hint && <small className="muted">{props.hint}</small>}
    </div>
  );
}
