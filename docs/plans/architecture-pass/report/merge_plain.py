"""Merge the plain-words overlays into the page data, then rebuild the page.

Overlays (written by the page-consistency workflow's editors, in ../consistency/):
  2026-11-01-plain-cards-a.json, 2026-11-01-plain-cards-b.json:
    {"cards": [{"id": "C1", "shapeChange": "...", "atAShow": "...", "whyItHappens": "...",
                "designTerms": "...", "after": {"note": "...", "mermaid": "..."}, "standaloneLine": "..."}]}
  2026-11-01-plain-jobs.json:
    {"jobs": [{"id": "J1", "functional": {...}, "goal": "...", "standalone": "...", "shapeChange": "..."}]}
A field that is absent is left as it is. Run: python3 -I merge_plain.py   (from any directory)
"""
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
CONS = HERE.parent / 'consistency'
CARDS, JOBS, SA = HERE / '2026-10-31-cause-cards.json', HERE / '2026-10-31-engine-jobs.json', HERE / '2026-10-31-standalone-lines.json'


def load(p):
    return json.loads(p.read_text())


def save(p, d):
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + '\n')


cards, jobs, sa = load(CARDS), load(JOBS), load(SA)
by = {c['id']: c for c in cards['cards']}
jb = {j['id']: j for j in jobs['jobs']}
done = []
for name in ('2026-11-01-plain-cards-a.json', '2026-11-01-plain-cards-b.json'):
    for oc in load(CONS / name)['cards']:
        c = by[oc['id']]
        for f in ('shapeChange', 'atAShow', 'whyItHappens', 'designTerms'):
            if oc.get(f):
                c[f] = oc[f]
        for f in ('note', 'mermaid'):
            if (oc.get('after') or {}).get(f):
                c['after'][f] = oc['after'][f]
        if oc.get('standaloneLine'):
            if not oc['standaloneLine'].lower().startswith('in a standalone game:'):
                sys.exit(f'{oc["id"]}: standalone line must start "In a standalone game:"')
            sa['lines'][oc['id']] = oc['standaloneLine']
        done.append(oc['id'])
for oj in load(CONS / '2026-11-01-plain-jobs.json')['jobs']:
    j = jb[oj['id']]
    if oj.get('functional'):
        j['functional'].update({k: v for k, v in oj['functional'].items() if k in ('people', 'moment', 'need', 'proposedTitle')})
    for f in ('goal', 'standalone', 'shapeChange'):
        if oj.get(f):
            j[f] = oj[f]
    done.append(oj['id'])
missing = [x for x in list(by) + list(jb) if x not in done]
save(CARDS, cards)
save(JOBS, jobs)
save(SA, sa)
print(f'merged {len(done)} entries; not in any overlay: {missing or "none"}')
out = subprocess.run([sys.executable, '-I', str(HERE / 'build_report.py')], capture_output=True, text=True)
print(out.stdout.strip() or out.stderr.strip())
sys.exit(out.returncode)
