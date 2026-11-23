#!/usr/bin/env python3
"""把 i18n/src/*.json（中文原文，工具擷取）與 i18n/en/*.tsv（編號<TAB>英文）合成 web/i18n-en.js。
   用法：python3 tools/i18n_build.py [--report]   （--report 只列出每個區域還沒翻的數量）"""
import json, sys, glob, os, re, hashlib
H = lambda z: hashlib.md5(z.encode('utf-8')).hexdigest()[:6]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
report = '--report' in sys.argv
dic, missing = {}, {}
allen = {}
for _p in glob.glob(os.path.join(ROOT, 'i18n/en/*.tsv')):
    for _ln in open(_p, encoding='utf-8').read().split('\n'):
        _m = re.match(r'^([0-9a-f]{6})[\t|](.*)$', _ln)
        if _m and _m.group(2).strip(): allen[_m.group(1)] = _m.group(2).replace('\\n', '\n')
for p in sorted(glob.glob(os.path.join(ROOT, 'i18n/src/*.json'))):
    area = os.path.basename(p)[:-5]
    src = json.load(open(p, encoding='utf-8'))
    tsv = os.path.join(ROOT, 'i18n/en', area + '.tsv')
    en = {}
    if os.path.exists(tsv):
        for ln in open(tsv, encoding='utf-8').read().split('\n'):
            if not ln.strip() or ln.startswith('#'): continue
            m = re.match(r'^([0-9a-f]{6})[\t|](.*)$', ln)
            if m: en[m.group(1)] = m.group(2).replace('\\n', '\n')
    miss = [z for z in src if H(z) not in allen]
    missing[area] = (len(miss), len(src))
    for zh in src:
        i = H(zh)
        if i in allen and allen[i].strip():
            raw = allen[i]
            if raw != raw.strip():
                dic[zh] = raw  # 翻譯本身有寫頭尾空白，就照它的
            else:
                lead = re.match(r'^\s*', zh).group(0); trail = re.search(r'\s*$', zh).group(0)
                dic[zh] = lead + raw + trail if zh.strip() != zh else raw
if report or True:
    tot = sum(a for a, _ in missing.values()); n = sum(b for _, b in missing.values())
    for k, (a, b) in missing.items(): print(f'{k:24} 未翻 {a:4} / {b:4}')
    print(f'合計 未翻 {tot} / {n}')
if not report:
    body = 'window.VX_EN = ' + json.dumps(dic, ensure_ascii=False, separators=(',', ':')) + ';\n'
    open(os.path.join(ROOT, 'web/i18n-en.js'), 'w', encoding='utf-8').write('/* 自動產生，請勿手改：tools/i18n_build.py */\n' + body)
    print('web/i18n-en.js', len(body), 'bytes,', len(dic), '條')
