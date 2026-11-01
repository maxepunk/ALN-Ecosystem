"""Build the owner-facing page for step 1, around the engine's jobs (decision 26).

Inputs: 2026-10-31-engine-jobs.json (the jobs, from the engine-jobs workflow;
          reconciled with the engine shape on 2026-11-01),
        2026-10-31-cause-cards.json (one card per design flaw, with diagrams;
          reconciled with the engine shape on 2026-11-01),
        2026-10-31-standalone-lines.json (one standalone line per flaw),
        2026-11-01-engine-shape.json (how the jobs fit together and the candidate
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
           'scoreboards': 'the scoreboards', 'config-tool': 'the config tool', 'tests': 'the tests'}
NAMES = {}  # part id -> plain name, filled from the shape by build()

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
        title = (j.get('functional') or {}).get('proposedTitle') or j['title']
        parts = ', '.join(NAMES[p] for p in j.get('parts', []))
        rows.append(f'<tr><th scope="row"><a href="#{j["id"].lower()}">{e(j["id"])}</a> {e(title)}</th><td>{prim}</td><td class="muted">{e(sec)}</td><td>{e(parts)}</td></tr>')
    return ('<div class="tablewrap"><table class="glance"><thead><tr><th>Job</th><th>Flaws that mainly block it</th><th>Also touched by</th><th>Parts that would carry it</th></tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table></div>')


def job_head(j):
    """The job's title and its restatement from the side of the people it serves (the engine shape, section 1)."""
    fn = j.get('functional')
    if not fn:
        roles = ''.join(f'<span class="chip role">{e(r)}</span>' for r in j['roles'])
        return (f'<h2>{e(j["title"])}</h2>'
                f'<p class="meaning">{e(j["meaning"].replace("section 4 asks", "a question at the end of this page asks"))}</p>'
                f'<div class="chips">{roles}</div>')
    proposed = fn.get('proposedTitle')
    title = proposed or j['title']
    was = (f'<p class="was">Proposed title. It was “{e(j["title"])}”.</p>' if proposed and proposed != j['title']
           else '<p class="was">Title kept.</p>')
    return (f'<h2>{e(title)}</h2>{was}'
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
            note = f' <span class="muted">(its card is under {e(where)})</span>' if where else ' <span class="muted">(proposed, question 23; it has no card)</span>'
            shorts.append(f'<li class="secondary"><span class="fid">{e(fid)}</span>{e(f["how"])}{note}</li>')
    goal_tag = 'The long-term goal' + (' <span class="open">(open for step 3)</span>' if j.get('goalOpen') else '')
    q = j.get('questions') or []
    qtext = ('Answers the pass\'s question' + ('s ' if len(q) > 1 else ' ') + ', '.join(map(str, q))) if q else 'No question of the nine covers it yet'
    cards = ''.join(card_html(by_id[f['id']]) for f in j['flaws'] if f['primary'] and f['id'] in by_id)
    return f'''
<section class="job" id="{j["id"].lower()}">
  <header class="job-head">
    <span class="jid">{e(j["id"])}</span>
    {job_head(j)}
  </header>
  {changed_html(j.get("shapeChange", ""))}
  {part_row(j.get("parts", []), NAMES, "Carried by these parts of the candidate shape")}
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


def job_links(ids):
    return ' '.join(f'<a href="#{i.lower()}">{e(i)}</a>' for i in ids)


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


def part_html(p):
    runs = ', '.join(RUNS_ON.get(r, r) for r in p['runsOn'])
    return f'''<article class="part" id="{p["id"].lower()}">
  <h4>{e(p["name"])}</h4>
  <p>{e(p["plain"])}</p>
  <p class="pmeta"><span class="tag">Serves</span> {job_links(p["jobs"])}</p>
  <p class="pmeta"><span class="tag">Removes</span> {flaw_links(p["flaws"])}</p>
  <p class="pmeta"><span class="tag">Runs on</span> {e(runs)}</p>
  <p class="pmeta muted"><span class="tag">Where it can be swapped</span> {e(p["seams"])}</p>
</article>'''


# The plain summary of the relationship map (the shape's section 2.1 and the end of its section 1).
FIT_SUMMARY = [
    ('A spine.', 'At every tap in a networked game, the designer\'s pack (J1) sets the rules, the game\'s record (J2) is what the tap is judged against, the answer (J3) comes back and the accepted tap joins the record, and the roles (J7) say who tapped and who may see the result.'),
    ('A ring.', 'The equipment (J4) reports what it is doing, the verdict (J9) turns that and the installer\'s profile (J8) into go, no-go or "not installed tonight", and the life of a game (J5) says when to check again and what to reset, which feeds back into the equipment. The profile feeds this loop from outside. In today\'s code the loop is also a chain of seven backend modules that depend on each other in a circle, with the game\'s record caught inside it.'),
    ('Two jobs reach the show from outside.', 'The designer\'s week (J6) and the developer\'s proof (J10) reach a live show only through the pack and through each engine having its own names, so a test or a preview never touches the live show.'),
    ('Not all ten are the same kind.', 'Seven jobs each produce something a person uses. J9 and J10 are qualities every other job must have: they become a label every fact carries (how sure, how old) and a proof every part must pass, not parts of their own. J5 is a table of moments (setup, start, pause, end, reset, restart, the next game) that every other job reads.'),
]

# The relationship map at a glance, drawn from the shape's section 2.1: the spine, the ring,
# and the two jobs that reach the show from outside. The full diagram (25 dependencies) follows it.
OVERVIEW = """flowchart TD
  subgraph spine["The spine: every tap"]
    J1["J1 The designer's game is what plays"]
    J2["J2 One game on every screen"]
    J3["J3 Every tap answered, the night told"]
    J7["J7 Each person sees and does their part"]
  end
  subgraph ring["The ring: the machinery"]
    J4["J4 The room does what was cued and asked"]
    J8["J8 Fit to tonight's venue"]
    J9["J9 Screens you can act on at a glance"]
    J5["J5 Each button does what it says"]
  end
  subgraph outside["From outside the show"]
    J6["J6 Designers change and try safely"]
    J10["J10 Proven before it reaches the show"]
  end
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
"""

# Which parts run where (the shape's section 4.3), one line per device.
FIT_DEVICES = [
    ('The engine', 'decides every fact of a networked game, serves the pack, admits every connection, answers every request through one door and sends every fact to the screens through one route.'),
    ('A GM tablet in a networked game', 'draws what it is sent, with each fact\'s label, and sends requests in one envelope. It keeps no list of its own and decides nothing before the engine answers.'),
    ('A GM tablet in a standalone game', 'is the same app with the switch set. In the candidate it runs the same record, lifecycle, answering and delivery parts the engine runs, with small stand-ins that report every engine duty (video, music, lights) as not installed tonight. The other way is its own engine, kept equal by tests.'),
    ('The phone and the ESP32', 'draw, send scans in one envelope, and read the reply words and the few rules they need as data made from the one source. They stay equal by sharing that data.'),
    ('The scoreboards', 'are one page in two places, the TV and the Pi 4, drawing what they are sent and deciding nothing.'),
    ('The config tool', 'holds the design studio and the installer\'s profile editor, and talks to the running engine only by message.'),
    ('The tests', 'run on an engine of their own, with stand-ins for the equipment, and never touch the live one.'),
]


def fit_html(shape):
    names = {p['id']: p['name'] for p in shape['parts']}
    summary = ''.join(f'<p><strong>{e(h)}</strong> {e(t)}</p>' for h, t in FIT_SUMMARY)
    mech = ''.join(f'<tr><th scope="row">{e(m["name"])}</th><td>{e(m["plain"])}</td><td class="idcell">{job_links(m["jobs"])}</td></tr>' for m in shape['mechanisms'])
    qual = ''.join(f'<tr><th scope="row">{e(q["name"])}</th><td>{e(q["plain"])}</td><td class="idcell">{job_links(q["jobs"])}</td></tr>' for q in shape['qualities'])
    tangles = ''.join(f'<li><strong>{e(t["title"])}.</strong> {e(t["plain"])} <span class="muted">Flaws: {flaw_links(t["flaws"])}</span></li>' for t in shape['today']['tangles'])
    rows = part_layers(shape)
    edge = {0: '<span class="lvl">Top</span>', len(rows) - 1: '<span class="lvl">Bottom</span>'}
    layers = ''.join(f'<li>{edge.get(k, "")}{"".join(part_link(i, names) for i in row)}</li>' for k, row in enumerate(rows))
    order = [i for row in reversed(rows) for i in row]
    by_id = {p['id']: p for p in shape['parts']}
    parts = ''.join(part_html(by_id[i]) for i in order)
    devices = ''.join(f'<li><strong>{e(h)}</strong> {e(t)}</li>' for h, t in FIT_DEVICES)
    alts = ''.join(f'<tr><th scope="row">{e(a["title"])}</th><td>{e(a["a"])}</td><td>{e(a["b"])}</td><td>{e(a["cost"])}</td></tr>' for a in shape['alternatives'])
    return f'''
<section class="fit" id="fit" aria-labelledby="fit-h">
  <h2 id="fit-h">How the jobs fit together</h2>
  <p class="intro">You asked how the ten jobs relate, so that the design serves all of them at once and stays easy to keep building. This section answers at two levels: the jobs against each other, and the jobs against the pieces of the engine. It ends in one candidate shape for the whole engine. Every card further down now follows that shape, and each says what changed.</p>
  <div class="fit-summary">{summary}</div>
  <figure class="dia wide">
    <figcaption>The jobs at a glance. An arrow runs from the job that produces something to the job that uses it; the label says what passes. The dashed line is a label every fact carries, not a dependency.</figcaption>
    <div class="scroll"><pre class="mermaid">{e(present(OVERVIEW))}</pre></div>
    <details>
      <summary>Every dependency between the jobs ({len(re.findall(r"-->", shape["relationsMermaid"]))})</summary>
      <p class="muted" style="margin:10px 0">The ones whose absence would break the job that uses them at a show tonight.</p>
      <div class="scroll"><pre class="mermaid">{e(present(shape["relationsMermaid"]))}</pre></div>
    </details>
  </figure>

  <div class="fit-block">
    <h3>What several jobs share</h3>
    <p>Most of today's problems sit in pieces of work that several jobs share, not inside one job: getting a fact onto a screen, answering a request, knowing who is connected, the boundary between one game and the next. Each is done several times today, in different places. These are the eleven the map found.</p>
    <div class="tablewrap"><table class="mech"><thead><tr><th>Shared piece</th><th>What it is, and how it is done today</th><th>Jobs</th></tr></thead><tbody>{mech}</tbody></table></div>
  </div>

  <div class="fit-block">
    <h3>Qualities every job must have</h3>
    <p>These are not pieces of the engine. Each is something every piece must be.</p>
    <div class="tablewrap"><table class="mech"><thead><tr><th>Quality</th><th>What it means</th><th>Jobs</th></tr></thead><tbody>{qual}</tbody></table></div>
  </div>

  <details>
    <summary>Where the jobs live in today's code: {len(shape["today"]["tangles"])} tangles</summary>
    <p class="muted" style="margin:10px 0">A tangle is one job spread over many places with nothing joining them, one place doing many jobs, or a dependency running the wrong way. Each causes some of the design flaws below.</p>
    <ul class="examples">{tangles}</ul>
  </details>

  <div class="fit-block">
    <h3>A candidate shape: {len(shape["parts"])} parts</h3>
    <p>One part per job or per shared piece of work. A quality is not a part: every part carries it. Each part uses only the parts in the rows below it, so nothing loops back. A change low down can affect the parts above it; nothing above can break what sits below. The parts that are already well built today (the game rules, the verdict, the health words) are the pattern for the rest.</p>
    <figure class="layers-fig">
      <figcaption>The parts in layers, top row first. Tap a part to read it.</figcaption>
      <ol class="layers">{layers}</ol>
    </figure>
    <div class="parts">{parts}</div>
    <details>
      <summary>The same parts as a diagram</summary>
      <p class="muted" style="margin:10px 0">An arrow means "uses".</p>
      <div class="scroll"><pre class="mermaid">{e(present(shape["partsMermaid"]))}</pre></div>
    </details>
  </div>

  <div class="fit-block">
    <h3>Which parts run where</h3>
    <ul class="devices">{devices}</ul>
    <details>
      <summary>As a diagram</summary>
      <div class="scroll"><pre class="mermaid">{e(present(shape["componentsMermaid"]))}</pre></div>
    </details>
  </div>

  <div class="fit-block">
    <h3>Where a real alternative exists</h3>
    <p>For these, the map found two sound ways to build the part. Step 3 puts each in front of you with designs side by side; no answer is needed now.</p>
    <div class="tablewrap"><table class="alts"><thead><tr><th>Choice</th><th>Candidate</th><th>The other way</th><th>What each costs</th></tr></thead><tbody>{alts}</tbody></table></div>
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
    for c in cards:
        bad = [p for p in c.get('parts', []) if p not in NAMES]
        assert not bad, f'{c["id"]} names unknown parts {bad}'
    for j in jobs:
        bad = [p for p in j.get('parts', []) if p not in NAMES]
        assert not bad, f'{j["id"]} names unknown parts {bad}'
    home = {f['id']: j['id'] for j in jobs for f in j['flaws'] if f['primary']}
    missing = [c for c in by_id if c not in home]
    assert not missing, f'flaws with no main job: {missing}'
    total = sum(c['findings'] for c in cards)
    aside = ''.join(f'<tr><th scope="row">{e(k)}</th><td class="num">{n}</td><td>{e(t)}</td></tr>' for k, n, t in SET_ASIDE)
    aside_n = sum(n for _, n, _ in SET_ASIDE)
    purpose = ''.join(f'<p>{e(x)}</p>' for x in data['purpose'])
    page = TEMPLATE.format(
        total=total, total_all=total + aside_n, aside_n=aside_n, purpose=purpose,
        glance=glance_html(jobs), fit=fit_html(shape), jobs=''.join(job_html(j, by_id, home) for j in jobs),
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
.q .changedrec {{ font-family: var(--font-label); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fault); }}
.changed {{ font-size: 15px; max-width: 80ch; background: var(--chip); border-radius: 6px; padding: 10px 14px; }}
.changed .tag {{ display: block; margin-bottom: 2px; color: var(--accent); }}
.partrow {{ display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }}
.partrow .tag {{ margin-right: 4px; }}
a.chip.part {{ text-decoration: none; color: var(--fg); border: 1px solid var(--accent); background: transparent; }}
a.chip.part:hover {{ background: var(--chip); }}
.job-head .was {{ grid-column: 2; font-size: 14px; color: var(--muted); }}
.job-head dl.who {{ grid-column: 2; display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0; font-size: 15px; max-width: 80ch; }}
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
@media (prefers-reduced-motion: reduce) {{ * {{ scroll-behavior: auto; }} }}
</style>
<div class="wrap">
<header class="top">
  <p class="eyebrow">Architecture pass · phase 1, step 1 · the engine's jobs and how they fit together · 2026-11-01</p>
  <h1>What the engine must do</h1>
  <p class="lead">The engine runs shows for any game, not only ALN. This page starts from its ten jobs: who each one serves, when, and what must happen for them. Then it maps how the jobs fit together, offers one candidate shape for the whole engine, and shows where today's design falls short. The problems from blue's shows appear as evidence and as test cases, not as the plan.</p>
</header>

<section class="decide" aria-labelledby="deciding">
  <h2 id="deciding">What you are deciding</h2>
  <p><strong>The jobs.</strong> Are these the right ten jobs for the engine, said from the side of the people they serve, and is one missing? Seven small questions, A to G, ask about their wording and whether three of them should split. The relationship map changed three of those recommendations: E, F and G.</p>
  <p><strong>How the jobs fit together.</strong> New since your last look: <a href="#fit">a map</a> of how the jobs depend on each other and on the pieces of the engine, and one candidate shape for the whole engine. The design on each card now follows that shape, and a note at the top of each card says what changed. Nothing in the shape is decided; it is where step 3 starts.</p>
  <p><strong>Standalone games, the game's record, the next step.</strong> Three questions about games with no engine, one about recording refused scans, and one about how much the test rig proves before design starts. Everything is <a href="#your-questions">at the end</a>, each with a recommendation.</p>
</section>

<section class="sa-box" aria-labelledby="purpose">
  <h2 id="purpose">What the engine is for</h2>
  {purpose}
</section>

<section class="howto" aria-label="How to read this page">
  <div>
    <h2>How to read a job</h2>
    <p>Each job says who relies on it, when, and what must happen for them. Then come what is built today, the long-term goal, and the parts of the candidate shape that would carry it. Under it sit the design flaws that keep it from being done well, each with a card.</p>
    <p>A card tells one moment at a show, why it happens, and shows two diagrams. <strong>Today</strong> shows how the problem happens now. <strong>Candidate, not decided</strong> shows how the candidate shape would remove it, and the card names the parts that would. Where the relationship map changed a card, a note at its top says what and why. Step 3 puts competing designs in front of you; nothing on the right is decided.</p>
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
      <dt>Adapter</dt><dd>The real thing plugged in at a seam, like VLC behind "play a video".</dd>
      <dt>Part</dt><dd>A piece of the engine at any size. The candidate shape has 17.</dd>
      <dt>Quality</dt><dd>Something every part must be, like honest or proven. Not a part.</dd>
    </dl>
  </div>
</section>

<section aria-labelledby="glance">
  <h2 id="glance">The ten jobs at a glance</h2>
  <p class="intro" style="margin:8px 0 14px">Each design flaw has one job it mainly blocks; its card sits there. Flaws also listed under other jobs point back to their card.</p>
  {glance}
</section>

{fit}

{jobs}

<section class="sa-box" aria-labelledby="standalone">
  <h2 id="standalone">Standalone games</h2>
  <p>Your decision 22 adds a requirement: a whole game can run with no engine, the GM tablet and the player scanners each working alone, as a choice the game declares and never mixed. In a standalone game the GM tablet decides everything about the game (used tokens, scores, teams, the game's start, pause and end) from its own hand-kept copies of the engine's rules. Each player scanner decides only whether a token is known, and the phone also whether it has seen that token before.</p>
  <p>Four design flaws cause no problem in a standalone game, four apply in part and eight in full. Each job and each card says what changes. The two biggest gaps: nothing says that a game is standalone, and every device shows the missing engine as a failure ("Offline" on the phone all night, red "DISCONNECTED" on the ESP32, "VIDEO UNAVAILABLE, Rescan later" for a video that can never play).</p>
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
    <h3>About the jobs</h3>
    <div class="q">
      <h3>Are these the right ten jobs, and does each now read from the side of the people it serves?</h3>
      <p>Is a job the engine must do for any game missing? Are two of them really one? Each job now leads with who relies on it, when, and what must happen for them. Eight have a proposed new title written that way, J8 and J9 among them; the old title shows under each. This replaces question 17.</p>
    </div>
    <div class="q">
      <p class="applied">Applied, please confirm</p>
      <h3>A. J1 now says nothing in the engine assumes ALN, and every part of the kit runs the same version of the pack and says which.</h3>
      <p>The relationship map agrees. The first is a quality every part carries. The second is the pack channel's version stamp on every copy, compared whenever a device connects.</p>
      <p class="rec">Recommendation: keep both. The first is what lets other games run; the second is the job that design flaw C12 breaks.</p>
    </div>
    <div class="q">
      <p class="applied">Applied, please confirm</p>
      <h3>B. J7 now also covers who may do what, not only who sees what.</h3>
      <p>Starting, pausing and ending a game and changing scores stay with the GM, and the stored passwords and keys change before outsiders touch the system. The map agrees: one part, connections and roles, holds both the pass and what it allows.</p>
      <p class="rec">Recommendation: agree.</p>
    </div>
    <div class="q">
      <p class="applied">Applied, please confirm</p>
      <h3>C. J8 now says a standalone game is a choice the game declares, never mixed.</h3>
      <p>These are your decision 22's words, and the map supports them: whether a game is standalone is an input every rule takes, and J8, the job that fits the game to tonight's setup, is where it is declared. Where the declaration is kept is a step-3 choice: the venue profile (the map's favourite, since it already says what the kit brings tonight), the pack, the game's record or each device.</p>
      <p>Question 23 is folded in here: is "nothing declares a game standalone" a design flaw of its own, with its own rule? If not, its eight problems join C9, C11 and C14 and the ESP32 parity list. On the map it lands on the same two parts either way.</p>
      <p class="rec">Recommendation: agree. On question 23, yes: three other rules (game boundaries, one answer per question, how old a copy is) need the declared fact as an input, and would otherwise each invent their own answer.</p>
    </div>
    <div class="q">
      <h3>D. Split J3 into "every tap gets its answer" and "the night can be told afterwards"?</h3>
      <p>Answering happens at the tap, for the GM or the player. The night's record is for you and the designer after the show: what is captured during play, the session bundle, the review. The map confirms the two share no part. Answering sits in the middle of the engine and serves five jobs. The night's record is written once, at the end of a game, and read by the designer's review. The parts are the same either way.</p>
      <p>Keeping one job means the GM at the tap and you after the show look for their need in one sentence. Splitting makes a job that no design flaw has as its main home yet, because the night's record is mostly planned work.</p>
      <p class="rec">Recommendation: split. Question 19 belongs with the night's record.</p>
    </div>
    <div class="q">
      <p class="changedrec">Recommendation changed by the map</p>
      <h3>E. Rename J8 rather than split it?</h3>
      <p>Fitting the game to tonight's venue is one part with an output of its own: the installer's profile, which says what the kit brings, binds each of the pack's names to a real instrument, and gives one go or no-go. The map found that "run in any setup" has no part of its own. Running with no engine is a switch every rule takes, declared as part of fitting the game. Running on another kit is each engine knowing its own names, which J10 owns. So a separate job for it would own nothing.</p>
      <p>Two new titles fit the map. "Fit the game to the venue, whatever the setup" keeps standalone games and other kits in the title. "Fit the game to the venue it is in tonight" names the installer's moment, and leaves standalone games to the job's first sentences and other kits to a quality of every job. The cost of not splitting: the GM running a standalone game and a future operator with another kit are named in a sentence, not in a title.</p>
      <p class="rec">Recommendation: rename rather than split, to "Fit the game to the venue it is in tonight", with standalone games kept in the job's first sentences. This replaces the earlier recommendation to split.</p>
    </div>
    <div class="q">
      <p class="changedrec">Recommendation changed by the map</p>
      <h3>F. J10: widen it, split it, or leave it?</h3>
      <p>The map splits J10 by moment, not by kind of work. Before every change, the developer's green run shows the show still works for ALN and for the toy game; that is a quality every part must pass, and checking that joined parts agree is part of it. On release day, you decide when a new version goes to the venue and can swap back by replugging a machine; that is one small part, the release, which checks that everything installed matches.</p>
      <ol type="a">
        <li>Widen J10's sentence to include release day. The proposed title does this: "A change is proven before it reaches anyone, and the owner alone sends it to the show".</li>
        <li>Split release day into a job of its own.</li>
        <li>File release day with the installer's deploy work under J8.</li>
        <li>Leave J10 as drafted. The parts fit that too; the cost is that your release day stays unnamed in a sentence about tests.</li>
      </ol>
      <p>Question 4 covers keeping tests away from the live show (C8). For the other three flaws under this job no question of the nine fits: question 5 is only the nearest for the names two parts share (C14), and the installed pieces (C15) and tests that prove the real path (C16) have none. This replaces question 18.</p>
      <p class="rec">Recommendation: widen, as the proposed title does, and give the proof and the release a question each in the pass. The earlier split into "prove it works" and "keep every part in step" does not match the map, because keeping joined parts in step is part of the proof.</p>
    </div>
    <div class="q">
      <p class="changedrec">Recommendation changed by the map</p>
      <h3>G. Which job carries the equipment's state to every screen?</h3>
      <p>The map's answer: neither job needs to carry the route. One part, delivery, carries every fact to every screen, game facts and equipment alike, each with its label (how sure, how old). The equipment decides its own state and health as one dated fact; delivery carries it; the screens draw it.</p>
      <p>The restated jobs already promise their halves. J4: the GM makes the room do a thing and sees it happen, or sees at once that it did not. J2: every screen agrees, also after a tablet comes back. If you still want one job to hold the words: in J4 they sit with the equipment whose state it is, but J4 then names a route J2 also needs; in J2 they match how the game's running state is already defined (the video queue, music, held items, the clock, each service's health), but J2's sentence then carries the equipment beside the game's record.</p>
      <p class="rec">Recommendation: change neither sentence. Both promises hold through the one delivery part, and C2's card stays under J4, where its moment at a show is felt. This replaces the earlier answer "J4", which put the route itself in J4.</p>
    </div>
  </div>

  <div class="qgroup">
    <h3>About standalone games</h3>
    <div class="q">
      <h3>22. The ESP32 gets a standalone mode matching the web scanner's.</h3>
      <p>Recorded that way under your parity rule. On the map, a yes means the standalone declaration must reach a device that has no idea of it today. Is that right?</p>
    </div>
    <div class="q">
      <h3>24. Does a standalone game run on one GM tablet?</h3>
      <p>Today two standalone tablets are two separate games. Several tablets sharing one game with no engine would need them to talk to each other directly, a large new piece. This also decides whether a standalone tablet's record of the night can hold player scans: only if the standalone player scanners hand their scans to that tablet.</p>
      <p class="rec">Recommendation: one tablet, unless you plan standalone games with two GMs.</p>
    </div>
    <div class="q">
      <h3>25. With no engine and no TV, what do exposed evidence and video tokens do?</h3>
      <p>This decides what the screens draw in those two cases.</p>
      <p class="rec">Suggestion: exposed evidence shows on the GM tablet's own scoreboard screen, which standalone already has. A video token shows its picture with a plain note instead of an error.</p>
    </div>
  </div>

  <div class="qgroup">
    <h3>About the game's record</h3>
    <div class="q">
      <h3>19. When a GM scan is refused, does the game keep a record of the attempt?</h3>
      <p>For example, a token already used, or no game running. Today only the tablet that scanned hears about it. On the map this decides whether the game's record keeps refused attempts, or only the answer goes back to the tablet.</p>
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
        <li>The game rules as one shared body of code that the engine and the tablet both run, or two bodies kept equal by tests.</li>
        <li>The equipment's interface: one per thing the room can do (play a video, light a scene), or one per outside program.</li>
        <li>The standalone tablet: the same record and lifecycle parts the engine runs, or an engine of its own.</li>
        <li>The scoreboard: one page in two places, or a view inside the GM app.</li>
        <li>The config tool: a separate program that talks to the engine by message, or a surface the engine itself serves.</li>
        <li>When a changed pack may be adopted while the engine runs. That is not built yet; the plan allows it only before a game starts or after it ends.</li>
        <li>Where the setting lives that says whether the engine starts each outside program or adopts one already running: in the installer's profile, as the candidate shape has it, or in a file of its own, as the capability map you approved has it.</li>
        <li>The order of the work: by part, with the engine's own names and delivery first since most flaws land on them, or by block as the roadmap has it.</li>
      </ol>
    </div>
  </div>
  <p class="muted">Decided so far: 20 (no rule for documents; documents are fixed as we go), 22 (standalone games join the requirements; never mixed) and 26 (the pass designs the best engine for the long term; blue's problems are clues, not the plan).</p>
</section>

<footer>
  <p>Built from <code>docs/plans/architecture-pass/2026-10-31-engine-jobs.md</code> (the jobs; its check held 171 claims and corrected 53), the list of design flaws in <code>2026-10-30-cause-analysis.md</code> with its checks, and the standalone pass, <code>2026-10-31-standalone-pass.md</code>. "Built today" is the orchestrator's summary from the root <code>CLAUDE.md</code> and the capability map.</p>
  <p>How the jobs fit together, the candidate shape and the restated jobs come from <code>2026-11-01-engine-shape.md</code> and the four maps under <code>relationships/</code>, with that document's check. The cards and jobs were then reconciled with the shape, each group checked on its own.</p>
</footer>
</div>
'''

if __name__ == '__main__':
    import sys
    if len(sys.argv) == 3:  # draft preview: build_report.py <cards.json> <out.html>
        CARDS, OUT = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    build()
