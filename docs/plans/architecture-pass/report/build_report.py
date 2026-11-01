"""Build the owner-facing page for step 1, around the engine's jobs (decision 26).

Inputs: 2026-10-31-engine-jobs.json (the jobs, from the engine-jobs workflow),
        2026-10-31-cause-cards.json (one card per design flaw, with diagrams),
        2026-10-31-standalone-lines.json (one standalone line per flaw),
        ../2026-10-31-standalone-pass.md (the ESP32 parity table).
Output: 2026-10-31-cause-report.html, published as an Artifact page (same URL as before).

Run: python3 -I build_report.py   (from any directory)
"""
import html
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
CARDS = HERE / '2026-10-31-cause-cards.json'
JOBS = HERE / '2026-10-31-engine-jobs.json'
OUT = HERE / '2026-10-31-cause-report.html'
STANDALONE = HERE / '2026-10-31-standalone-lines.json'
PASS = HERE.parent / '2026-10-31-standalone-pass.md'

# What each job already does today: the orchestrator's addition, from the root CLAUDE.md
# ("GM Scanner Admin Capabilities", "Event Architecture") and the capability map's "built" rows.
BUILT = {
    'J1': 'Packs that hold tokens, modes, scoring, groups and cues; a gate that refuses a broken pack; a second, toy game kept beside ALN.',
    'J2': 'One game record in the backend; a full snapshot to each screen when it connects; live updates for scores, transactions and player scans; the TV and Pi 4 scoreboards.',
    'J3': 'GM scans scored as transactions; player scans kept in the game record; an answer to every GM command; the post-game report and the session validator.',
    'J4': 'Video on the TV, music, sounds, lights, the Bluetooth speaker and audio routing; cues and timelines; the health dashboard; items held while a service is down.',
    'J5': 'Create, start, pause and end a game; Reset System; a game restored after an engine restart; the game clock.',
    'J6': 'The config tool; a store for drafting and publishing packs.',
    'J7': 'The GM password and its login token; a watch-only pass for the Pi 4 scoreboard; anonymous player scans.',
    'J8': 'Venue profiles and "not installed tonight"; standalone modes on the GM tablet and the web player scanner; the blue and green machine method.',
    'J9': 'Health words healthy, down and dormant (grey); held items; a first, minimal preflight.',
    'J10': 'Unit, contract, integration and end-to-end tests; the rung-1 test rig with real programs; CI on every pull request; coverage that may not fall.',
}

# Where a flaw lives: a card's module paths, sorted into the parts of the engine.
PARTS = [
    ('GM tablets', lambda p: p.startswith('ALNScanner/src') or p.startswith('ALNScanner/index') or p.startswith('ALNScanner/sw')),
    ('Scoreboards', lambda p: 'scoreboard' in p),
    ('Player scanners', lambda p: p.startswith('aln-memory-scanner') or p.startswith('arduino-cyd-player-scanner')),
    ('Game state', lambda p: any(k in p for k in ('sessionService', 'transactionService', 'stateService', 'models/', 'gameRules', 'websocket/', 'broadcasts', 'scanRoutes', 'adminEvents', 'systemReset', 'routes/'))),
    ('Show control', lambda p: any(k in p for k in ('vlc', 'music', 'audioRouting', 'lighting', 'bluetooth', 'sound', 'cueEngine', 'videoQueue', 'gameClock', 'serviceHealth', 'displayDriver', 'dbusSignal', 'mpd', 'commandExecutor', 'dormancy', 'processMonitor', 'ducking'))),
    ('Pack, config tool', lambda p: p.startswith('config-tool') or p.startswith('ALN-TokenData') or 'packService' in p or 'pack' in p.split('/')[-1].lower()),
    ('Tests', lambda p: '/tests/' in p or p.startswith('tests/') or p.startswith('.github')),
    ('Deployment', lambda p: any(k in p for k in ('DEPLOYMENT_GUIDE', 'ecosystem.config', '.gitmodules', 'scripts/', 'setup.sh', 'CLAUDE.md', 'package.json'))),
    ('Contracts', lambda p: 'contracts/' in p),
]

e = html.escape


OUTSIDE_NINE = {'C14', 'C15', 'C16'}  # the analysis: no question of the nine covers these


