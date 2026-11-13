"""RETIRED 2026-11-01. Version 7's builder, kept for the record only: the live builder is build_site.py,
which writes the five-page site (decision 29). The data files have moved on since version 7 (markers, new
fields), so this script no longer rebuilds version 7 faithfully; do not re-run it.

Build the owner-facing page for step 1, around the engine's ten promises (decisions 26 and 27).

Inputs: 2026-10-31-engine-jobs.json (the promises, first written as jobs by the engine-jobs workflow;
          reconciled with the engine shape on 2026-11-01),
        2026-10-31-cause-cards.json (one card per design flaw, with diagrams;
          reconciled with the engine shape on 2026-11-01),
        2026-10-31-standalone-lines.json (one standalone line per flaw),
        2026-11-01-engine-shape.json (how the promises fit together and the candidate
          parts, from the engine-shape workflow),
        ../2026-10-31-standalone-pass.md (the ESP32 parity table).
Output: 2026-10-31-cause-report.html, published as an Artifact page (same URL as before).

Run: python3 -I build_report.py   (from any directory)
"""
import html
import json
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
CARDS = HERE / '2026-10-31-cause-cards.json'
JOBS = HERE / '2026-10-31-engine-jobs.json'
OUT = HERE / '2026-10-31-cause-report.html'
STANDALONE = HERE / '2026-10-31-standalone-lines.json'
SHAPE = HERE / '2026-11-01-engine-shape.json'
PASS = HERE.parent / '2026-10-31-standalone-pass.md'

# Where each candidate part runs, in the owner's words.
RUNS_ON = {'backend': 'the engine', 'gm-tablet': 'GM tablets', 'player-devices': 'player scanners',
           'scoreboards': 'the scoreboards', 'config-tool': 'the config tool', 'tests': 'the tests',
           'gm-tablet-standin': ''}
NAMES = {}  # part id -> plain name, filled from the shape by build()

