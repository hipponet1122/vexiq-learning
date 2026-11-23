#!/usr/bin/env python3
"""列出某區域還沒翻的字串：python3 tools/i18n_todo.py <area> [起始 數量]  →  輸出『雜湊|中文』，翻成『雜湊|English』存進 i18n/en/<area>.tsv"""
import json, sys, os, re, hashlib
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
H = lambda z: hashlib.md5(z.encode('utf-8')).hexdigest()[:6]
area = sys.argv[1]; start = int(sys.argv[2]) if len(sys.argv) > 2 else 0; cnt = int(sys.argv[3]) if len(sys.argv) > 3 else 10**9
src = json.load(open(os.path.join(ROOT, 'i18n/src', area + '.json'), encoding='utf-8'))
done = set()
import glob
for p in glob.glob(os.path.join(ROOT, 'i18n/en/*.tsv')):
    for ln in open(p, encoding='utf-8').read().split('\n'):
        m = re.match(r'^([0-9a-f]{6})[\t|]', ln)
        if m: done.add(m.group(1))
todo = [z for z in src if H(z) not in done]
print('#', area, '未翻', len(todo), file=sys.stderr)
for z in todo[start:start + cnt]: print(H(z) + '|' + z.replace('\n', '\\n'))