def chips(card):
    out = [f'<span class="chip">{card["findings"]} problems found</span>']
    q = card.get('questions') or []
    if card['id'] in OUTSIDE_NINE:
        text = 'No question covers it' + (f' (nearest: {q[0]})' if q else '')
    elif len(q) == 1:
        text = f'Question {q[0]}'
    else:
        text = 'Questions ' + ', '.join(map(str, q))
    out.append(f'<span class="chip">{text}</span>')
    if card.get('blueFixes'):
        out.append(f'<span class="chip">Clue from blue: fix {e(", ".join(card["blueFixes"]))}</span>')
    if card.get('seenLive'):
        out.append(f'<span class="chip live">Seen live</span>')
    return ''.join(out)


INIT = '%%{init: {"flowchart": {"useMaxWidth": false}, "sequence": {"useMaxWidth": false}}}%%'


def present(src):
    """Draw flowcharts top-down at natural size; the card scrolls a wide one in its own box."""
    lines = src.strip().split('\n')
    if lines[0].strip() == 'flowchart LR':
        lines[0] = 'flowchart TD'
    return INIT + '\n' + '\n'.join(lines)


def card_html(c):
    ex = ''.join(f'<li><span class="ids">{e(x["ids"])}</span> {e(x["text"])}</li>' for x in c['examples'])
    mods = ''.join(f'<code>{e(m)}</code>' for m in c['modules'])
    live = f'<p class="live-note"><span class="tag">Seen live</span> {e(c["seenLive"])}</p>' if c.get('seenLive') else ''
    sa = c.get('inStandalone', '')
    sa_html = f'<p class="standalone"><span class="tag">In a standalone game</span> {e(sa)}</p>' if sa else ''
    return f'''
<article class="card" id="{c["id"].lower()}">
  <header class="card-head">
    <span class="cid">{e(c["id"])}</span>
    <h3>{e(c["title"])}</h3>
    <div class="chips">{chips(c)}</div>
  </header>
  <div class="story">
    <p><span class="tag">At a show</span> {e(c["atAShow"])}</p>
    <p><span class="tag">Why it happens</span> {e(c["whyItHappens"])}</p>
    {live}
    {sa_html}
  </div>
  <div class="diagrams">
    <figure class="dia before">
      <figcaption>{e(c["before"]["caption"])}</figcaption>
      <div class="scroll"><pre class="mermaid">{e(present(c["before"]["mermaid"]))}</pre></div>
    </figure>
    <figure class="dia after">
      <figcaption>{e(c["after"]["caption"])}</figcaption>
      <div class="scroll"><pre class="mermaid">{e(present(c["after"]["mermaid"]))}</pre></div>
      <p class="after-note">{e(c["after"]["note"])}</p>
    </figure>
  </div>
  <p class="design"><span class="tag">In design terms</span> {e(c["designTerms"])}</p>
  <details>
    <summary>The problems behind it, and the code they live in</summary>
    <ul class="examples">{ex}</ul>
    <div class="mods">{mods}</div>
  </details>
</article>'''


def grid_html(cards):
    head = ''.join(f'<th scope="col"><span>{e(name)}</span></th>' for name, _ in PARTS)
    rows = []
    for c in cards:
        cells = []
        for _, match in PARTS:
            hit = any(match(m) for m in c['modules'])
            cells.append('<td class="dot" aria-label="yes">●</td>' if hit else '<td></td>')
        rows.append(f'<tr><th scope="row"><a href="#{c["id"].lower()}">{e(c["id"])}</a> {e(c["title"])}</th>{"".join(cells)}</tr>')
    return f'<div class="tablewrap"><table class="grid"><thead><tr><th scope="col">Design flaw</th>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>'


SET_ASIDE = [
    ('Already fixed in this tree', 7, 'Report cells escaped; the health word "dormant" in both contracts and on the tablet; the harness-minimum review items; a routing snapshot guard; the environment template\'s bus variables (green\'s follow-ups).'),
    ('Plain fixes for phase 2', 5, 'A name like "constructor" read as a real key in plain-object lookups; the web scanner loading its QR library from the internet; a test helper that switches certificate checks off; standalone mode\'s red "Disconnected" pill.'),
    ('Code-structure notes, no game symptom', 2, 'A second wrapper for running programs in the kiosk driver; the sound panel written inline instead of by its own renderer.'),
    ('No fault', 2, 'Two equal snapshots sent on connect; planned config-tool functions not built yet.'),
    ('A question for you', 1, 'A rejected or duplicate GM scan is recorded nowhere. This became question 19.'),
    ('Documents', 4, 'Plans, briefs and two CLAUDE.md files that disagree with the code. Decision 20: documents are fixed as we go.'),
]