# What each promise already has today: the orchestrator's addition, from the root CLAUDE.md
# ("GM Scanner Admin Capabilities", "Event Architecture") and the capability map's "built" rows.
BUILT = {
    'J1': 'Packs that hold tokens, modes, scoring, groups and cues; a gate that refuses a broken pack; a second, toy game kept beside ALN.',
    'J2': 'One game record in the backend; a full snapshot to each screen when it connects; live updates for scores, transactions and player scans; the TV and Pi 4 scoreboards.',
    'J3': 'GM scans scored as transactions; player scans kept in the game record; an answer to every GM command; the post-game report and the session validator. Outside the engine, ALN\'s article writer, the Director Console, reads that report by hand.',
    'J4': 'Video on the TV, music, sounds, lights, the Bluetooth speaker and audio routing; cues and timelines; the health dashboard; items held while a service is down.',
    'J5': 'Create, start, pause and end a game; Reset System; a game restored after an engine restart; the game clock.',
    'J6': 'The config tool; a store for drafting and publishing packs.',
    'J7': 'The GM password and its login token; a watch-only pass for the Pi 4 scoreboard; anonymous player scans.',
    'J8': 'Venue profiles and "not installed tonight"; standalone modes on the GM tablet and the web player scanner; the blue and green machine method.',
    'J9': 'Health words healthy, down and dormant (grey) for each service on the health panel; a first, minimal preflight.',
    'J10': 'Unit, contract, integration and end-to-end tests; a rung-1 run with the real programs in CI, started by hand or by a change to its own files (the standing test rig was lost with the old container; step 2 rebuilds it); CI on every pull request to main; coverage that may not fall.',
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


SEQ_INIT = ('%%{init: {"sequence": {"useMaxWidth": true, "mirrorActors": false, "actorMargin": 22, "width": 112, '
            '"boxMargin": 6, "messageMargin": 26, "messageFontSize": 13, "noteFontSize": 12.5, "actorFontSize": 13}}}%%')


def present(src):
    """Draw flowcharts top-down at natural size; the card scrolls a wide one in its own box.
    Sequence diagrams are drawn compact, with no repeated row of participants at the bottom."""
    if src.strip().startswith('sequenceDiagram'):
        return SEQ_INIT + '\n' + src.strip()
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
  {changed_html(c.get("shapeChange", ""))}
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
  {part_row(c.get("parts", []), NAMES, "Removed by these parts of the candidate shape")}
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
        prim = ' '.join(f'<a href="#{f["id"].lower()}">{e(f["id"])}</a>' if f['id'] != 'N1' else 'N1 <span class="muted">(proposed)</span>' for f in j['flaws'] if f['primary']) or '<span class="muted">none yet</span>'
        sec = ' '.join(f['id'] for f in j['flaws'] if not f['primary'])
        parts = ', '.join(NAMES[p] for p in j.get('parts', []))
        rows.append(f'<tr><th scope="row"><a href="#{j["id"].lower()}">{e(TITLES[j["id"]])}</a></th><td>{prim}</td><td class="muted">{e(sec)}</td><td>{e(parts)}</td></tr>')
    return ('<div class="tablewrap"><table class="glance"><thead><tr><th>Promise</th><th>Design flaws that mainly break it</th><th>Also touched by</th><th>Parts that would keep it</th></tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table></div>')


def job_head(j):
    """The promise's title and what it means for the people who count on it (the engine shape, section 1; decision 27)."""
    fn = j.get('functional')
    if not fn:
        roles = ''.join(f'<span class="chip role">{e(r)}</span>' for r in j['roles'])
        return (f'<h2>{e(j["title"])}</h2>'
                f'<p class="meaning">{e(j["meaning"].replace("section 4 asks", "a question at the end of this page asks"))}</p>'
                f'<div class="chips">{roles}</div>')
    proposed = fn.get('proposedTitle')
    title = proposed or j['title']
    was = f'<p class="was">Earlier wording, as a job: “{e(j["title"])}”.</p>' if proposed and proposed != j['title'] else ''
    return (f'<p class="kind">Promise</p><h2>{e(title)}</h2>{was}'
            f'<p class="meaning">{e(fn["need"])}</p>'
            f'<dl class="who"><dt>Who</dt><dd>{e(fn["people"])}</dd><dt>When</dt><dd>{e(fn["moment"])}</dd></dl>')


def job_html(j, by_id, home):
    needs = ''.join(f'<li>{e(n)}</li>' for n in j['needs'])
    tests = ''.join(f'<li>{e(t)}</li>' for t in j['tests'])
    shorts = []
    for f in j['flaws']:
        fid = f['id']
        if f['primary']:
            link = f'<a class="fid" href="#{fid.lower()}">{e(fid)}</a>' if fid in by_id else f'<span class="fid">{e(fid)}</span>'
            shorts.append(f'<li>{link}{e(f["how"])}' + ('' if fid in by_id else ' <span class="muted">(proposed, question 23; it has no card)</span>') + '</li>')
        else:
            where = home.get(fid, '') if fid in by_id else ''
            note = f' <span class="muted">(its card is under {promise_link(where)})</span>' if where else ' <span class="muted">(proposed, question 23; it has no card)</span>'
            shorts.append(f'<li class="secondary"><span class="fid">{e(fid)}</span>{e(f["how"])}{note}</li>')
    goal_tag = 'The long-term goal' + (' <span class="open">(open for step 3)</span>' if j.get('goalOpen') else '')
    q = j.get('questions') or []
    qtext = ('Answers the pass\'s question' + ('s ' if len(q) > 1 else ' ') + ', '.join(map(str, q))) if q else 'No question of the nine covers it yet'
    cards = ''.join(card_html(by_id[f['id']]) for f in j['flaws'] if f['primary'] and f['id'] in by_id)
    return f'''
<section class="job" id="{j["id"].lower()}">
  <header class="job-head">
    {job_head(j)}
  </header>
  {changed_html(j.get("shapeChange", ""))}
  {part_row(j.get("parts", []), NAMES, "Kept by these parts of the candidate shape")}
  <div class="job-facts">
    <div><span class="tag">Built today</span><p>{e(BUILT.get(j["id"], ""))}</p></div>
    <div><span class="tag">{goal_tag}</span><p>{e(j["goal"])}</p></div>
  </div>
  <div class="short">
    <span class="tag">Design flaws that break it today</span>
    <ul>{"".join(shorts) or '<li class="muted">No design flaw breaks this promise mainly: its planned parts are not built yet.</li>'}</ul>
  </div>
  <p class="standalone"><span class="tag">In a standalone game</span> {e(re.sub(r"^In a standalone game:\s*", "", j["standalone"]))}</p>
  <details><summary>What the planned capabilities need from it ({len(j["needs"])})</summary><ul class="examples">{needs}</ul></details>
  <details><summary>Test cases from the shows ({len(j["tests"])}); {e(qtext)}</summary><ol class="examples">{tests}</ol></details>
  {cards}
</section>'''


TITLES = {}  # promise id -> its title, filled by build(); ids never reach the page (decision 27)


def promise_link(jid):
    return f'<a href="#{jid.lower()}">“{e(TITLES[jid])}”</a>'


def promise_links(ids):
    return '<br/>'.join(promise_link(i) for i in ids)


def flaw_links(ids):
    return ' '.join('N1' if i == 'N1' else f'<a href="#{i.lower()}">{e(i)}</a>' for i in ids)


def part_link(pid, names):
    return f'<a class="chip part" href="#{pid.lower()}">{e(names[pid])}</a>'


def part_row(pids, names, label):
    if not pids:
        return ''
    return f'<div class="partrow"><span class="tag">{e(label)}</span>{"".join(part_link(p, names) for p in pids)}</div>'


def changed_html(text):
    return f'<p class="changed"><span class="tag">Changed after the relationship map</span> {e(text)}</p>' if text else ''


def part_layers(shape):
    """Rows of parts, top row first: each part sits one row above the highest part it uses."""
    deps = {}
    for a, b in re.findall(r'^\s*(P\d+)\s*-->\s*(P\d+)\s*$', shape['partsMermaid'], re.M):
        deps.setdefault(a, set()).add(b)
    level = {}

    def lv(x, path=()):
        if x in path:
            raise SystemExit(f'cycle in the parts diagram at {x}')
        if x not in level:
            level[x] = 1 + max((lv(y, path + (x,)) for y in deps.get(x, ())), default=0)
        return level[x]

    ids = [p['id'] for p in shape['parts']]
    for i in ids:
        lv(i)
    top = max(level.values())
    used = {b for bs in deps.values() for b in bs}
    for i in ids:  # a part nothing uses sits on the top row, with the other outer parts
        if i not in used:
            level[i] = top
    return [[i for i in ids if level[i] == n] for n in range(top, 0, -1)]


# Which piece of shared work each part takes over (the shape's mechanisms, in their order; the eleventh,
# who decides when there is no engine, is a quality, not a part). Used for each part's "Today" line.
MECH_PART = ['P1', 'P6', 'P7', 'P11', 'P8', 'P10', 'P4', 'P13', 'P2', 'P16', None]
# Which promises each quality mainly keeps (the shape's qualities, in their order).
QUALITY_KEEPS = [['J9'], ['J10'], ['J1', 'J8'], ['J8'], ['J7']]
KEEPS = {}   # part id -> the promises it mainly keeps, from each promise's parts; filled by build()
TODAY = {}   # part id -> how its work is done today, from the shared work it takes over; filled by build()


def today_of(plain):
    """A shared-work entry is its definition, then how it is done today: keep the first sentence after the
    definition that speaks of today, alone."""
    sentences = [x.strip() for x in re.split(r'(?<=[.;])\s+(?=[A-Z])', plain) if x.strip()]
    rest = next((x for x in sentences[1:] if re.search(r'\btoday\b', x, re.I)), sentences[-1])
    if rest.startswith('Today '):   # the card's label already says "Today"
        rest = rest[6].upper() + rest[7:]
    return rest


def part_html(p):
    also = [j for j in p.get('jobs', []) if j not in KEEPS.get(p['id'], [])]
    runs = ', '.join(RUNS_ON.get(r, r) for r in p['runsOn'] if r != 'gm-tablet-standin')
    if 'gm-tablet-standin' in p['runsOn']:
        runs += '; in a standalone game, a small stand-in on the GM tablet'
    return f'''<article class="part" id="{p["id"].lower()}">
  <h4>{e(p["name"])}</h4>
  <p>{e(p["plain"])}</p>
  <p class="pmeta"><span class="tag">Mainly keeps</span> {promise_links(KEEPS.get(p["id"], []))}</p>
  {f'<p class="pmeta muted"><span class="tag">Also needed by</span> {promise_links(also)}</p>' if also else ''}
  {f'<p class="pmeta"><span class="tag">Today</span> {e(TODAY[p["id"]])}</p>' if p["id"] in TODAY else ''}
  <p class="pmeta"><span class="tag">Removes</span> {flaw_links(p["flaws"])}</p>
  <p class="pmeta"><span class="tag">Runs on</span> {e(runs)}</p>
  <p class="pmeta muted"><span class="tag">Where it can be swapped</span> {e(p["seams"])}</p>
</article>'''


# The plain summary of the relationship map (the shape's section 2.1 and the end of its section 1).
FIT_SUMMARY = [
    ('What happens at every tap.', 'In a networked game, four promises meet at every tap. The designer\'s pack sets the rules. The game\'s record, the same on every screen, is what the tap is judged against. The answer comes back to the GM or the player, and an accepted tap joins the record. The roles say who tapped and who may see the result.'),
    ('The engine\'s own machinery.', 'The equipment reports what it is doing. The verdict turns that, and the venue technician\'s profile, into go, no-go or "not installed tonight". The life of a game says when to check again and what to reset, which feeds back into the equipment. The profile feeds this loop from outside. In today\'s code the loop is also a chain of seven backend modules that depend on each other in a circle, with the game\'s record caught inside it.'),
    ('Two promises reach the show from outside.', 'The designer\'s week and the developer\'s proof reach a live show only through the pack and through each engine having its own names, so a test or a preview never touches the live show.'),
    ('How each promise is kept.', 'Most promises are kept by one or two parts of their own. Two are kept by a quality every part must have, together with a few parts of their own: "Anyone reading a screen can act on it without a second question" by a label on every fact (how sure, how old), and "A change is proven before it reaches anyone, and the owner alone sends it to the show" by tests every part passes. "Each lifecycle button does exactly what its name says" rests on a table of moments (setup, start, pause, end, reset, restart, the next game) that most other promises read.'),
]

# The relationship map at a glance, drawn from the shape's section 2.1: the spine, the ring,
# and the two jobs that reach the show from outside. The full diagram (25 dependencies) follows it.
OVERVIEW = """flowchart TD
  J1["@J1@"]
  J2["@J2@"]
  J3["@J3@"]
  J7["@J7@"]
  J4["@J4@"]
  J8["@J8@"]
  J9["@J9@"]
  J5["@J5@"]
  J6["@J6@"]
  J10["@J10@"]
  J1 -->|"the rules"| J2
  J2 -->|"what a tap is judged against"| J3
  J3 -->|"accepted taps"| J2
  J7 -->|"who tapped"| J3
  J7 -->|"who may see what"| J2
  J1 -->|"the cues"| J4
  J4 -->|"what it is doing"| J9
  J8 -->|"what the room has tonight"| J9
  J9 -->|"go or no-go"| J5
  J5 -->|"what to reset"| J4
  J5 -->|"what the record keeps or clears"| J2
  J9 -.->|"a label on every fact"| J2
  J6 -->|"a published pack"| J1
  J10 -->|"each engine's own names"| J8
  classDef tap stroke:#0f766e,stroke-width:3px;
  classDef machine stroke:#b45309,stroke-width:3px;
  classDef outside stroke:#6b7280,stroke-width:2px,stroke-dasharray:5 4;
  class J1,J2,J3,J7 tap;
  class J4,J8,J9,J5 machine;
  class J6,J10 outside;
"""

# Which parts run where (the shape's section 4.3), one line per device.
FIT_DEVICES = [
    ('The engine', 'would decide every fact of a networked game, serve the pack, admit every connection, answer every request through one door and send every fact to the screens through one route.'),
    ('A GM tablet in a networked game', 'would draw what it is sent, with each fact\'s label, and send requests in one envelope. It would keep no list of its own and decide nothing before the engine answers. Today it decides before the engine answers.'),
    ('A GM tablet in a standalone game', 'would be the same app with the switch set. In the candidate it runs the same record, lifecycle, answering and delivery parts the engine runs, with small stand-ins that report every engine duty (video, music, lights) as not installed tonight. The other way is an engine of its own, kept equal by tests.'),
    ('The phone and the ESP32', 'would draw, send scans in one envelope, and read the reply words and the few rules they need as data made from the one source. They would stay equal by sharing that data.'),
    ('The scoreboards', 'would be one page in two places, the TV and the Pi 4, drawing what they are sent and deciding nothing. Today the page decides which modes count as evidence. One page or a view inside the GM app is an open choice for step 3.'),
    ('The config tool', 'would hold the design studio and the venue technician\'s profile editor, and talk to the running engine only by message. Today it writes the engine\'s files. A separate program or a surface the engine serves is an open choice for step 3.'),
    ('The tests', 'would run on an engine of their own, with stand-ins for the equipment, and never touch the live one. Today they use the live display and audio.'),
]


def wrap_label(text, per_line=4):
    words = text.split()
    return '<br/>'.join(' '.join(words[i:i + per_line]) for i in range(0, len(words), per_line))


def overview_src(jobs):
    """The at-a-glance diagram with each node labelled by its promise's title, as the headings show it."""
    src = OVERVIEW
    for j in jobs:
        src = src.replace(f'@{j["id"]}@', wrap_label(TITLES[j["id"]]))
    assert '@' not in src, 'a promise in the overview has no title'
    return src


def relations_src(shape):
    """The full diagram of links between promises, each node labelled by its promise's title alone."""
    return re.sub(r'^(\s*)(J\d+)\["[^"]*"\]', lambda m: f'{m.group(1)}{m.group(2)}["{wrap_label(TITLES[m.group(2)])}"]', shape['relationsMermaid'], flags=re.M)


# The candidate engine drawn whole (the shape's sections 4.1 to 4.3): devices and tools on top, the two
# doors, the game's facts, the life of a game and the room behind them, the foundations below. Arrows show
# what passes at a show; the walkthroughs below follow single moments. Hand-drawn SVG on a 1000 x 800 grid.
def shape_svg():
    out = []

    def text(x, y, t, size=11.5, anchor='start', weight=None, op=None):
        w = f' font-weight="{weight}"' if weight else ''
        o = f' opacity="{op}"' if op else ''
        out.append(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}"{w}{o} fill="currentColor">{e(t)}</text>')

    def box(x, y, w, h, name, sub=(), accent=False, dashed=False, name_size=14):
        stroke = 'var(--accent)' if accent else 'currentColor'
        sw = 2.4 if accent else 1.2
        dash = ' stroke-dasharray="5 4"' if dashed else ''
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" style="fill: var(--surface); stroke: {stroke}" stroke-width="{sw}"{dash}/>')
        lines = [name] + list(sub)
        top = y + h / 2 - (len(lines) - 1) * 7.5 + 4.5
        for i, t in enumerate(lines):
            text(x + w / 2, round(top + i * 15, 1), t, size=name_size if i == 0 else 11.5, anchor='middle',
                 weight='600' if i == 0 else None, op=None if i == 0 else '.8')

    def band(x, y, w, h, label=None, right=False):
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" style="fill: var(--chip)" fill-opacity=".6"/>')
        if label:
            text(x + w - 16 if right else x + 16, y + 20, label.upper(), size=10.5, weight='600', op='.7',
                 anchor='end' if right else 'start')

    def arrow(points, label=None, at=None, anchor='start', accent=False, both=False):
        d = 'M' + ' L'.join(f'{px},{py}' for px, py in points)
        mk = 'shpA' if accent else 'shp'
        start = f' marker-start="url(#{mk})"' if both else ''
        stroke = 'var(--accent)' if accent else 'currentColor'
        out.append(f'<path d="{d}" fill="none" style="stroke: {stroke}" stroke-width="1.6" marker-end="url(#{mk})"{start}/>')
        if label:
            text(at[0], at[1], label, anchor=anchor, op='.9')

    # who
    text(20, 26, 'PEOPLE', size=10.5, weight='600', op='.7')
    text(84, 26, 'Designer · Venue technician · GM · Players · Audience · Developer · You', size=12.5)
    # devices and tools
    band(20, 40, 960, 100)
    out.append('<rect x="30" y="50" width="540" height="80" rx="6" style="fill: var(--surface); stroke: currentColor" stroke-width="1.2"/>')
    text(44, 71, 'Screens', size=14, weight='600')
    text(108, 71, 'on every device: they draw what they are sent, decide nothing', op='.8')
    for x, label in ((44, 'GM tablets'), (218, 'Phones and scanners'), (392, 'TV and Pi 4')):
        out.append(f'<rect x="{x}" y="78" width="164" height="32" rx="5" fill="none" stroke="currentColor" stroke-opacity=".45"/>')
        text(x + 82, 99, label, size=12.5, anchor='middle')
    text(44, 124, 'tablets and scanners also keep a stamped copy of the pack and the game rules', size=11, op='.75')
    box(580, 50, 128, 80, 'Design studio', ('the config tool,', 'talks by message'))
    box(716, 50, 116, 80, 'Release', ('what each', 'machine carries'))
    box(840, 50, 136, 80, 'Joins and proofs', ('the tests, on an', 'engine of their own'), name_size=13)
    # the doors
    arrow([(150, 140), (150, 210)], 'requests and replies', (158, 180), accent=True, both=True)
    arrow([(500, 140), (500, 210)], 'a pass at every connection', (492, 196), anchor='end')
    arrow([(760, 210), (760, 175), (545, 175), (545, 130)], 'every fact, labelled', (652, 168), anchor='middle', accent=True)
    box(20, 210, 270, 62, 'Answering', ('the one door in:', 'one reply per request'), accent=True)
    box(345, 210, 310, 62, 'Connections and roles', ('who is connected,', 'who may do or see what'))
    box(710, 210, 270, 62, 'Delivery', ('the one door out:', 'every fact, with its label'), accent=True)
    arrow([(345, 241), (290, 241)], 'may do', (317, 233), anchor='middle')
    arrow([(655, 241), (710, 241)], 'may see', (682, 233), anchor='middle')
    # from the doors to what sits behind them (the band first, so the arrows sit on top)
    band(20, 350, 960, 300)
    arrow([(200, 272), (200, 390)], 'game actions', (192, 330), anchor='end')
    arrow([(240, 272), (240, 330), (560, 330), (560, 390)], 'start, pause, end, reset', (400, 347), anchor='middle')
    arrow([(275, 272), (275, 310), (800, 310), (800, 390)], 'room commands', (660, 303), anchor='middle')
    arrow([(940, 350), (940, 272)], 'read by Delivery', (932, 340), anchor='end')
    # behind the doors
    text(36, 372, "THE GAME'S FACTS", size=10.5, weight='600', op='.7')
    text(376, 372, 'THE LIFE OF A GAME', size=10.5, weight='600', op='.7')
    text(716, 372, 'THE ROOM', size=10.5, weight='600', op='.7')
    box(36, 390, 250, 60, 'Game record', ('decides teams, claims,', 'scores and the phase'))
    box(36, 500, 250, 60, "The night's record", ('written at the end of a game',))
    box(376, 390, 250, 60, 'Lifecycle', ('moves the game,', 'resets every part'))
    box(436, 500, 190, 60, 'Verdict', ("the needs against tonight's kit:", 'go, no-go or not tonight'))
    box(716, 390, 250, 60, 'Show runner', ('cues, clock, video queue,', 'held items'))
    box(716, 500, 250, 60, 'Equipment', ('video, music, sound,', 'lights, displays'))
    box(716, 585, 250, 50, 'Outside programs', ('VLC, the music player, lights',), dashed=True, name_size=12.5)
    arrow([(376, 420), (286, 420)], 'keeps, clears', (331, 412), anchor='middle')
    arrow([(626, 420), (716, 420)], 'resets', (671, 412), anchor='middle')
    arrow([(520, 450), (520, 500)], 'asks', (528, 480), both=True)
    arrow([(841, 450), (841, 500)], 'drives', (849, 480))
    arrow([(716, 515), (650, 515), (650, 440), (626, 440)], 'what runs', (656, 480))
    arrow([(161, 450), (161, 500)], "the night's facts", (169, 480))
    arrow([(376, 440), (330, 440), (330, 530), (286, 530)], 'the end', (322, 487), anchor='end')
    arrow([(841, 560), (841, 585)], 'commands, checks', (849, 577), both=True)
    # the foundations
    band(20, 700, 960, 92, 'Foundations: the parts above build on these', right=True)
    box(36, 728, 170, 52, 'Game rules', ("the pack's rules,", 'one copy everywhere'))
    box(330, 728, 170, 52, 'Venue fit', ("tonight's kit and", 'its bindings'))
    box(540, 728, 170, 52, 'Engine instance', ('its own names',))
    box(740, 728, 180, 52, 'Pack channel', ('one pack, stamped,', 'on every copy'))
    arrow([(121, 728), (121, 650)], 'the rules, from the pack in use', (129, 690))
    arrow([(400, 728), (400, 450)], "tonight's profile", (392, 640), anchor='end')
    arrow([(920, 754), (990, 754), (990, 241), (980, 241)], 'the pack version', (982, 676), anchor='end')

    defs = ('<defs>'
            '<marker id="shp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker>'
            '<marker id="shpA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill: var(--accent)"/></marker>'
            '</defs>')
    label = ('The candidate engine as a whole: devices and tools on top; Answering, the one door in, and Delivery, the one door out; '
             "behind them the game's facts, the life of a game and the room; the foundations below.")
    return (f'<svg class="shape-svg" viewBox="0 0 1000 800" role="img" aria-label="{e(label)}" '
            f'font-family="IBM Plex Sans, system-ui, sans-serif">{defs}{"".join(out)}</svg>')


# Five moments followed through the parts, each with the promises it keeps (titles by promise id).
WALKS = [
    ('A GM taps a token', ['J3', 'J2', 'J7'], """sequenceDiagram
  participant T as GM tablet
  participant A as Answering
  participant C as Connections and roles
  participant R as Game record
  participant D as Delivery
  participant S as Other tablets and scoreboards
  T->>A: Team X scans this token
  A->>C: may this tablet do that?
  C-->>A: yes, it is a GM
  A->>R: claim the token for Team X
  R-->>A: accepted and saved
  A-->>T: accepted, final, stored
  D->>R: what changed?
  R-->>D: the claim and the new score
  D-->>T: the new score, fresh
  D-->>S: the new score, fresh"""),
    ('A cue plays, or cannot', ['J4', 'J9'], """sequenceDiagram
  participant S as Show runner
  participant E as Equipment
  participant P as Video player
  participant D as Delivery
  participant T as GM tablet
  Note over S: the game clock reaches the cue
  S->>E: play the opening video
  E->>P: play
  alt the player answers
    P-->>E: playing
    E-->>S: playing
    D->>E: what changed?
    E-->>D: playing, healthy, as of now
    D-->>T: now playing
  else no answer
    E->>P: restart
    E-->>S: failed: the player is down
    S->>S: hold the cue
    D->>E: what changed?
    E-->>D: video player down, as of now
    D->>S: what changed?
    S-->>D: one cue held, waiting for the video
    D-->>T: red: video player down, cue held, release or discard
  end"""),
    ('The GM ends the game', ['J5', 'J3'], """sequenceDiagram
  participant T as GM tablet
  participant A as Answering
  participant L as Lifecycle
  participant R as Game record
  participant S as Show runner
  participant N as The night's record
  T->>A: end the game
  A->>L: move the game to ended
  L->>R: close the game, no more scans
  L->>S: stop the clock and the cues
  L-->>A: ended
  A-->>T: ended, final
  N->>L: has the game ended?
  L-->>N: ended
  N->>R: read the night's facts
  R-->>N: the night's facts
  Note over T,L: Delivery then asks the lifecycle what changed and tells every screen the game ended"""),
    ('Doors open: the preflight', ['J8', 'J9'], """sequenceDiagram
  participant V as Venue technician
  participant A as Answering
  participant L as Lifecycle
  participant F as Venue fit
  participant E as Equipment
  participant X as Verdict
  V->>A: run the preflight
  A->>L: may this game start tonight?
  L->>F: tonight's profile
  F-->>L: what the kit brought tonight
  L->>E: what is running?
  E-->>L: what runs, dated
  L->>X: the needs, the profile, what runs
  X-->>L: go, two lights grey: not tonight
  L-->>A: go
  A-->>V: go, checked live, two lights not tonight"""),
    ('The designer publishes a change', ['J6', 'J1'], """sequenceDiagram
  participant G as Design studio
  participant A as Answering
  participant L as Lifecycle
  participant P as Pack channel
  participant D as Delivery
  participant V as Tablets and scoreboards
  G->>A: publish and apply this pack
  A->>L: may a new pack be taken up now?
  alt between games
    L->>P: take up the new pack
    L-->>A: taken up
    A-->>G: applied, version 7 is live
    D->>P: what changed?
    P-->>D: the pack is now version 7
    D-->>V: version 7
    V->>P: fetch version 7
    Note over P: phones and scanners fetch it when they next check
  else a game is on, running or paused
    L-->>A: not during a game
    A-->>G: refused until this game ends
  end"""),
]


def fit_html(shape, jobs):
    names = {p['id']: p['name'] for p in shape['parts']}
    summary = ''.join(f'<p><strong>{e(h)}</strong> {e(t)}</p>' for h, t in FIT_SUMMARY)
    assert len(shape['qualities']) == len(QUALITY_KEEPS), 'the qualities changed: update QUALITY_KEEPS'
    quality_today = {3: today_of(shape['mechanisms'][10]['plain'])}   # who decides with no engine: today's way
    qual = ''.join(f'<tr><th scope="row">{e(q["name"])}</th><td>{e(q["plain"])}' + (f' <span class="muted">Today: {e(quality_today[k])}</span>' if k in quality_today else '') + f'</td><td>{promise_links(QUALITY_KEEPS[k])}</td></tr>' for k, q in enumerate(shape['qualities']))
    tangles = ''.join(f'<li><strong>{e(t["title"])}.</strong> {e(t["plain"])} <span class="muted">Flaws: {flaw_links(t["flaws"])}</span></li>' for t in shape['today']['tangles'])
    rows = part_layers(shape)
    edge = {0: '<span class="lvl">Top</span>', len(rows) - 1: '<span class="lvl">Bottom</span>'}
    layers = ''.join(f'<li>{edge.get(k, "")}{"".join(part_link(i, names) for i in row)}</li>' for k, row in enumerate(rows))
    order = [i for row in reversed(rows) for i in row]
    by_id = {p['id']: p for p in shape['parts']}
    parts = ''.join(part_html(by_id[i]) for i in order)
    devices = ''.join(f'<li><strong>{e(h)}</strong> {e(t)}</li>' for h, t in FIT_DEVICES)
    walks = ''.join(f'''<figure class="dia walk">
      <figcaption>{e(title)}</figcaption>
      <p class="figkey">Keeps {"; ".join(promise_link(j) for j in keeps)}.</p>
      <div class="scroll"><pre class="mermaid">{e(present(src))}</pre></div>
    </figure>''' for title, keeps, src in WALKS)
    alts = ''.join(f'<tr><th scope="row">{e(a["title"])}</th><td>{e(a["a"])}</td><td>{e(a["b"])}</td><td>{e(a["cost"])}</td></tr>' for a in shape['alternatives'])
    return f'''
<section class="fit" id="fit" aria-labelledby="fit-h">
  <h2 id="fit-h">How the promises fit together</h2>
  <p class="intro">You asked how the ten promises relate, so that the design keeps all of them at once and stays easy to keep building. This section answers at two levels: the engine and the devices it talks to (the tablets, the scanners, the scoreboards, the config tool), and the smaller parts inside them. It shows how the promises depend on each other, where today's code keeps or breaks them, and one candidate shape for the whole engine. Every card further down now follows that shape, and each says what changed.</p>
  <div class="fit-summary">{summary}</div>
  <figure class="dia wide">
    <figcaption>The promises at a glance</figcaption>
    <p class="figkey"><span class="key tap"></span>what happens at every tap <span class="key machine"></span>the engine's own machinery <span class="key outside"></span>from outside the show. Each arrow runs from a promise to one that cannot be kept without it, and says what passes. The dotted line is a label every fact carries, not a dependency.</p>
    <div class="scroll"><pre class="mermaid">{e(present(overview_src(jobs)).replace('"useMaxWidth": false}, "sequence"', '"useMaxWidth": false, "nodeSpacing": 20}, "sequence"', 1))}</pre></div>
    <details>
      <summary>The {len(re.findall(r"-\.?->", shape["relationsMermaid"]))} main links between the promises</summary>
      <p class="muted" style="margin:10px 0">{len(re.findall(r"[^.]-->", shape["relationsMermaid"]))} are dependencies: without them, the promise at the arrow's end cannot be kept at a show. One is a quality and one is shared work; they are drawn dotted.</p>
      <div class="scroll"><pre class="mermaid">{e(present(relations_src(shape)))}</pre></div>
    </details>
  </figure>

  <div class="fit-block">
    <h3>Qualities every part must have</h3>
    <p>A quality is not a part. It is something every part must have, so that a promise holds everywhere and not in one place only.</p>
    <div class="tablewrap"><table class="mech"><thead><tr><th>Quality</th><th>What it means</th><th>Mainly keeps</th></tr></thead><tbody>{qual}</tbody></table></div>
  </div>

  <details>
    <summary>Where the promises' work sits in today's code: {len(shape["today"]["tangles"])} tangles</summary>
    <p class="muted" style="margin:10px 0">A tangle is one piece of work spread over many places with nothing joining them, one place doing many kinds of work, or a dependency running the wrong way. Each causes some of the design flaws below.</p>
    <ul class="examples">{tangles}</ul>
  </details>

  <div class="fit-block">
    <h3>A candidate shape: {len(shape["parts"])} parts</h3>
    <p>Most of today's problems sit in work several promises depend on: getting a fact onto a screen, answering a request, knowing who is connected, the boundary between one game and the next. Each is done several times today, in different places. In the candidate shape each such piece of work becomes one part, and that part's card says how the work is done today. The parts that are already well built today (the game rules, the verdict, the health words) are the pattern for the rest.</p>
    <figure class="dia whole">
      <figcaption>The candidate engine, whole</figcaption>
      <div class="scroll"><div class="svgwrap">{shape_svg()}</div></div>
      <p class="figkey">Every request comes in through Answering and gets one reply; every fact goes out to the screens through Delivery, with its label (how old, how sure). Delivery reads what changed in the game record, the lifecycle, the room and the pack channel; no part sends to it. Behind the two doors sit the game's facts, the life of a game and the room; the parts above build on the foundations, directly or through another part. The arrows show what passes at a show. Before a start, the lifecycle hands the verdict tonight's profile and what is running, and asks for go, no-go or not installed tonight; it also takes up a new pack from the pack channel, only between games. The two doors and their arrows are drawn in teal; the dashed box is an outside program, not a part. The rows group the parts by what they do; they are not the layers of use, which the list further down gives. In a standalone game the GM tablet runs the same doors, game record and lifecycle itself, with small stand-ins for connections, the room, the verdict and the engine's names. The moments below follow single steps through the parts.</p>
    </figure>
    <h3>{len(WALKS)} moments, part by part</h3>
    <p>Each moment follows one thing that happens at a show through the parts that handle it, in order. Solid arrows are requests; dashed arrows are answers. Delivery always asks what changed; nothing pushes facts to it. Each screen asked Delivery, when it connected, to keep it up to date; Delivery's dashed arrows to screens answer that standing request.</p>
    <div class="walks">{walks}</div>
    <figure class="layers-fig">
      <figcaption>The parts in layers, top row first. Each part uses only the parts in the rows below it, so nothing loops back: a change low down can affect the parts above it, and nothing above can break what sits below. Tap a part to read it.</figcaption>
      <ol class="layers">{layers}</ol>
    </figure>
    <div class="parts">{parts}</div>
    <details>
      <summary>Which part uses which: {len(re.findall(r"-->", shape["partsMermaid"]))} links</summary>
      <p class="muted" style="margin:10px 0">An arrow means "uses". No arrow loops back.</p>
      <div class="scroll"><pre class="mermaid">{e(present(shape["partsMermaid"]))}</pre></div>
    </details>
  </div>

  <div class="fit-block">
    <h3>In the candidate shape, which parts would run where</h3>
    <ul class="devices">{devices}</ul>
    <details>
      <summary>As a diagram</summary>
      <div class="scroll"><pre class="mermaid">{e(present(shape["componentsMermaid"]))}</pre></div>
    </details>
  </div>

  <div class="fit-block">
    <h3>Where a real alternative exists</h3>
    <p>For these, the map found two sound ways to build a part or to word a promise. Step 3 puts each in front of you with designs side by side; no answer is needed now.</p>
    <div class="tablewrap"><table class="alts"><thead><tr><th>Choice</th><th>The candidate</th><th>The other way</th><th>What each costs</th></tr></thead><tbody>{alts}</tbody></table></div>
  </div>
</section>'''


def build():
    cards = json.loads(CARDS.read_text())['cards']
    lines = json.loads(STANDALONE.read_text())['lines']
    for c in cards:
        t = lines.get(c['id'], '')
        c['inStandalone'] = t.split(':', 1)[1].strip() if t.lower().startswith('in a standalone game:') else t
    by_id = {c['id']: c for c in cards}
    assert len(by_id) == 16, f'expected 16 cards, got {len(by_id)}'
    shape = json.loads(SHAPE.read_text())
    NAMES.update({p['id']: p['name'] for p in shape['parts']})
    data = json.loads(JOBS.read_text())
    jobs = data['jobs']
    TITLES.update({j['id']: (j.get('functional') or {}).get('proposedTitle') or j['title'] for j in jobs})
    for j in jobs:
        for p in j.get('parts', []):
            KEEPS.setdefault(p, []).append(j['id'])
    assert len(shape['mechanisms']) == len(MECH_PART), 'the shared work changed: update MECH_PART'
    TODAY.update({pid: today_of(m['plain']) for m, pid in zip(shape['mechanisms'], MECH_PART) if pid})
    for c in cards:
        bad = [p for p in c.get('parts', []) if p not in NAMES]
        assert not bad, f'{c["id"]} names unknown parts {bad}'
    for j in jobs:
        bad = [p for p in j.get('parts', []) if p not in NAMES]
        assert not bad, f'{j["id"]} names unknown parts {bad}'
    home = {f['id']: j['id'] for j in jobs for f in j['flaws'] if f['primary']}
    missing = [c for c in by_id if c not in home]
    assert not missing, f'flaws with no promise they mainly break: {missing}'
    total = sum(c['findings'] for c in cards)
    aside = ''.join(f'<tr><th scope="row">{e(k)}</th><td class="num">{n}</td><td>{e(t)}</td></tr>' for k, n, t in SET_ASIDE)
    aside_n = sum(n for _, n, _ in SET_ASIDE)
    purpose = ''.join(f'<p>{e(x)}</p>' for x in data['purpose'])
    page = TEMPLATE.format(
        total=total, total_all=total + aside_n, aside_n=aside_n, purpose=purpose,
        glance=glance_html(jobs), fit=fit_html(shape, jobs), jobs=''.join(job_html(j, by_id, home) for j in jobs),
        grid=grid_html(sorted(cards, key=lambda c: int(c['id'][1:]))),
        aside=aside, parity=parity_html(), parity_n=len(parity_rows()))
    OUT.write_text(page)
    print(f'wrote {OUT} ({len(page)} bytes, {len(jobs)} promises, {len(cards)} flaw cards)')


TEMPLATE = '''<title>What the Engine Promises</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans+Condensed:wght@500;600&display=swap">
<style>
/* Layout: one reading column; the engine's promises lead, each holding the design flaws that break it; evidence and questions at the end. */
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
.decided-note {{ font-size: 15px; max-width: 78ch; color: var(--muted); border-left: 3px solid var(--line); padding-left: 12px; }}
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
.job-head {{ display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }}
.job-head .kind {{ font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; font-weight: 600; color: var(--accent); }}
.jid {{ font-family: var(--font-mono); font-weight: 500; font-size: 17px; color: var(--accent); }}
.job-head .meaning {{ font-size: 17px; max-width: 74ch; }}
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
.qgroup > h3 {{ font-size: 17px; color: var(--muted); font-weight: 600; }}
.q h3 {{ color: var(--fg); }}
.q .applied {{ font-family: var(--font-label); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); }}
.q .changedrec {{ font-family: var(--font-label); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fault); }}
.changed {{ font-size: 15px; max-width: 80ch; background: var(--chip); border-radius: 6px; padding: 10px 14px; }}
.changed .tag {{ display: block; margin-bottom: 2px; color: var(--accent); }}
.partrow {{ display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }}
.partrow .tag {{ margin-right: 4px; }}
a.chip.part {{ text-decoration: none; color: var(--fg); border: 1px solid var(--accent); background: transparent; }}
a.chip.part:hover {{ background: var(--chip); }}
.job-head .was {{ font-size: 14px; color: var(--muted); }}
.job-head dl.who {{ display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0; font-size: 15px; max-width: 80ch; }}
dl.who dt {{ font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; font-weight: 600; color: var(--muted); padding-top: 3px; }}
dl.who dd {{ margin: 0; }}
.fit {{ display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px; border-top: 2px solid var(--line); padding-top: 8px; }}
.fit > * {{ min-width: 0; }}
.fit-summary {{ display: grid; gap: 10px; max-width: 78ch; background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 6px; padding: 16px 20px; }}
.fit-block {{ display: grid; gap: 10px; min-width: 0; }}
.fit-block > *, .fit details {{ min-width: 0; }}
.fit-block > p {{ max-width: 76ch; }}
.mech th, .mech td, .alts th, .alts td {{ border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }}
.mech thead th, .alts thead th {{ font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; color: var(--muted); }}
.mech tbody th {{ font-weight: 600; min-width: 10em; }}
.alts tbody th {{ font-weight: 600; min-width: 11em; }}
.alts td {{ min-width: 14em; }}
.idcell {{ font-family: var(--font-mono); font-size: 13px; min-width: 8em; }}
.idcell a, .pmeta a {{ text-decoration: none; margin-right: 2px; }}
.layers-fig {{ margin: 0; display: grid; gap: 8px; }}
ol.layers {{ list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }}
ol.layers li {{ display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }}
ol.layers .lvl {{ font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px; font-weight: 600; color: var(--muted); min-width: 4.5em; }}
.parts {{ display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }}
.part {{ background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px; display: grid; gap: 6px; align-content: start; scroll-margin-top: 16px; }}
.part h4 {{ margin: 0; font-size: 16px; font-weight: 600; }}
.part p {{ font-size: 14.5px; }}
.pmeta .tag {{ margin-right: 6px; }}
ul.devices {{ margin: 0; padding-left: 18px; display: grid; gap: 6px; max-width: 80ch; }}
figure.dia.wide {{ padding: 12px; }}
figure.dia.whole {{ padding: 14px; }}
.svgwrap {{ min-width: 760px; }}
.shape-svg {{ display: block; width: 100%; height: auto; color: var(--fg); }}
.walks {{ display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); }}
figure.dia.walk {{ padding: 12px; }}
figure.dia.walk pre.mermaid svg {{ min-width: 720px; }}
.figkey {{ font-size: 14px; color: var(--muted); max-width: 80ch; }}
.figkey .key {{ display: inline-block; width: 18px; height: 12px; border-radius: 3px; border: 3px solid; vertical-align: -1px; margin: 0 6px 0 10px; }}
.figkey .key:first-child {{ margin-left: 0; }}
.figkey .key.tap {{ border-color: #0f766e; }}
.figkey .key.machine {{ border-color: #b45309; }}
.figkey .key.outside {{ border: 2px dashed #6b7280; }}
@media (prefers-reduced-motion: reduce) {{ * {{ scroll-behavior: auto; }} }}
</style>
<div class="wrap">
<header class="top">
  <p class="eyebrow">Architecture pass · phase 1, step 1 · the engine's promises and how they fit together · 2026-11-01</p>
  <h1>What the engine promises</h1>
  <p class="lead">The engine runs shows for any game, not only ALN. This page starts from its ten promises: what each person can count on, when, and what must happen for them. Then it maps how the promises fit together, offers one candidate shape for the whole engine, and shows where today's design breaks a promise. The problems from blue's shows appear as evidence and as test cases, not as the plan.</p>
</header>

<section class="decide" aria-labelledby="deciding">
  <h2 id="deciding">What you are deciding</h2>
  <p><strong>The promises.</strong> Are these the right ten promises, each said from the side of the people who count on it, and is one missing? Seven small questions, A to G, ask about their wording and whether three of them should split. The relationship map changed three of those recommendations: E, F and G.</p>
  <p><strong>How the promises fit together.</strong> <a href="#fit">A map</a> of how the promises depend on each other and on the pieces of the engine, and one candidate shape for the whole engine, drawn whole with five moments followed through it. The design on each card follows that shape, and a note at the top of each card says what changed. Nothing in the shape is decided; it is where step 3 starts.</p>
  <p><strong>Standalone games, the game's record, the next step.</strong> Three questions about games with no engine, one about recording refused scans, and one about how much the test rig proves before design starts. Everything is <a href="#your-questions">at the end</a>, each with a recommendation or a suggestion; the step-3 preview there needs no answer yet.</p>
</section>

<p class="decided-note"><strong>Already decided: your words.</strong> A promise is what a person can count on at a given moment, and "job" is gone. Parts keep promises; design flaws break them; a quality is something every part must have. Promises go by their titles, with no numbers, and the person who fits a kit to a venue is the venue technician (decision 27). The words box below defines each.</p>

<section class="sa-box" aria-labelledby="purpose">
  <h2 id="purpose">What the engine is for</h2>
  {purpose}
</section>

<section class="howto" aria-label="How to read this page">
  <div>
    <h2>How to read a promise</h2>
    <p>Each promise says who counts on it, when, and what must happen for them. Then come a note on what the relationship map changed, the parts of the candidate shape that would keep it, what is built today, and the long-term goal. Under it sit the design flaws that break it, each with a card.</p>
    <p>A card tells one moment at a show, why it happens, and shows two diagrams. <strong>Today</strong> shows how the problem happens now. <strong>Candidate, not decided</strong> shows how the candidate shape would remove it, and the card names the parts that would. Where the relationship map changed a card, a note at its top says what and why. Step 3 puts competing designs in front of you; nothing on the right is decided.</p>
    <div class="legend"><span><span class="sw"></span>where it goes wrong</span><span><span class="sw owner"></span>the one place that would own the fact</span></div>
  </div>
  <div>
    <h2>The words</h2>
    <p>The page's own words come first. The rest are the words step 3 uses; each card ends with the reason restated in them.</p>
    <dl class="terms">
      <dt>Promise</dt><dd>What a person can count on at a given moment. Parts keep promises; design flaws break them.</dd>
      <dt>Moment</dt><dd>When a promise matters: a production stage (Author, Rehearse, Run, Review), a point in a show, or release day.</dd>
      <dt>Design flaw</dt><dd>Something in today's design that breaks a promise.</dd>
      <dt>Part</dt><dd>One of the 17 pieces of the candidate design. It runs on the engine or on a device.</dd>
      <dt>Quality</dt><dd>Something every part must have so a promise holds everywhere, like honest or proven. It keeps promises; it is never a promise or a part.</dd>
      <dt>Paper or live</dt><dd>Checked from the files only, or checked against the equipment in the room.</dd>
      <dt>Pass</dt><dd>What a device shows when it connects: who it is and what it may do.</dd>
      <dt>Not installed tonight</dt><dd>Grey, absent on purpose, never a fault. The code calls it dormant.</dd>
      <dt>Module</dt><dd>Any piece of code with an inside and an outside, from one function to the whole backend.</dd>
      <dt>Interface</dt><dd>Everything other code must know to use a module.</dd>
      <dt>Seam</dt><dd>Where one module meets another, and where behaviour can be swapped.</dd>
      <dt>Deep, shallow</dt><dd>A deep module does a lot behind a small interface. A shallow one makes its callers know almost as much as it does.</dd>
      <dt>Locality</dt><dd>A fix in one place fixes it everywhere.</dd>
      <dt>Leverage</dt><dd>One module serving many callers.</dd>
      <dt>Adapter</dt><dd>The real thing plugged in at a seam, like VLC behind "play a video".</dd>
    </dl>
  </div>
</section>

<section aria-labelledby="glance">
  <h2 id="glance">The ten promises at a glance</h2>
  <p class="intro" style="margin:8px 0 14px">Each design flaw has one promise it mainly breaks; its card sits there. Flaws also listed under other promises point back to their card.</p>
  {glance}
</section>

{fit}

{jobs}

<section class="sa-box" aria-labelledby="standalone">
  <h2 id="standalone">Standalone games</h2>
  <p>Your decision 22 adds a requirement: a whole game can run with no engine, the GM tablet and the player scanners each working alone, as a choice the game declares and never mixed. In a standalone game the GM tablet decides everything about the game (used tokens, scores, teams, the game's start, pause and end) from its own hand-kept copies of the engine's rules. Each player scanner decides only whether a token is known, and the phone also whether it has seen that token before.</p>
  <p>Four design flaws cause no problem in a standalone game, four apply in part and eight in full. Each promise and each card says what changes. The two biggest gaps: nothing says that a game is standalone, and every device shows the missing engine as a failure ("Offline" on the phone all night, red "DISCONNECTED" on the ESP32, "VIDEO UNAVAILABLE, Rescan later" for a video that can never play).</p>
  <details>
    <summary>The ESP32 against the web scanner with no engine: {parity_n} differences</summary>
    <p class="muted" style="margin:10px 0">Your parity rule says the two player scanners match wherever possible. Shaded rows are ones where both are weak, or the web scanner is the weaker side, so matching it would copy a gap.</p>
    {parity}
  </details>
</section>

<section aria-labelledby="evidence">
  <h2 id="evidence">The evidence</h2>
  <p class="intro" style="margin:8px 0 14px">{total_all} problems came from blue's records and the maps of today's engine; {total} of them sit under the design flaws above, and {aside_n} needed no change to the design. The standalone pass added 35 more: 27 placed under the same flaws, and 8 under the proposed N1 that question 23 asks about.</p>
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
    <h3>About the promises</h3>
    <div class="q">
      <h3>Are these the right ten promises, and does each read from the side of the people who count on it?</h3>
      <p>Is something the engine must promise, for any game, missing? Are two of them really one? Each promise says who counts on it, when, and what must happen for them. Each title is new; the earlier wording, written as a job, shows under each. This replaces question 17.</p>
      <p class="rec">Recommendation: keep these ten as the base, with these titles, and settle D to G below. In the map every promise is kept by parts of its own, and the one candidate for an eleventh, "run in any setup", owns no part (question E).</p>
    </div>
    <div class="q">
      <p class="applied">Applied, please confirm</p>
      <h3>A. "The designer's game is the game the whole kit plays" now says a second designer's game runs on the same engine, and that every device plays the same version of the pack and shows which.</h3>
      <p>"Nothing in the engine assumes ALN" is now a quality every part must have (Generic, in "How the promises fit together"). The version every device shows is the pack channel's stamp on every copy, compared whenever a device connects.</p>
      <p class="rec">Recommendation: keep both. The first is what lets other games run; the second is what design flaw C12 breaks.</p>
    </div>
    <div class="q">
      <p class="applied">Applied, please confirm</p>
      <h3>B. "Each person sees their part and can do only their part" now covers who may do what, not only who sees what.</h3>
      <p>Starting, pausing and ending a game and changing scores stay with the GM, and the stored passwords and keys change before outsiders touch the system. The map agrees: one part, connections and roles, holds both the pass and what it allows.</p>
      <p class="rec">Recommendation: agree.</p>
    </div>
    <div class="q">
      <p class="applied">Applied, please confirm</p>
      <h3>C. "The game fits the venue it is in tonight" now says a standalone game is a choice the game declares, never mixed.</h3>
      <p>These are your decision 22's words, and the map supports them: whether a game is standalone is an input every rule takes, and fitting the game to tonight's setup is where it is declared. Where the declaration is kept is a step-3 choice: the venue profile, the pack, the game's record or each device. The map favours the venue profile: a profile that lists no engine equipment already makes every engine duty read "not installed tonight", which is what a standalone game needs.</p>
      <p>Question 23 is folded in here: is "nothing declares a game standalone" a design flaw of its own, with its own rule? If not, its eight problems join C9, C11 and C14 and the ESP32 parity list. On the map it lands on the pack channel and venue fit, or on the game's record if the declaration is kept there; the answer to 23 does not move it.</p>
      <p class="rec">Recommendation: agree. On question 23, yes: three other rules (game boundaries, one answer per question, how old a copy is) need the declared fact as an input, and would otherwise each invent their own answer.</p>
    </div>
    <div class="q">
      <h3>D. Split "Every tap gets its answer, and the night can be told afterwards" into two promises?</h3>
      <p>Answering happens at the tap, for the GM or the player. The night's record is for you and the designer after the show: what is captured during play, the session bundle, the review. The map confirms the two share no part. Answering sits in the middle of the engine, and six promises depend on it. The night's record is written once, at the end of a game, and read by the designer's review. The parts are the same either way.</p>
      <p>Keeping one promise means the GM at the tap and you after the show look for what they count on in one sentence. Splitting makes a promise that no design flaw mainly breaks yet, because the night's record is mostly planned work.</p>
      <p class="rec">Recommendation: split, into "Every tap gets its answer" and "The night can be told afterwards". The two halves serve two people at two moments and share no part, so two sentences let each find theirs.</p>
    </div>
    <div class="q">
      <p class="changedrec">Recommendation changed by the map</p>
      <h3>E. Keep "The game fits the venue it is in tonight" as one promise, rather than split it?</h3>
      <p>Fitting the game to tonight's venue is one part with an output of its own: the venue technician's profile, which says what the kit brings, binds each of the pack's names to a real instrument and says whether the engine starts each program; the verdict turns it into one go or no-go. The map found that "run in any setup" has no part of its own. Running with no engine is a switch every rule takes, declared as part of fitting the game. Running on another kit is each engine knowing its own names, the same part that keeps a test from touching the live show. So a separate promise for it would own nothing.</p>
      <p>Two titles fit the map. "The game fits the venue, whatever the setup" keeps standalone games and other kits in the title. "The game fits the venue it is in tonight" names the venue technician's moment, and leaves standalone games and other kits to the promise's sentences. The cost of not splitting: the GM running a standalone game and a future operator with another kit are named in a sentence, not in a title.</p>
      <p class="rec">Recommendation: one promise, titled "The game fits the venue it is in tonight", with standalone games kept in its first sentences. This replaces the earlier recommendation to split.</p>
    </div>
    <div class="q">
      <p class="changedrec">Recommendation changed by the map</p>
      <h3>F. "A change is proven before it reaches anyone, and the owner alone sends it to the show": one promise, two, or release day moved?</h3>
      <p>The map separates this promise's two moments. Before every change, the developer's tests pass and show the show still works for ALN and for the toy game; that is a quality every part must have, and checking that joined parts agree is part of it. On release day, you decide when a new version goes to the venue and can swap back by replugging a machine; that is one small part, the release, which checks that everything installed matches.</p>
      <ol type="a">
        <li>Keep one promise covering both moments, as the title does.</li>
        <li>Split release day into a promise of its own. It gives your release day its own sentence, kept by one small part.</li>
        <li>File release day with the venue technician's deploy work, under "The game fits the venue it is in tonight". The check of what is installed sits where the venue technician works, but your decision to send a version moves away from the developer's proof.</li>
        <li>Go back to the earlier wording, about tests alone. The parts fit that too; the cost is that your release day stays unnamed.</li>
      </ol>
      <p>Question 4 covers keeping tests away from the live show (C8). For the other three flaws under this promise no question of the nine fits: question 5 is only the nearest for the names two parts share (C14), and the installed pieces (C15) and tests that prove the real path (C16) have none. This replaces question 18.</p>
      <p class="rec">Recommendation: one promise, as the title has it, and give the proof and the release a question each in the pass. Both moments exist so that nothing reaches the live show unproven, or before you say so. The earlier split into "prove it works" and "keep every part in step" does not match the map, because keeping joined parts in step is part of the proof.</p>
    </div>
    <div class="q">
      <p class="changedrec">Recommendation changed by the map</p>
      <h3>G. Which promise covers the equipment's state on every screen?</h3>
      <p>The map's answer, if step 3 keeps one delivery part: neither promise needs to name the route. One part, delivery, carries every fact to every screen, game facts and equipment alike, each with its label (how sure, how old). The equipment decides its own state and health as one dated fact; delivery carries it; the screens draw it.</p>
      <p>The two promises already cover their halves. Under "The room does what the designer cued and the GM asked", the GM makes the room do a thing and sees it happen, or sees at once that it did not. Under "One game, the same on every screen", every screen agrees, also after a tablet comes back. If you still want one promise to hold the words: under the room promise they sit with the equipment whose state it is, but that promise then names a route the other also needs; under "One game, the same on every screen" they match how the game's running state is already defined (the video queue, music, held items, the clock, each service's health), but that promise then carries the equipment beside the game's record.</p>
      <p class="rec">Recommendation: add the route to neither promise, as long as step 3 keeps one delivery part; both then hold through it, and C2's card stays under "The room does what the designer cued and the GM asked", where its moment at a show is felt. If step 3 chooses the other way, with the parts behind each promise delivering their own facts, the route belongs with the room promise, beside C2's card. This replaces the earlier answer, which put the route under the room promise whatever the design.</p>
    </div>
  </div>

  <div class="qgroup">
    <h3>About standalone games</h3>
    <div class="q">
      <h3>22. The ESP32 gets a standalone mode matching the web scanner's.</h3>
      <p>Recorded that way under your parity rule. On the map, a yes means the standalone declaration must reach a device that has no idea of it today. A no leaves the ESP32 behind the phone with no engine, in seven of the 24 abilities the parity table compares, and showing a missing engine as a red outage all night. Is that right?</p>
      <p class="rec">Recommendation: yes, as your parity rule asks.</p>
    </div>
    <div class="q">
      <h3>24. Does a standalone game run on one GM tablet?</h3>
      <p>Today two standalone tablets are two separate games. Several tablets sharing one game with no engine would need them to talk to each other directly, a large new piece. This also decides whether a standalone tablet's record of the night can hold player scans: only if the standalone player scanners hand their scans to that tablet.</p>
      <p class="rec">Recommendation: one tablet, unless you plan standalone games with two GMs.</p>
    </div>
    <div class="q">
      <h3>25. With no engine and no TV, what do exposed evidence and video tokens do?</h3>
      <p>This decides what the screens draw in those two cases. The suggestion below needs the tablet's own scoreboard screen to show exposed evidence. The other way, showing nothing for exposure and hiding video tokens, is smaller but drops a mode's effect from a standalone game.</p>
      <p class="rec">Suggestion: exposed evidence shows on the GM tablet's own scoreboard screen, which standalone already has. A video token shows its picture with a plain note instead of an error.</p>
    </div>
  </div>

  <div class="qgroup">
    <h3>About the game's record</h3>
    <div class="q">
      <h3>19. When a GM scan is refused, does the game keep a record of the attempt?</h3>
      <p>For example, a token already used, or no game running. Today only the tablet that scanned hears about it. On the map this decides whether the game's record keeps refused attempts, or only the answer goes back to the tablet. Yes means the record gains a kind of fact that no screen shows yet. No means a refused attempt is recorded nowhere, as today: only the tablet that scanned hears about it, and the night's record cannot tell it.</p>
      <p class="rec">Recommendation: yes. Record every attempt and its answer, and show it nowhere until a feature needs it.</p>
    </div>
  </div>

  <div class="qgroup">
    <h3>About the next step</h3>
    <div class="q">
      <h3>21. How many problems should the test rig prove before design starts?</h3>
      <p>The test rig is the automated test machine with real video, music, audio and lighting stand-ins. On it a problem can be made to happen for real instead of read off the code. Phase 2 proves each problem anyway, because every area starts with its test failing on today's engine.</p>
      <p class="rec">Recommendation: one per design flaw, 16 runs.</p>
    </div>
  </div>

  <div class="qgroup">
    <h3>Coming in step 3, no answer needed now</h3>
    <div class="q">
      <h3>The map leaves these choices to you.</h3>
      <p>Step 3 puts each in front of you with designs side by side. They are listed here so nothing arrives as a surprise.</p>
      <ol>
        <li>Where "this game is standalone" is declared: the venue profile (the map favours it), the pack, the game's record or each device.</li>
        <li>Getting facts onto screens: one delivery part for every fact, or the parts behind each promise delivering their own facts in a shared shape.</li>
        <li>The life of a game: one lifecycle part that alone moves the game and resets every part, or a table each part reads and applies itself.</li>
        <li>The game rules as one shared body of code that the engine and the tablet both run, or two bodies kept equal by tests.</li>
        <li>The equipment's interface: one per thing the room can do (play a video, light a scene), or one per outside program.</li>
        <li>The standalone tablet: the same record and lifecycle parts the engine runs, or an engine of its own.</li>
        <li>The scoreboard: one page in two places, or a view inside the GM app.</li>
        <li>The config tool: a separate program that talks to the engine by message, or a surface the engine itself serves.</li>
        <li>When a changed pack may be adopted while the engine runs. That is not built yet; the plan allows it only before a game starts or after it ends.</li>
        <li>Where the setting lives that says whether the engine starts each outside program or adopts one already running: in the venue technician's profile, as the candidate shape has it, or in a file of its own, as the capability map you approved has it.</li>
        <li>The order of the work: by part, with the engine's own names and delivery first since most flaws land on them, or by block as the roadmap has it.</li>
      </ol>
    </div>
  </div>
  <p class="muted">Decided so far: 20 (no rule for documents; documents are fixed as we go), 22 (standalone games join the requirements; never mixed), 26 (the pass designs the best engine for the long term; blue's problems are clues, not the plan) and 27 (the page's words: promises, parts, qualities, design flaws, the venue technician; promises named by title).</p>
</section>

<footer>
  <p>Built from <code>docs/plans/architecture-pass/2026-10-31-engine-jobs.md</code> (the promises, first written there as jobs; its check held 171 claims and corrected 53), the list of design flaws in <code>2026-10-30-cause-analysis.md</code> with its checks, and the standalone pass, <code>2026-10-31-standalone-pass.md</code>. "Built today" is the orchestrator's summary from the root <code>CLAUDE.md</code> and the capability map.</p>
  <p>How the promises fit together, the candidate shape and the promises' wording come from <code>2026-11-01-engine-shape.md</code> and the four maps under <code>relationships/</code>, with that document's check. The cards and promises were then reconciled with the shape, each group checked on its own. The words are your decision 27.</p>
</footer>
</div>
'''

if __name__ == '__main__':
    import sys
    if len(sys.argv) == 3:  # draft preview: build_report.py <cards.json> <out.html>
        CARDS, OUT = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    build()
