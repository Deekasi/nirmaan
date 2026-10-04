"""Quality gate for generated starter projects.

Runs real checks on the generated zip, like a small CI pipeline, and reports each step with
its timing. The frontend shows these as the build pipeline when a base project is ready.
"""
import ast
import io
import re
import time
import zipfile
from html.parser import HTMLParser

SECRET_PATTERNS = [
    re.compile(r"gsk_[A-Za-z0-9]{20,}"),           # Groq
    re.compile(r"tvly-[A-Za-z0-9-]{16,}"),         # Tavily
    re.compile(r"sk-[A-Za-z0-9]{20,}"),            # OpenAI-style
    re.compile(r"AIza[0-9A-Za-z_-]{30,}"),         # Google
    re.compile(r"AKIA[0-9A-Z]{16}"),               # AWS
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
]
LANG = {".py": "Python", ".html": "HTML", ".css": "CSS", ".md": "Markdown", ".txt": "Text", ".example": "Config"}
MAX_ZIP_BYTES = 1_000_000


class _HtmlCheck(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags: set[str] = set()
        self.viewport = False

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag)
        if tag == "meta" and dict(attrs).get("name") == "viewport":
            self.viewport = True


def _step(name: str, fn) -> dict:
    start = time.perf_counter()
    try:
        status, detail = fn()
    except Exception as e:  # a check crashing counts as a failure, not a server error
        status, detail = "fail", f"Check crashed: {e}"
    return {"name": name, "status": status, "detail": detail, "ms": round((time.perf_counter() - start) * 1000, 2)}


def verify_zip(data: bytes) -> dict:
    zf = zipfile.ZipFile(io.BytesIO(data))
    files = {n: zf.read(n).decode("utf-8", errors="replace") for n in zf.namelist() if not n.endswith("/")}
    root = next(iter(files)).split("/")[0] if files else ""

    def rel(path: str) -> str:
        return path[len(root) + 1:] if path.startswith(root + "/") else path

    def check_render():
        leftovers = [rel(n) for n, t in files.items() if "{{" in t and "}}" in t and not n.endswith(".md")]
        if leftovers:
            return "fail", f"Unrendered placeholders in {', '.join(leftovers)}"
        return "pass", f"{len(files)} files rendered from the template"

    def check_python():
        py = {n: t for n, t in files.items() if n.endswith(".py")}
        if not py:
            return "skip", "No Python files in this template"
        for n, t in py.items():
            try:
                ast.parse(t, filename=n)
            except SyntaxError as e:
                return "fail", f"{rel(n)} line {e.lineno}: {e.msg}"
        return "pass", f"{len(py)} Python file{'s' if len(py) > 1 else ''} parsed without errors"

    def check_html():
        pages = {n: t for n, t in files.items() if n.endswith(".html")}
        problems = []
        for n, t in pages.items():
            p = _HtmlCheck()
            p.feed(t)
            if "title" not in p.tags:
                problems.append(f"{rel(n)} has no <title>")
            if not p.viewport:
                problems.append(f"{rel(n)} isn't mobile-ready (no viewport tag)")
        if problems:
            return "warn", "; ".join(problems)
        return "pass", f"{len(pages)} page{'s' if len(pages) != 1 else ''} with title and mobile viewport"

    def check_secrets():
        for n, t in files.items():
            for pat in SECRET_PATTERNS:
                if pat.search(t):
                    return "fail", f"Possible secret in {rel(n)}"
        return "pass", f"No API keys or private keys in {len(files)} files"

    def check_deps():
        reqs = [t for n, t in files.items() if n.endswith("requirements.txt")]
        if not reqs:
            return "skip", "No Python dependencies"
        lines = [l.strip() for l in reqs[0].splitlines() if l.strip() and not l.startswith("#")]
        loose = [l for l in lines if "==" not in l]
        if loose:
            return "warn", f"Not pinned: {', '.join(loose)}"
        return "pass", f"All {len(lines)} dependencies pinned to exact versions"

    def check_ignore():
        gi = next((t for n, t in files.items() if n.endswith(".gitignore")), "")
        needed = [p for p in (".env", ".venv") if p not in gi]
        if needed:
            return "warn", f".gitignore is missing {', '.join(needed)}"
        return "pass", ".env and .venv are kept out of Git"

    def check_docs():
        readme = next((t for n, t in files.items() if n.endswith("README.md")), "")
        has_report = any(n.endswith("NIRMAAN_REPORT.md") for n in files)
        if "## Run it" not in readme or not has_report:
            return "warn", "README or project report is incomplete"
        return "pass", "README with run, GitHub and deploy steps, plus project report"

    def check_size():
        kb = len(data) / 1024
        if len(data) > MAX_ZIP_BYTES:
            return "warn", f"Package is {kb:.0f} KB"
        return "pass", f"Package is {kb:.1f} KB"

    steps = [
        _step("Render templates", check_render),
        _step("Python syntax", check_python),
        _step("HTML structure", check_html),
        _step("Secret scan", check_secrets),
        _step("Pinned dependencies", check_deps),
        _step("Git hygiene", check_ignore),
        _step("Documentation", check_docs),
        _step("Package", check_size),
    ]

    tree, by_lang = [], {}
    for n, t in sorted(files.items()):
        lines = t.count("\n") + (1 if t and not t.endswith("\n") else 0)
        ext = "." + n.rsplit(".", 1)[-1] if "." in n.rsplit("/", 1)[-1] else ""
        lang = LANG.get(ext, "Other")
        by_lang[lang] = by_lang.get(lang, 0) + lines
        tree.append({"path": rel(n), "lines": lines, "bytes": len(t.encode()), "lang": lang})

    counted = [s for s in steps if s["status"] != "skip"]
    return {
        "steps": steps,
        "passed": sum(s["status"] == "pass" for s in counted),
        "total": len(counted),
        "ship_ready": all(s["status"] != "fail" for s in steps),
        "files": tree,
        "lines_by_language": by_lang,
        "total_lines": sum(by_lang.values()),
    }
