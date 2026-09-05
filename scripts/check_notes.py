"""Read-only Markdown checks. Run with Python 3.10+: python scripts/check_notes.py.

Checks local inline/reference/HTML links, fenced code blocks and subject counts.
Not a complete CommonMark parser: anchors, remote URLs, semantic accuracy and
code execution are intentionally outside its scope. Code samples are ignored.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SUPPORT = {"scripts", "docs", "study_summarize_prompt"}


def visible_lines(text: str):
    """Yield prose with original line numbers, plus an unclosed-fence marker."""
    fence = None
    for number, line in enumerate(text.splitlines(), 1):
        # Blockquote fences use the same rules after removing the quote prefix.
        line = re.sub(r"^(?: {0,3}> ?)+", "", line)
        match = re.match(r"^\s*(`{3,}|~{3,})(.*)$", line)
        if match:
            marker, tail = match.groups()
            if fence is None:
                fence = (marker[0], len(marker), number)
            elif marker[0] == fence[0] and len(marker) >= fence[1] and not tail.strip():
                fence = None
            continue
        if fence is None and not line.startswith(("    ", "\t")):
            yield number, re.sub(r"(`+).*?\1", "", line)
    if fence:
        yield fence[2], None


def destinations(line: str):
    # Angle-bracket destinations may contain spaces; bare destinations allow
    # balanced parentheses (common in exported image names).
    for match in re.finditer(r"\]\(\s*(<[^>]*>|[^\n]*)", line):
        raw = match.group(1)
        if raw.startswith("<"):
            yield raw[1:raw.index(">")]
            continue
        depth = 0
        result = []
        escaped = False
        for char in raw:
            if escaped:
                result.append(char)
                escaped = False
                continue
            if char == "\\":
                escaped = True
                continue
            if char == "(":
                depth += 1
            elif char == ")":
                if depth == 0:
                    break
                depth -= 1
            elif char.isspace() and depth == 0:
                break
            result.append(char)
        if result:
            yield "".join(result)
    reference = re.match(r'^\s*\[[^\]]+\]:\s*(<[^>]*>|\S+)', line)
    if reference:
        yield reference.group(1).strip("<>")
    for match in re.finditer(r'''<(?:img|a)\b[^>]*?\b(?:src|href)=["']([^"']+)["']''', line, re.I):
        yield match.group(1)


def inspect(path: Path):
    issues = []
    links = 0
    for number, line in visible_lines(path.read_text(encoding="utf-8-sig")):
        if line is None:
            issues.append((number, "unclosed-fence", ""))
            continue
        for dest in destinations(line):
            if dest.startswith(("#", "//")):
                continue
            if re.match(r"^[A-Za-z]:[/\\]", dest):
                issues.append((number, "machine-local-link", dest))
                continue
            parts = urlsplit(dest)
            if parts.scheme:
                if parts.scheme == "file":
                    issues.append((number, "machine-local-link", dest))
                continue
            local = unquote(parts.path)
            if not local:
                continue
            links += 1
            target = (ROOT / local.lstrip("/")) if local.startswith("/") else path.parent / local
            if not target.exists():
                issues.append((number, "missing-local-link", dest))
    return links, issues


def main():
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT, check=True, capture_output=True,
    )
    files = sorted({name for name in result.stdout.decode("utf-8").split("\0") if name.endswith(".md")})
    counts = Counter()
    issues = []
    links = 0
    for name in files:
        path = ROOT / name
        if not path.is_file():
            continue
        relative = Path(name)
        if len(relative.parts) > 1 and relative.parts[0] not in SUPPORT and path.name.lower() != "readme.md":
            counts[relative.parts[0]] += 1
        checked, found = inspect(path)
        links += checked
        issues.extend({"file": name, "line": n, "kind": kind, "target": dest} for n, kind, dest in found)
    readme = (ROOT / "README.md").read_text(encoding="utf-8-sig")
    for subject, count in counts.items():
        row = re.search(r"^\| \[[^\]]+\]\(\./" + re.escape(subject) + r"\) \|.*?\| (\d+) \|$", readme, re.M)
        if row is None or int(row.group(1)) != count:
            issues.append({"file": "README.md", "line": 1, "kind": "subject-count-mismatch", "target": subject})
    total = re.search(r"현재 총 \*\*(\d+)개의 학습 노트", readme)
    if total is None or int(total.group(1)) != sum(counts.values()):
        issues.append({"file": "README.md", "line": 1, "kind": "total-count-mismatch", "target": str(sum(counts.values()))})
    report = {"markdown_files": len(files), "learning_notes": sum(counts.values()),
              "by_subject": dict(sorted(counts.items())), "local_links_checked": links,
              "issues": issues}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if issues else 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