def parity_rows():
    import re
    text = PASS.read_text()
    sec = text.split('## 4. The ESP32 parity gap')[1].split('\n## 5.')[0]
    rows = []
    for line in sec.splitlines():
        m = re.match(r'^\| (\d+) \| (.*) \|\s*$', line)
        if not m:
            continue
        cells = [c.strip() for c in m.group(2).split(' | ')]
        if len(cells) != 4:
            continue
        clean = []
        for c in cells:
            c = re.sub(r'\s*\((?:[^()]|\([^()]*\))*`[^)]*\)', '', c)   # drop "(file:line)" citations
            c = c.replace('`', '').replace(' *', '').strip()
            clean.append(c)
        weak = cells[1].endswith('*') or cells[2].endswith('*')
        rows.append((m.group(1), clean, weak))
    return rows


def parity_html():
    body = ''.join(
        f'<tr{" class=both-weak" if weak else ""}><td class="num">{n}</td><th scope="row">{e(c[0])}</th><td>{e(c[1])}</td><td>{e(c[2])}</td><td>{e(c[3])}</td></tr>'
        for n, c, weak in parity_rows())
    return ('<div class="tablewrap"><table class="parity"><thead><tr><th>#</th><th>Behaviour</th>'
            '<th>Web scanner, standalone</th><th>ESP32, no engine</th><th>What the ESP32 would need (candidate)</th>'
            f'</tr></thead><tbody>{body}</tbody></table></div>')


def glance_html(jobs):
    rows = []
    for j in jobs:
        prim = ' '.join(f'<a href="#{f["id"].lower()}">{e(f["id"])}</a>' if f['id'] != 'N1' else 'N1' for f in j['flaws'] if f['primary']) or '<span class="muted">none yet</span>'
        sec = ' '.join(f['id'] for f in j['flaws'] if not f['primary'])
        rows.append(f'<tr><th scope="row"><a href="#{j["id"].lower()}">{e(j["id"])}</a> {e(j["title"])}</th><td>{prim}</td><td class="muted">{e(sec)}</td></tr>')
    return ('<div class="tablewrap"><table class="glance"><thead><tr><th>Job</th><th>Flaws that mainly block it</th><th>Also touched by</th></tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table></div>')


def job_html(j, by_id, home):
    roles = ''.join(f'<span class="chip role">{e(r)}</span>' for r in j['roles'])
    needs = ''.join(f'<li>{e(n)}</li>' for n in j['needs'])
    tests = ''.join(f'<li>{e(t)}</li>' for t in j['tests'])
    shorts = []
    for f in j['flaws']:
        fid = f['id']
        if f['primary']:
            link = f'<a class="fid" href="#{fid.lower()}">{e(fid)}</a>' if fid in by_id else f'<span class="fid">{e(fid)}</span>'
            shorts.append(f'<li>{link}{e(f["how"])}</li>')
        else:
            where = home.get(fid, '')
            note = f' <span class="muted">(its card is under {e(where)})</span>' if where else ''
            shorts.append(f'<li class="secondary"><span class="fid">{e(fid)}</span>{e(f["how"])}{note}</li>')
    goal_tag = 'The long-term goal' + (' <span class="open">(open for step 3)</span>' if j.get('goalOpen') else '')
    q = j.get('questions') or []
    qtext = ('Answers the pass\'s question' + ('s ' if len(q) > 1 else ' ') + ', '.join(map(str, q))) if q else 'No question of the nine covers it yet'
    cards = ''.join(card_html(by_id[f['id']]) for f in j['flaws'] if f['primary'] and f['id'] in by_id)
    return f'''
<section class="job" id="{j["id"].lower()}">
  <header class="job-head">
    <span class="jid">{e(j["id"])}</span>
    <h2>{e(j["title"])}</h2>
    <p class="meaning">{e(j["meaning"])}</p>
    <div class="chips">{roles}</div>
  </header>
  <div class="job-facts">
    <div><span class="tag">Built today</span><p>{e(BUILT.get(j["id"], ""))}</p></div>
    <div><span class="tag">{goal_tag}</span><p>{e(j["goal"])}</p></div>
  </div>
  <div class="short">
    <span class="tag">Where today's design falls short</span>
    <ul>{"".join(shorts) or '<li class="muted">No flaw has this as its main job yet: its planned parts are not built.</li>'}</ul>
  </div>
  <p class="standalone"><span class="tag">In a standalone game</span> {e(j["standalone"])}</p>
  <details><summary>What the planned capabilities need from it ({len(j["needs"])})</summary><ul class="examples">{needs}</ul></details>
  <details><summary>Test cases from the shows ({len(j["tests"])}); {e(qtext)}</summary><ol class="examples">{tests}</ol></details>
  {cards}
</section>'''


