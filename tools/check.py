#!/usr/bin/env python3
"""提交前／CI 自動檢查：簡體字、不該入庫的檔案、疑似金鑰。用法：python3 tools/check.py"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# 簡體字專用字（不含繁簡共用字）
SIMP = set("们这个来对说还时会过发开关问题门东车头长见现实际应该让节认识电脑习总结关键边续练绩态进执线类专业务岁录视频传显错误项试测参数综户")
SIMP -= set("們這個來對說還時會過發開關問題門東車頭長見現實際應該讓節認識電腦習總結關鍵邊續練績態進執線類專業務歲錄視頻傳顯錯誤項試測參數綜戶")
FORBIDDEN = re.compile(r"(^|/)(seed_users\.json|\.env|初始帳密\.txt|新密碼\.txt)$|\.sqlite3?$|\.iqblocks$|^data/|session\.key$")
SECRETS = re.compile(r"AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_|xox[bap]-|-----BEGIN [A-Z ]*PRIVATE KEY|\b(?:192\.168|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7]))\.\d+\.\d+\b")
TEXT_EXT = {".js", ".py", ".md", ".json", ".html", ".css", ".yml", ".yaml", ".txt", ".svg", ""}


def tracked():
    out = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True)
    return [f for f in out.splitlines() if f]


def main():
    problems = []
    for f in tracked():
        if FORBIDDEN.search(f):
            problems.append(f"不該入庫的檔案：{f}")
            continue
        p = ROOT / f
        if p.suffix not in TEXT_EXT or not p.is_file():
            continue
        try:
            t = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if f != "tools/check.py":
            hit = sorted(c for c in set(t) if c in SIMP)
            if hit:
                problems.append(f"{f}：疑似簡體字 {''.join(hit)}")
            for m in SECRETS.finditer(t):
                problems.append(f"{f}：疑似金鑰或內網位址 {m.group(0)[:12]}…")
    for p in problems:
        print("✗", p)
    print("通過" if not problems else f"共 {len(problems)} 個問題")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
