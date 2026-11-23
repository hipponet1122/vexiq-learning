#!/usr/bin/env python3
"""產生 web/version.json（版本、Git 提交代號、建置時間、作者聯絡、更新紀錄）。部署腳本會自動執行。"""
import datetime
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent
TZ = datetime.timezone(datetime.timedelta(hours=8))  # Asia/Taipei


def git(*args):
    try:
        return subprocess.check_output(["git", *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def repo_url():
    u = git("remote", "get-url", "origin")
    m = re.match(r"^(?:git@github\.com:|https://github\.com/)(.+?)(?:\.git)?$", u)
    return "https://github.com/" + m.group(1) if m else ""


def changelog(limit=8):
    out, cur = [], None
    p = ROOT / "CHANGELOG.md"
    if not p.exists():
        return out
    for line in p.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^## (\S+) — (\d{4}-\d{2}-\d{2})", line)
        if m:
            cur = {"version": m.group(1), "date": m.group(2), "items": []}
            out.append(cur)
        elif cur is not None and line.startswith("### "):
            cur["items"].append({"h": line[4:].strip(), "lines": []})
        elif cur is not None and line.startswith("- ") and cur["items"]:
            cur["items"][-1]["lines"].append(line[2:].strip())
    return out[:limit]


now = datetime.datetime.now(TZ)
commit = git("rev-parse", "HEAD")
dirty = bool(git("status", "--porcelain"))
repo = repo_url()
info = {
    "name": "VEX IQ 自學",
    "version": (ROOT / "VERSION").read_text().strip(),
    "commit": commit,
    "commit_short": commit[:7],
    "branch": git("rev-parse", "--abbrev-ref", "HEAD"),
    "dirty": dirty,
    "commit_date": git("log", "-1", "--format=%cI"),
    "repo": repo,
    "repo_name": repo.replace("https://github.com/", ""),
    "commit_url": f"{repo}/commit/{commit}" if repo and commit else "",
    "built_at": now.strftime("%Y-%m-%d %H:%M:%S"),
    "built_at_iso": now.isoformat(timespec="seconds"),
    "timezone": "Asia/Taipei (UTC+8)",
    "author": {"name": "Elvis Huang", "email": "elvis@mingchhun.com"},
    "changelog": changelog(),
}
(ROOT / "web" / "version.json").write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"version {info['version']}  commit {info['commit_short'] or '(no git)'}{' (有未提交的修改)' if dirty else ''}  built {info['built_at']}")