def build():
    cards = json.loads(CARDS.read_text())['cards']
    lines = json.loads(STANDALONE.read_text())['lines']
    for c in cards:
        t = lines.get(c['id'], '')
        c['inStandalone'] = t.split(':', 1)[1].strip() if t.lower().startswith('in a standalone game:') else t
    by_id = {c['id']: c for c in cards}
    assert len(by_id) == 16, f'expected 16 cards, got {len(by_id)}'
    data = json.loads(JOBS.read_text())
    jobs = data['jobs']
    home = {f['id']: j['id'] for j in jobs for f in j['flaws'] if f['primary']}
    missing = [c for c in by_id if c not in home]
    assert not missing, f'flaws with no main job: {missing}'
    total = sum(c['findings'] for c in cards)
    aside = ''.join(f'<tr><th scope="row">{e(k)}</th><td class="num">{n}</td><td>{e(t)}</td></tr>' for k, n, t in SET_ASIDE)
    aside_n = sum(n for _, n, _ in SET_ASIDE)
    purpose = ''.join(f'<p>{e(x)}</p>' for x in data['purpose'])
    page = TEMPLATE.format(
        total=total, total_all=total + aside_n, aside_n=aside_n, purpose=purpose,
        glance=glance_html(jobs), jobs=''.join(job_html(j, by_id, home) for j in jobs),
        grid=grid_html(sorted(cards, key=lambda c: int(c['id'][1:]))),
        aside=aside, parity=parity_html(), parity_n=len(parity_rows()))
    OUT.write_text(page)
    print(f'wrote {OUT} ({len(page)} bytes, {len(jobs)} jobs, {len(cards)} flaw cards)')


