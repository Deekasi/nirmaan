import { useEffect, useState } from "react";
import type { ResearchMethod, Source } from "./api";

/** Renders text with [n] citations as small links to the numbered sources. */
export function Cited({ text, sources }: { text: string; sources: Source[] }) {
  const parts = (text ?? "").split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part);
        if (!m) return <span key={i}>{part}</span>;
        const src = sources.find((s) => s.id === Number(m[1]));
        if (!src) return null; // drop citations that don't match a real source
        return (
          <sup key={i} className="cite">
            <a href={src.url} target="_blank" rel="noreferrer" title={src.title}>[{src.id}]</a>
          </sup>
        );
      })}
    </>
  );
}

const METHOD_LABEL: Record<ResearchMethod, string> = {
  web_search: "Live web research",
  ai_search: "AI web search",
  ai_knowledge: "AI knowledge only, no live sources",
  demo: "Demo data",
};

export function MethodBadge({ method, count }: { method: ResearchMethod; count: number }) {
  return (
    <span className={`method method--${method}`}>
      {METHOD_LABEL[method]}
      {count > 0 && ` from ${count} sources`}
    </span>
  );
}

/** Step list shown while the AI works. Steps advance on a timer; the request finishing ends it. */
export function Progress({ steps, note }: { steps: string[]; note?: string }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => Math.min(a + 1, steps.length - 1)), 7000);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="progress" role="status" aria-live="polite">
      <ol>
        {steps.map((s, i) => (
          <li key={s} className={i < active ? "done" : i === active ? "active" : ""}>{s}</li>
        ))}
      </ol>
      {note && <p className="muted">{note}</p>}
    </div>
  );
}

export function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div className="block">
      <h3>Sources</h3>
      <ol className="sources">
        {sources.map((s) => (
          <li key={s.id}>
            <b>[{s.id}]</b>
            <span><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> <small>{s.domain}</small></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