TEMPLATE = '''<title>What the Engine Must Do</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans+Condensed:wght@500;600&display=swap">
<style>
/* Layout: one reading column; the engine's jobs lead, each job holding the design flaws that keep it from being done well; evidence and questions at the end. */
:root {{
  --bg: #f4f6f5; --surface: #ffffff; --fg: #17201e; --muted: #5b6965; --line: #d5dddb;
  --accent: #0f766e; --fault: #c2261f; --chip: #e7eeec; --chip-live: #fbe9e7;
  --font-body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-label: "IBM Plex Sans Condensed", "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg: #101614; --surface: #17201e; --fg: #e6ecea; --muted: #9babA6; --line: #2a3633;
  --accent: #4db6aa; --fault: #ff6f61; --chip: #22302c; --chip-live: #3a2220; color-scheme: dark; }} }}
:root[data-theme="dark"] {{
  --bg: #101614; --surface: #17201e; --fg: #e6ecea; --muted: #9babA6; --line: #2a3633;
  --accent: #4db6aa; --fault: #ff6f61; --chip: #22302c; --chip-live: #3a2220; color-scheme: dark; }}
body {{ background: var(--bg); color: var(--fg); font-family: var(--font-body); font-size: 16px; line-height: 1.55; }}
.wrap {{ max-width: 1040px; margin: 0 auto; padding-block: 40px 72px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; grid-template-columns: minmax(0, 1fr); gap: 40px; }}
h1, h2, h3 {{ text-wrap: balance; line-height: 1.2; margin: 0; }}
h1 {{ font-size: clamp(30px, 5vw, 44px); font-weight: 600; letter-spacing: -0.01em; }}
h2 {{ font-size: 24px; font-weight: 600; }}
h3 {{ font-size: 19px; font-weight: 600; }}
p {{ margin: 0; }}
a {{ color: var(--accent); }}
a:focus-visible, summary:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 2px; }}
.eyebrow, .tag, figcaption, .grid th span {{ font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; font-weight: 600; color: var(--muted); }}
.muted {{ color: var(--muted); }}
.lead {{ font-size: 18px; max-width: 68ch; }}
header.top {{ display: grid; gap: 14px; }}
.decide {{ border: 1px solid var(--line); border-left: 4px solid var(--accent); background: var(--surface); border-radius: 6px; padding: 18px 20px; display: grid; gap: 10px; }}
.decide p {{ max-width: 72ch; }}
.howto {{ display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); }}
.howto > div {{ display: grid; gap: 8px; align-content: start; }}
.legend {{ display: flex; flex-wrap: wrap; gap: 10px 18px; font-size: 14px; }}
.sw {{ display: inline-block; width: 22px; height: 14px; border-radius: 3px; border: 3px solid var(--fault); vertical-align: -2px; margin-right: 6px; }}
.sw.owner {{ border-color: var(--accent); }}
dl.terms {{ display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; margin: 0; font-size: 15px; }}
dl.terms dt {{ font-weight: 600; }}
dl.terms dd {{ margin: 0; color: var(--muted); }}
.toc {{ margin: 0; padding-left: 20px; display: grid; gap: 4px; }}
.tablewrap {{ overflow-x: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }}
table {{ border-collapse: collapse; width: 100%; font-size: 14px; }}
.grid th, .grid td {{ border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: middle; }}
.grid thead th {{ white-space: normal; vertical-align: bottom; min-width: 64px; }}
.grid tbody th {{ font-weight: 400; min-width: 220px; }}
.grid tbody th a {{ font-family: var(--font-mono); font-weight: 500; text-decoration: none; margin-right: 4px; }}
.grid td.dot {{ color: var(--accent); text-align: center; font-size: 15px; }}
.family {{ display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px; }}
.intro {{ max-width: 72ch; color: var(--muted); font-size: 17px; }}
.card {{ background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 22px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; scroll-margin-top: 16px; }}
.wrap > *, .family > *, .card > * {{ min-width: 0; }}
.card-head {{ display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; align-items: baseline; }}
.cid {{ font-family: var(--font-mono); font-weight: 500; font-size: 15px; color: var(--accent); }}
.chips {{ grid-column: 2; display: flex; flex-wrap: wrap; gap: 6px; }}
.chip {{ font-family: var(--font-label); font-size: 13px; background: var(--chip); border-radius: 999px; padding: 2px 10px; }}
.chip.live {{ background: var(--chip-live); color: var(--fault); }}
.story {{ display: grid; gap: 10px; max-width: 76ch; }}
.story .tag, .design .tag, .live-note .tag {{ display: block; margin-bottom: 2px; }}
.diagrams {{ display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }}
figure.dia {{ margin: 0; border: 1px solid var(--line); border-radius: 6px; padding: 12px; display: grid; gap: 8px; align-content: start; min-width: 0; }}
figure.dia.after {{ border-style: dashed; }}
.scroll {{ overflow-x: auto; min-width: 0; }}
pre.mermaid {{ margin: 0; background: transparent; font-size: 13px; text-align: center; }}
.after-note {{ font-size: 14px; color: var(--muted); }}
.standalone {{ border-left: 3px solid var(--accent); padding-left: 12px; }}
.parity th, .parity td {{ border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; font-size: 14px; }}
.parity thead th {{ font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; color: var(--muted); }}
.parity tbody th {{ font-weight: 600; min-width: 9em; }}
.parity td {{ min-width: 12em; }}
.parity tr.both-weak td, .parity tr.both-weak th {{ background: var(--chip); }}
.sa-box {{ border: 1px solid var(--line); border-radius: 6px; background: var(--surface); padding: 18px 20px; display: grid; gap: 12px; }}
.sa-box p {{ max-width: 76ch; }}
.design {{ font-size: 15px; max-width: 80ch; border-top: 1px solid var(--line); padding-top: 14px; }}
details summary {{ cursor: pointer; font-size: 15px; color: var(--accent); }}
details[open] summary {{ margin-bottom: 10px; }}
.examples {{ margin: 0 0 12px; padding-left: 18px; display: grid; gap: 6px; font-size: 15px; }}
.ids {{ font-family: var(--font-mono); font-size: 13px; color: var(--muted); margin-right: 4px; }}
.mods {{ display: flex; flex-wrap: wrap; gap: 6px; }}
.mods code {{ font-family: var(--font-mono); font-size: 12.5px; background: var(--chip); border-radius: 4px; padding: 2px 6px; overflow-wrap: anywhere; }}
.aside th, .aside td {{ border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }}
.aside th {{ font-weight: 600; min-width: 9em; }}
.num {{ font-variant-numeric: tabular-nums; text-align: right; }}
.questions {{ display: grid; gap: 20px; }}
.q {{ background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 6px; padding: 18px 20px; display: grid; gap: 10px; }}
.q ol {{ margin: 0; padding-left: 22px; display: grid; gap: 6px; }}
.q .rec {{ font-weight: 500; }}
footer {{ font-size: 14px; color: var(--muted); display: grid; gap: 6px; }}
footer code {{ font-family: var(--font-mono); font-size: 13px; }}
.job {{ display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; padding-top: 8px; border-top: 2px solid var(--line); scroll-margin-top: 16px; }}
.job > * {{ min-width: 0; }}
.job-head {{ display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; align-items: baseline; }}
.jid {{ font-family: var(--font-mono); font-weight: 500; font-size: 17px; color: var(--accent); }}
.job-head .meaning {{ grid-column: 2; font-size: 17px; max-width: 74ch; }}
.job-head .chips {{ grid-column: 2; }}
.chip.role {{ background: transparent; border: 1px solid var(--line); }}
.job-facts {{ display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }}
.job-facts > div {{ background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px; display: grid; gap: 6px; align-content: start; }}
.open {{ color: var(--fault); font-weight: 600; }}
.short {{ display: grid; gap: 8px; }}
.short ul {{ margin: 0; padding-left: 18px; display: grid; gap: 6px; }}
.short li {{ max-width: 80ch; }}
.fid {{ font-family: var(--font-mono); font-weight: 500; margin-right: 6px; }}
.secondary {{ color: var(--muted); }}
.glance td, .glance th {{ border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }}
.glance tbody th {{ font-weight: 500; min-width: 15em; }}
.glance a {{ text-decoration: none; }}
.qgroup {{ display: grid; gap: 14px; }}
.qgroup h3 {{ font-size: 17px; color: var(--muted); font-weight: 600; }}
.q .applied {{ font-family: var(--font-label); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); }}
@media (prefers-reduced-motion: reduce) {{ * {{ scroll-behavior: auto; }} }}
</style>
<div class="wrap">
<header class="top">
  <p class="eyebrow">Architecture pass · phase 1, step 1 · rebuilt around the engine's jobs · 2026-11-01</p>
  <h1>What the engine must do</h1>
  <p class="lead">The engine runs shows for any game, not only ALN. This page starts from its ten jobs: what each job means for any game, what is built today, the long-term goal, and where today's design falls short. The problems from blue's shows appear as evidence and as test cases, not as the plan.</p>
</header>

<section class="decide" aria-labelledby="deciding">
  <h2 id="deciding">What you are deciding</h2>
  <p><strong>The jobs.</strong> Are these the right ten jobs for the engine, and is one missing? Seven small questions, A to G, ask about their wording and whether three of them should split.</p>
  <p><strong>Standalone games, the game's record, the next step.</strong> Three questions about games with no engine, one about recording refused scans, and one about how much the test rig proves before design starts. Everything is <a href="#your-questions">at the end</a>, each with a recommendation.</p>
</section>

<section class="sa-box" aria-labelledby="purpose">
  <h2 id="purpose">What the engine is for</h2>
  {purpose}
</section>

<section class="howto" aria-label="How to read this page">
  <div>
    <h2>How to read a job</h2>
    <p>Each job says what it means for any game and who relies on it, then what is built today and the long-term goal. Under it sit the design flaws that keep it from being done well, each with a card.</p>
    <p>A card tells one moment at a show, why it happens, and shows two diagrams. <strong>Today</strong> shows how the problem happens now. <strong>Candidate, not decided</strong> shows one way the design could remove it. Step 3 puts competing designs in front of you; nothing on the right is decided.</p>
    <div class="legend"><span><span class="sw"></span>where it goes wrong</span><span><span class="sw owner"></span>the one place that would own the fact</span></div>
  </div>
  <div>
    <h2>The design words</h2>
    <p>Each card ends with the reason restated in the words step 3 uses.</p>
    <dl class="terms">
      <dt>Module</dt><dd>Any part with an inside and an outside, from one function to the whole backend.</dd>
      <dt>Interface</dt><dd>Everything another part must know to use it.</dd>
      <dt>Seam</dt><dd>Where one part meets another, and where behaviour can be swapped.</dd>
      <dt>Deep, shallow</dt><dd>A deep module does a lot behind a small interface. A shallow one makes its callers know almost as much as it does.</dd>
      <dt>Locality</dt><dd>A fix in one place fixes it everywhere.</dd>
      <dt>Leverage</dt><dd>One module serving many callers.</dd>
    </dl>
  </div>
</section>

<section aria-labelledby="glance">
  <h2 id="glance">The ten jobs at a glance</h2>
  <p class="intro" style="margin:8px 0 14px">Each design flaw has one job it mainly blocks; its card sits there. Flaws also listed under other jobs point back to their card.</p>
  {glance}
</section>

{jobs}

<section class="sa-box" aria-labelledby="standalone">
  <h2 id="standalone">Standalone games</h2>
  <p>Your decision 22 adds a requirement: a whole game can run with no engine, the GM tablet and the player scanners each working alone, as a choice the game declares and never mixed. In a standalone game the GM tablet decides everything about the game (used tokens, scores, teams, the game's start, pause and end) from its own hand-kept copies of the engine's rules. Each player scanner decides only whether a token is known.</p>
  <p>Four design flaws cause no problem in a standalone game, four apply in part and eight in full. Each job and each card says what changes. The two biggest gaps: nothing says that a game is standalone, and every device shows the missing engine as a failure ("Offline" on the phone all night, red "DISCONNECTED" on the ESP32, "VIDEO UNAVAILABLE, Rescan later" for a video that can never play).</p>
  <details>
    <summary>The ESP32 against the web scanner with no engine: {parity_n} differences</summary>
    <p class="muted" style="margin:10px 0">Your parity rule says the two player scanners match wherever possible. Shaded rows are ones where both are weak, or the web scanner is the weaker side, so matching it would copy a gap.</p>
    {parity}
  </details>
</section>

<section aria-labelledby="evidence">
  <h2 id="evidence">The evidence</h2>
  <p class="intro" style="margin:8px 0 14px">{total_all} problems came from blue's records and the maps of today's engine; {total} of them sit under the design flaws above, and {aside_n} needed no change to the design. The standalone pass added 35 more, placed under the same flaws.</p>
  <div class="tablewrap"><table class="aside"><tbody>{aside}</tbody></table></div>
  <details style="margin-top:14px">
    <summary>Where each flaw lives in today's code</summary>
    <p class="muted" style="margin:10px 0">A dot means the flaw's problems sit in that part of the engine.</p>
    {grid}
  </details>
</section>

<section class="questions" id="your-questions" aria-labelledby="qhead">
  <h2 id="qhead">Your questions</h2>

  <div class="qgroup">
    <h3>About the jobs</h3>
    <div class="q">
      <h3>Are these the right ten jobs?</h3>
      <p>Is a job the engine must do for any game missing? Are two of them really one? This replaces question 17.</p>
    </div>
    <div class="q">
      <p class="applied">Applied, please confirm</p>
      <h3>A. J1 now says nothing in the engine assumes ALN, and every part of the kit runs the same version of the pack and says which.</h3>
      <p class="rec">Recommendation: keep both. The first is what lets other games run; the second is the job that design flaw C12 breaks.</p>
    </div>
    <div class="q">
      <p class="applied">Applied, please confirm</p>
      <h3>B. J7 now also covers who may do what, not only who sees what.</h3>
      <p>Starting, pausing and ending a game and changing scores stay with the GM, and the stored passwords and keys change before outsiders touch the system.</p>
      <p class="rec">Recommendation: agree.</p>
    </div>
    <div class="q">
      <p class="applied">Applied, please confirm</p>
      <h3>C. J8 now says a standalone game is a choice the game declares, never mixed.</h3>
      <p>These are your decision 22's words. With them, question 23 (is "nothing declares a game standalone" a flaw of its own) no longer changes any work: it is J8's main shortfall either way.</p>
      <p class="rec">Recommendation: agree, and drop question 23.</p>
    </div>
    <div class="q">
      <h3>D. Split J3 into "answer every action" and "keep the record of the night"?</h3>
      <p>Answering a scan or a command is one thing. Keeping the night's record for review, reports and capture is a large planned area of its own: capture, the session bundle, the Review stage.</p>
      <p class="rec">Recommendation: split. The record of the night is also where question 19 belongs.</p>
    </div>
    <div class="q">
      <h3>E. Split J8 into "fit the game to the venue" and "run in any setup"?</h3>
      <p>Fitting a game to a room is the venue installer's work: the profile, the bindings, the one preflight. Running in any setup is standalone games, other kits and the open-source release.</p>
      <p class="rec">Recommendation: split. The installer is one of the engine's five users and has no job of their own today.</p>
    </div>
    <div class="q">
      <h3>F. J10 holds four kinds of work. Split it?</h3>
      <ol type="a">
        <li>"Prove it works, away from the live show": tests that use the real path and never touch the show.</li>
        <li>"Keep every part in step": names two parts share, installed pieces that match, and a new version that reaches the show only when you say it is ready.</li>
      </ol>
      <p>None of the pass's nine questions covers this work today. This replaces question 18.</p>
      <p class="rec">Recommendation: split, and give each half a question of its own in the pass.</p>
    </div>
    <div class="q">
      <h3>G. Which job carries the equipment's state to every screen?</h3>
      <p>J2 keeps the game's record true everywhere. J4 runs the equipment and knows its state. Today the music or lights panel can stay wrong after a reconnect, and neither job's sentence says whose that is.</p>
      <p class="rec">Recommendation: J4. It keeps the game's record and the equipment's state apart, and matches the pass's question 2 (does a service's state travel with its health).</p>
    </div>
  </div>

  <div class="qgroup">
    <h3>About standalone games</h3>
    <div class="q">
      <h3>22. The ESP32 gets a standalone mode matching the web scanner's.</h3>
      <p>Recorded that way under your parity rule. Is that right?</p>
    </div>
    <div class="q">
      <h3>24. Does a standalone game run on one GM tablet?</h3>
      <p>Today two standalone tablets are two separate games. Several tablets sharing one game with no engine would need them to talk to each other directly, a large new piece.</p>
      <p class="rec">Recommendation: one tablet, unless you plan standalone games with two GMs.</p>
    </div>
    <div class="q">
      <h3>25. With no engine and no TV, what do exposed evidence and video tokens do?</h3>
      <p class="rec">Suggestion: exposed evidence shows on the GM tablet's own scoreboard screen, which standalone already has. A video token shows its picture with a plain note instead of an error.</p>
    </div>
  </div>

  <div class="qgroup">
    <h3>About the game's record</h3>
    <div class="q">
      <h3>19. When a GM scan is refused, does the game keep a record of the attempt?</h3>
      <p>For example, a token already used, or no game running. Today only the tablet that scanned hears about it.</p>
      <p class="rec">Recommendation: yes. Record every attempt and its answer, and show it nowhere until a feature needs it.</p>
    </div>
  </div>

  <div class="qgroup">
    <h3>About the next step</h3>
    <div class="q">
      <h3>21. How many problems should the test rig prove before design starts?</h3>
      <p>The test rig is the automated test machine with real video, music, audio and lighting stand-ins. On it a problem can be made to happen for real instead of read off the code. Phase 2 proves each problem anyway, because every area starts with its test failing on today's engine.</p>
      <p class="rec">Recommendation: one per design flaw, about 17 runs.</p>
    </div>
  </div>
  <p class="muted">Decided so far: 20 (no rule for documents; documents are fixed as we go), 22 (standalone games join the requirements; never mixed) and 26 (the pass designs the best engine for the long term; blue's problems are clues, not the plan).</p>
</section>

<footer>
  <p>Built from <code>docs/plans/architecture-pass/2026-10-31-engine-jobs.md</code> (the jobs; its check held 171 claims and corrected 53), the list of design flaws in <code>2026-10-30-cause-analysis.md</code> with its checks, and the standalone pass, <code>2026-10-31-standalone-pass.md</code>. "Built today" is the orchestrator's summary from the root <code>CLAUDE.md</code> and the capability map.</p>
</footer>
</div>
'''

if __name__ == '__main__':
    import sys
    if len(sys.argv) == 3:  # draft preview: build_report.py <cards.json> <out.html>
        CARDS, OUT = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    build()
