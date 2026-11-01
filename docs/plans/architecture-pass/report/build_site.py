"""Build the owner's site: five linked pages and a change log (decision 29, 2026-11-01).

Plan: site/2026-11-01-site-plan.md (the one source for the site's pages, anchors, markers and checks).
Inventory: site/inventory.md (every element of version 7 and its home on the site).

Inputs: 2026-10-31-cause-cards.json, 2026-10-31-engine-jobs.json, 2026-10-31-standalone-lines.json,
        2026-11-01-engine-shape.json, ../2026-10-31-standalone-pass.md (the ESP32 parity table), and the
        three overlays beside the plan: site/front.json, site/decisions.json, site/changes.json.
Output: site/index.html (the artifact's main page: no doctype, html, head or body tags), and
        site/decisions.html, promises.html, parts.html, flaws.html, changes.html (full documents).

Every Mermaid diagram is drawn at build time by render_diagrams.js (one call for the whole site) and
themed by diagram_theme.theme_svg(); no page loads Mermaid or any other script.

Self-contained: the renderers and texts it needs from build_report.py (version 7's builder) are copied
here and adapted, so build_report.py can retire.

Run: cd docs/plans/architecture-pass/report && MERMAID_JS=/path/to/mermaid.min.js python3 -I build_site.py
"""
import html
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))   # -I leaves the script's folder off the path; diagram_theme sits beside it
from diagram_theme import DIAGRAM_CSS, DIAGRAM_TOKENS_DARK, DIAGRAM_TOKENS_LIGHT, theme_svg  # noqa: E402

SITE = HERE / 'site'
CARDS = HERE / '2026-10-31-cause-cards.json'
JOBS = HERE / '2026-10-31-engine-jobs.json'
STANDALONE = HERE / '2026-10-31-standalone-lines.json'
SHAPE = HERE / '2026-11-01-engine-shape.json'
PASS = HERE.parent / '2026-10-31-standalone-pass.md'
FRONT = SITE / 'front.json'
DECISIONS = SITE / 'decisions.json'
CHANGES = SITE / 'changes.json'
RENDER = HERE / 'render_diagrams.js'

# ---------------------------------------------------------------------------------------------------
# Copied from build_report.py (version 7), unchanged unless a comment says otherwise.
# ---------------------------------------------------------------------------------------------------

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
    text(84, 26, 'Designer · Venue technician · GM · Players · Audience · Director · Developer · You', size=12.5)
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


# Version 7's stylesheet (build_report.py TEMPLATE), braces undoubled; stylesheet() adapts it.
V7_CSS = '''
/* Layout: one reading column; the engine's promises lead, each holding the design flaws that break it; evidence and questions at the end. */
:root {
  --bg: #f4f6f5; --surface: #ffffff; --fg: #17201e; --muted: #5b6965; --line: #d5dddb;
  --accent: #0f766e; --fault: #c2261f; --chip: #e7eeec; --chip-live: #fbe9e7;
  --font-body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-label: "IBM Plex Sans Condensed", "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #101614; --surface: #17201e; --fg: #e6ecea; --muted: #9babA6; --line: #2a3633;
  --accent: #4db6aa; --fault: #ff6f61; --chip: #22302c; --chip-live: #3a2220; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #101614; --surface: #17201e; --fg: #e6ecea; --muted: #9babA6; --line: #2a3633;
  --accent: #4db6aa; --fault: #ff6f61; --chip: #22302c; --chip-live: #3a2220; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font-family: var(--font-body); font-size: 16px; line-height: 1.55; }
.wrap { max-width: 1040px; margin: 0 auto; padding-block: 40px 72px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; grid-template-columns: minmax(0, 1fr); gap: 40px; }
h1, h2, h3 { text-wrap: balance; line-height: 1.2; margin: 0; }
h1 { font-size: clamp(30px, 5vw, 44px); font-weight: 600; letter-spacing: -0.01em; }
h2 { font-size: 24px; font-weight: 600; }
h3 { font-size: 19px; font-weight: 600; }
p { margin: 0; }
a { color: var(--accent); }
a:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.eyebrow, .tag, figcaption, .grid th span { font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; font-weight: 600; color: var(--muted); }
.muted { color: var(--muted); }
.lead { font-size: 18px; max-width: 68ch; }
header.top { display: grid; gap: 14px; }
.decide { border: 1px solid var(--line); border-left: 4px solid var(--accent); background: var(--surface); border-radius: 6px; padding: 18px 20px; display: grid; gap: 10px; }
.decide p { max-width: 72ch; }
.decided-note { font-size: 15px; max-width: 78ch; color: var(--muted); border-left: 3px solid var(--line); padding-left: 12px; }
.howto { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); }
.howto > div { display: grid; gap: 8px; align-content: start; }
.legend { display: flex; flex-wrap: wrap; gap: 10px 18px; font-size: 14px; }
.sw { display: inline-block; width: 22px; height: 14px; border-radius: 3px; border: 3px solid var(--fault); vertical-align: -2px; margin-right: 6px; }
.sw.owner { border-color: var(--accent); }
dl.terms { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; margin: 0; font-size: 15px; }
dl.terms dt { font-weight: 600; }
dl.terms dd { margin: 0; color: var(--muted); }
.toc { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
.tablewrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
.grid th, .grid td { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: middle; }
.grid thead th { white-space: normal; vertical-align: bottom; min-width: 64px; }
.grid tbody th { font-weight: 400; min-width: 220px; }
.grid tbody th a { font-family: var(--font-mono); font-weight: 500; text-decoration: none; margin-right: 4px; }
.grid td.dot { color: var(--accent); text-align: center; font-size: 15px; }
.family { display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px; }
.intro { max-width: 72ch; color: var(--muted); font-size: 17px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 22px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; scroll-margin-top: 16px; }
.wrap > *, .family > *, .card > * { min-width: 0; }
.card-head { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; align-items: baseline; }
.cid { font-family: var(--font-mono); font-weight: 500; font-size: 15px; color: var(--accent); }
.chips { grid-column: 2; display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-family: var(--font-label); font-size: 13px; background: var(--chip); border-radius: 999px; padding: 2px 10px; }
.chip.live { background: var(--chip-live); color: var(--fault); }
.story { display: grid; gap: 10px; max-width: 76ch; }
.story .tag, .design .tag, .live-note .tag { display: block; margin-bottom: 2px; }
.diagrams { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
figure.dia { margin: 0; border: 1px solid var(--line); border-radius: 6px; padding: 12px; display: grid; gap: 8px; align-content: start; min-width: 0; }
figure.dia.after { border-style: dashed; }
.scroll { overflow-x: auto; min-width: 0; }
pre.mermaid { margin: 0; background: transparent; font-size: 13px; text-align: center; }
.after-note { font-size: 14px; color: var(--muted); }
.standalone { border-left: 3px solid var(--accent); padding-left: 12px; }
.parity th, .parity td { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; font-size: 14px; }
.parity thead th { font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; color: var(--muted); }
.parity tbody th { font-weight: 600; min-width: 9em; }
.parity td { min-width: 12em; }
.parity tr.both-weak td, .parity tr.both-weak th { background: var(--chip); }
.sa-box { border: 1px solid var(--line); border-radius: 6px; background: var(--surface); padding: 18px 20px; display: grid; gap: 12px; }
.sa-box p { max-width: 76ch; }
.design { font-size: 15px; max-width: 80ch; border-top: 1px solid var(--line); padding-top: 14px; }
details summary { cursor: pointer; font-size: 15px; color: var(--accent); }
details[open] summary { margin-bottom: 10px; }
.examples { margin: 0 0 12px; padding-left: 18px; display: grid; gap: 6px; font-size: 15px; }
.ids { font-family: var(--font-mono); font-size: 13px; color: var(--muted); margin-right: 4px; }
.mods { display: flex; flex-wrap: wrap; gap: 6px; }
.mods code { font-family: var(--font-mono); font-size: 12.5px; background: var(--chip); border-radius: 4px; padding: 2px 6px; overflow-wrap: anywhere; }
.aside th, .aside td { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
.aside th { font-weight: 600; min-width: 9em; }
.num { font-variant-numeric: tabular-nums; text-align: right; }
.questions { display: grid; gap: 20px; }
.q { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 6px; padding: 18px 20px; display: grid; gap: 10px; }
.q ol { margin: 0; padding-left: 22px; display: grid; gap: 6px; }
.q .rec { font-weight: 500; }
footer { font-size: 14px; color: var(--muted); display: grid; gap: 6px; }
footer code { font-family: var(--font-mono); font-size: 13px; }
.job { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; padding-top: 8px; border-top: 2px solid var(--line); scroll-margin-top: 16px; }
.job > * { min-width: 0; }
.job-head { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
.job-head .kind { font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; font-weight: 600; color: var(--accent); }
.jid { font-family: var(--font-mono); font-weight: 500; font-size: 17px; color: var(--accent); }
.job-head .meaning { font-size: 17px; max-width: 74ch; }
.chip.role { background: transparent; border: 1px solid var(--line); }
.job-facts { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }
.job-facts > div { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px; display: grid; gap: 6px; align-content: start; }
.open { color: var(--fault); font-weight: 600; }
.short { display: grid; gap: 8px; }
.short ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
.short li { max-width: 80ch; }
.fid { font-family: var(--font-mono); font-weight: 500; margin-right: 6px; }
.secondary { color: var(--muted); }
.glance td, .glance th { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
.glance tbody th { font-weight: 500; min-width: 15em; }
.glance a { text-decoration: none; }
.qgroup { display: grid; gap: 14px; }
.qgroup > h3 { font-size: 17px; color: var(--muted); font-weight: 600; }
.q h3 { color: var(--fg); }
.q .applied { font-family: var(--font-label); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); }
.q .changedrec { font-family: var(--font-label); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fault); }
.changed { font-size: 15px; max-width: 80ch; background: var(--chip); border-radius: 6px; padding: 10px 14px; }
.changed .tag { display: block; margin-bottom: 2px; color: var(--accent); }
.partrow { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
.partrow .tag { margin-right: 4px; }
a.chip.part { text-decoration: none; color: var(--fg); border: 1px solid var(--accent); background: transparent; }
a.chip.part:hover { background: var(--chip); }
.job-head .was { font-size: 14px; color: var(--muted); }
.job-head dl.who { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0; font-size: 15px; max-width: 80ch; }
dl.who dt { font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; font-weight: 600; color: var(--muted); padding-top: 3px; }
dl.who dd { margin: 0; }
.fit { display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px; border-top: 2px solid var(--line); padding-top: 8px; }
.fit > * { min-width: 0; }
.fit-summary { display: grid; gap: 10px; max-width: 78ch; background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 6px; padding: 16px 20px; }
.fit-block { display: grid; gap: 10px; min-width: 0; }
.fit-block > *, .fit details { min-width: 0; }
.fit-block > p { max-width: 76ch; }
.mech th, .mech td, .alts th, .alts td { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
.mech thead th, .alts thead th { font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; color: var(--muted); }
.mech tbody th { font-weight: 600; min-width: 10em; }
.alts tbody th { font-weight: 600; min-width: 11em; }
.alts td { min-width: 14em; }
.idcell { font-family: var(--font-mono); font-size: 13px; min-width: 8em; }
.idcell a, .pmeta a { text-decoration: none; margin-right: 2px; }
.layers-fig { margin: 0; display: grid; gap: 8px; }
ol.layers { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
ol.layers li { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
ol.layers .lvl { font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px; font-weight: 600; color: var(--muted); min-width: 4.5em; }
.parts { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
.part { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px; display: grid; gap: 6px; align-content: start; scroll-margin-top: 16px; }
.part h4 { margin: 0; font-size: 16px; font-weight: 600; }
.part p { font-size: 14.5px; }
.pmeta .tag { margin-right: 6px; }
ul.devices { margin: 0; padding-left: 18px; display: grid; gap: 6px; max-width: 80ch; }
figure.dia.wide { padding: 12px; }
figure.dia.whole { padding: 14px; }
.svgwrap { min-width: 760px; }
.shape-svg { display: block; width: 100%; height: auto; color: var(--fg); }
.walks { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); }
figure.dia.walk { padding: 12px; }
figure.dia.walk pre.mermaid svg { min-width: 720px; }
.figkey { font-size: 14px; color: var(--muted); max-width: 80ch; }
.figkey .key { display: inline-block; width: 18px; height: 12px; border-radius: 3px; border: 3px solid; vertical-align: -1px; margin: 0 6px 0 10px; }
.figkey .key:first-child { margin-left: 0; }
.figkey .key.tap { border-color: #0f766e; }
.figkey .key.machine { border-color: #b45309; }
.figkey .key.outside { border: 2px dashed #6b7280; }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto; } }
'''

# ---------------------------------------------------------------------------------------------------
# The site: pages, anchors, links and markers (plan sections 1, 2 and 4).
# ---------------------------------------------------------------------------------------------------
PAGES = [  # key, file, name in the navigation and in [[page:]] markers
    ('engine', 'index.html', 'The engine'),
    ('decisions', 'decisions.html', 'Decisions'),
    ('promises', 'promises.html', 'Promises'),
    ('parts', 'parts.html', 'Parts'),
    ('flaws', 'flaws.html', 'Design flaws'),
    ('changes', 'changes.html', 'Change log'),
]
FILE = {k: f for k, f, _ in PAGES}
PAGE_NAME = {k: n for k, _, n in PAGES}
SITE_NAME = 'What the Engine Promises'
UPDATED = '2026-11-01'
STATUS_LINE = ('Architecture pass, phase 1, step 1. The shape is a candidate; nothing is decided unless a page '
               'says so. Updated 2026-11-01.')

PROMISE_ANCHOR = {'J1': 'designers-game', 'J2': 'one-game', 'J3': 'every-tap', 'J4': 'the-room',
                  'J5': 'lifecycle-buttons', 'J6': 'change-a-value', 'J7': 'each-person', 'J8': 'the-venue',
                  'J9': 'read-a-screen', 'J10': 'proven-change'}
N1_TITLE = 'Nothing declares a game standalone'   # question C's words for the proposed flaw (it has no card)

CUR = None          # the page being rendered; links within it are bare #anchors
TITLES = {}         # promise id -> its title; ids never reach a page (decision 27)
FLAW_TITLES = {}    # flaw id -> its title
QUESTIONS = {}      # question key -> its anchor


def part_anchor(name):
    """The part's name in lowercase, apostrophes dropped, other non-letters as hyphens (plan section 2)."""
    s = name.lower().replace("'", '').replace('’', '')
    return re.sub(r'[^a-z]+', '-', s).strip('-')


def href(page, anchor=None):
    if page == CUR:
        return '#' + (anchor or 'main')
    return FILE[page] + ('#' + anchor if anchor else '')


def promise_a(jid, text=None, quotes=False, cls=''):
    if jid not in TITLES:
        raise SystemExit(f'unknown promise {jid}')
    t = e(text if text is not None else TITLES[jid])
    if quotes and text is None:
        t = f'“{t}”'
    c = f' class="{cls}"' if cls else ''
    return f'<a{c} href="{href("promises", PROMISE_ANCHOR[jid])}">{t}</a>'


def promise_link(jid):
    """Version 7's promise link: the title in quotes."""
    return promise_a(jid, quotes=True)


def promise_links(ids):
    return '<br/>'.join(promise_link(i) for i in ids)


def part_a(pid, text=None, chip=False):
    if pid not in NAMES:
        raise SystemExit(f'unknown part {pid}')
    c = ' class="chip part"' if chip else ''
    return f'<a{c} href="{href("parts", part_anchor(NAMES[pid]))}">{e(text if text is not None else NAMES[pid])}</a>'


def part_link(pid, names=None):
    return part_a(pid, chip=True)


def part_row(pids, names, label):
    if not pids:
        return ''
    return f'<div class="partrow"><span class="tag">{e(label)}</span>{"".join(part_link(p) for p in pids)}</div>'


def flaw_a(fid, text=None, cls=''):
    if fid not in FLAW_TITLES:
        raise SystemExit(f'unknown design flaw {fid}')
    c = f' class="{cls}"' if cls else ''
    return f'<a{c} href="{href("flaws", fid.lower())}">{e(text if text is not None else FLAW_TITLES[fid])}</a>'


def flaw_links(ids):
    """Flaw ids as links to their cards; the proposed N1 links to its short entry."""
    return ' '.join(flaw_a(i, i) for i in ids)


def q_text(key, capital):
    word = 'Question' if capital else 'question'
    if key == 'promises':
        return ('The' if capital else 'the') + ' promises question'
    return f'{word} {key}'


def q_a(key, capital=False, text=None):
    if key not in QUESTIONS:
        raise SystemExit(f'unknown question {key}')
    return f'<a href="{href("decisions", QUESTIONS[key])}">{e(text if text is not None else q_text(key, capital))}</a>'


def page_a(name, text=None):
    if name not in FILE:
        raise SystemExit(f'unknown page {name}')
    return f'<a href="{href(name)}">{e(text if text is not None else PAGE_NAME[name])}</a>'


MARKER = re.compile(r'\[\[([a-z]+):([^\]|]+)(?:\|([^\]]*))?\]\]')
PAGE_OVERRIDE = {}   # (page marker) -> href, for one list whose page links land on a table row


def rich(text):
    """Plain overlay text to HTML: escape the text around each [[marker]] and resolve the marker (plan 4)."""
    out, pos = [], 0
    for m in MARKER.finditer(text):
        out.append(e(text[pos:m.start()]))
        kind, key, label = m.group(1), m.group(2).strip(), m.group(3)
        if kind == 'promise':
            out.append(promise_a(key, label))
        elif kind == 'part':
            out.append(part_a(key, label))
        elif kind == 'flaw':
            out.append(flaw_a(key, label))
        elif kind == 'q':
            before = text[:m.start()].rstrip()
            capital = before == '' or before[-1] in '.!?:'
            out.append(q_a(key, capital, label))
        elif kind == 'page':
            if key in PAGE_OVERRIDE:
                out.append(f'<a href="{PAGE_OVERRIDE[key]}">{e(label or PAGE_NAME[key])}</a>')
            else:
                out.append(page_a(key, label))
        else:
            raise SystemExit(f'unknown marker kind in [[{kind}:{key}]]: {text[:80]}')
        pos = m.end()
    out.append(e(text[pos:]))
    rest = MARKER.sub('', text)
    if '[[' in rest or ']]' in rest:
        raise SystemExit(f'a marker did not resolve: {text[:120]}')
    return ''.join(out)


def li(items):
    return ''.join(f'<li>{rich(x)}</li>' for x in items)


def paras(items, cls=''):
    c = f' class="{cls}"' if cls else ''
    return ''.join(f'<p{c}>{rich(x)}</p>' for x in items)


# ---------------------------------------------------------------------------------------------------
# Diagrams: collected while the pages render, drawn in one call, themed, then placed (plan 5.1).
# ---------------------------------------------------------------------------------------------------
DIAGRAMS = []   # (key, source after present(), caption)


def diagram(src, caption):
    n = sum(1 for k, _, _ in DIAGRAMS if k.startswith(f'd-{CUR}-'))
    key = f'd-{CUR}-{n}'
    DIAGRAMS.append((key, src, caption))
    return f'<div class="dia-svg" role="img" aria-label="{e(caption)}">@@SVG:{key}@@</div>'


def draw_all():
    with tempfile.TemporaryDirectory() as tmp:
        src = pathlib.Path(tmp) / 'in.json'
        out = pathlib.Path(tmp) / 'out.json'
        src.write_text(json.dumps([{'key': k, 'src': s} for k, s, _ in DIAGRAMS]))
        r = subprocess.run(['node', str(RENDER), str(src), str(out)], env=os.environ.copy(),
                           capture_output=True, text=True)
        if r.returncode != 0:
            raise SystemExit(f'render_diagrams.js failed:\n{r.stdout}\n{r.stderr}')
        svgs = json.loads(out.read_text())
    missing = [k for k, _, _ in DIAGRAMS if k not in svgs]
    if missing:
        raise SystemExit(f'diagrams not drawn: {missing}')
    themed = {}
    for k, _, _ in DIAGRAMS:
        try:
            themed[k] = theme_svg(svgs[k], k)
        except ValueError as ex:
            raise SystemExit(f'diagram theming failed: {ex}')
    print(f'drew {len(themed)} diagrams in one call of render_diagrams.js')
    return themed


# ---------------------------------------------------------------------------------------------------
# Version 7's renderers, adapted for the site.
# ---------------------------------------------------------------------------------------------------
def card_html(c, level=4):
    """A flaw card (version 7's card_html), without its "what changed" note, which moved to the change log."""
    ex = ''.join(f'<li><span class="ids">{e(x["ids"])}</span> {e(x["text"])}</li>' for x in c['examples'])
    mods = ''.join(f'<code>{e(m)}</code>' for m in c['modules'])
    live = f'<p class="live-note"><span class="tag">Seen live</span> {e(c["seenLive"])}</p>' if c.get('seenLive') else ''
    sa = c.get('inStandalone', '')
    sa_html = f'<p class="standalone"><span class="tag">In a standalone game</span> {e(sa)}</p>' if sa else ''
    return f'''
<article class="card" id="{c["id"].lower()}">
  <header class="card-head">
    <span class="cid">{e(c["id"])}</span>
    <h{level}>{e(c["title"])}</h{level}>
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
      <div class="scroll">{diagram(present(c["before"]["mermaid"]), c["before"]["caption"])}</div>
    </figure>
    <figure class="dia after">
      <figcaption>{e(c["after"]["caption"])}</figcaption>
      <div class="scroll">{diagram(present(c["after"]["mermaid"]), c["after"]["caption"])}</div>
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
        rows.append(f'<tr><th scope="row">{flaw_a(c["id"], c["id"])} {e(c["title"])}</th>{"".join(cells)}</tr>')
    return f'<div class="tablewrap"><table class="grid"><thead><tr><th scope="col">Design flaw</th>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>'


def parity_html():
    body = ''.join(
        f'<tr{" class=both-weak" if weak else ""}><td class="num">{n}</td><th scope="row">{e(c[0])}</th><td>{e(c[1])}</td><td>{e(c[2])}</td><td>{e(c[3])}</td></tr>'
        for n, c, weak in parity_rows())
    return ('<div class="tablewrap"><table class="parity"><thead><tr><th>#</th><th>Behaviour</th>'
            '<th>Web scanner, standalone</th><th>ESP32, no engine</th><th>What the ESP32 would need (candidate)</th>'
            f'</tr></thead><tbody>{body}</tbody></table></div>')


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


def part_html(p):
    """A part card (version 7's part_html); links now cross to the promises and design-flaw pages."""
    also = [j for j in p.get('jobs', []) if j not in KEEPS.get(p['id'], [])]
    runs = ', '.join(RUNS_ON.get(r, r) for r in p['runsOn'] if r != 'gm-tablet-standin')
    if 'gm-tablet-standin' in p['runsOn']:
        runs += '; in a standalone game, a small stand-in on the GM tablet'
    return f'''<article class="part" id="{part_anchor(p["name"])}">
  <h3>{e(p["name"])}</h3>
  <p>{e(p["plain"])}</p>
  <p class="pmeta"><span class="tag">Mainly keeps</span> {promise_links(KEEPS.get(p["id"], []))}</p>
  {f'<p class="pmeta muted"><span class="tag">Also needed by</span> {promise_links(also)}</p>' if also else ''}
  {f'<p class="pmeta"><span class="tag">Today</span> {e(TODAY[p["id"]])}</p>' if p["id"] in TODAY else ''}
  <p class="pmeta"><span class="tag">Removes</span> {flaw_links(p["flaws"])}</p>
  <p class="pmeta"><span class="tag">Runs on</span> {e(runs)}</p>
  <p class="pmeta muted"><span class="tag">Where it can be swapped</span> {e(p["seams"])}</p>
</article>'''


# Texts version 7 wrote inline in its template and fit_html, copied here (the inventory's notes for the
# builder, note 1). Where a text pointed "below" on the one page, it now names the page it points to.
OVERVIEW_KEY = ('<span class="key tap"></span>what happens at every tap <span class="key machine"></span>the engine\'s own '
                'machinery <span class="key outside"></span>from outside the show. Each arrow runs from a promise to one '
                'that cannot be kept without it, and says what passes. The dotted line is a label every fact carries, '
                'not a dependency.')
RELATIONS_NOTE = ('{n} are dependencies: without them, the promise at the arrow\'s end cannot be kept at a show. One is a '
                  'quality and one is shared work; they are drawn dotted.')
QUALITIES_INTRO = ('A quality is not a part. It is something every part must have, so that a promise holds everywhere '
                   'and not in one place only.')
TANGLE_NOTE = ('A tangle is one piece of work spread over many places with nothing joining them, one place doing many '
               'kinds of work, or a dependency running the wrong way. Each causes some of the design flaws on '
               '[[page:flaws]].')
WHOLE_KEY = ('Every request comes in through Answering and gets one reply; every fact goes out to the screens through '
             'Delivery, with its label (how old, how sure). Delivery reads what changed in the game record, the '
             'lifecycle, the room and the pack channel; no part sends to it. Behind the two doors sit the game\'s facts, '
             'the life of a game and the room; the parts above build on the foundations, directly or through another '
             'part. The arrows show what passes at a show. Before a start, the lifecycle hands the verdict tonight\'s '
             'profile and what is running, and asks for go, no-go or not installed tonight; it also takes up a new pack '
             'from the pack channel, only between games. The two doors and their arrows are drawn in teal; the dashed '
             'box is an outside program, not a part. The rows group the parts by what they do; they are not the layers '
             'of use, which [[page:parts]] gives. In a standalone game the GM tablet runs the same doors, game record '
             'and lifecycle itself, with small stand-ins for connections, the room, the verdict and the engine\'s names. '
             'Five moments on [[page:parts]] follow single steps through the parts.')
MOMENTS_KEY = ('Each moment follows one thing that happens at a show through the parts that handle it, in order. Solid '
               'arrows are requests; dashed arrows are answers. Delivery always asks what changed; nothing pushes facts '
               'to it. Each screen asked Delivery, when it connected, to keep it up to date; Delivery\'s dashed arrows to '
               'screens answer that standing request.')
LAYERS_CAPTION = ('The parts in layers, top row first. Each part uses only the parts in the rows below it, so nothing '
                  'loops back: a change low down can affect the parts above it, and nothing above can break what sits '
                  'below. Tap a part to read it.')
USES_NOTE = 'An arrow means "uses". No arrow loops back.'
ALTS_INTRO = ('For these, the map found two sound ways to build a part or to word a promise. Step 3 puts each in front '
              'of you with designs side by side; no answer is needed now.')
WORDS_INTRO = ('The site\'s own words come first. The rest are the words step 3 uses; each card on [[page:flaws]] ends '
               'with the reason restated in them.')
LEGEND = ('<div class="legend"><span><span class="sw"></span>where it goes wrong</span>'
          '<span><span class="sw owner"></span>the one place that would own the fact</span></div>')
STANDALONE_P1 = ('Your decision 22 adds a requirement: a whole game can run with no engine, the GM tablet and the player '
                 'scanners each working alone, as a choice the game declares and never mixed. In a standalone game the '
                 'GM tablet decides everything about the game (used tokens, scores, teams, the game\'s start, pause and '
                 'end) from its own hand-kept copies of the engine\'s rules. Each player scanner decides only whether a '
                 'token is known, and the phone also whether it has seen that token before.')
STANDALONE_P2 = ('Four design flaws cause no problem in a standalone game, four apply in part and eight in full. Each '
                 'promise and each card says what changes. The two biggest gaps: nothing says that a game is standalone, '
                 'and every device shows the missing engine as a failure ("Offline" on the phone all night, red '
                 '"DISCONNECTED" on the ESP32, "VIDEO UNAVAILABLE, Rescan later" for a video that can never play).')
PARITY_NOTE = ('Your parity rule says the two player scanners match wherever possible. Shaded rows are ones where both '
               'are weak, or the web scanner is the weaker side, so matching it would copy a gap.')
EVIDENCE_INTRO = ('{total_all} problems came from blue\'s records and the maps of today\'s engine; {total} of them sit '
                  'under the design flaws above, and {aside_n} needed no change to the design. The standalone pass added '
                  '{sa_all} more: {sa_cards} placed under the same flaws, and {sa_n1} under the proposed [[flaw:N1|N1]] '
                  'that question 23 asks about, now folded into [[q:C]].')
GRID_NOTE = 'A dot means the flaw\'s problems sit in that part of the engine.'
STEP3_HEAD = 'The map leaves these choices to you.'
STEP3_INTRO = ('Step 3 puts each in front of you with designs side by side. They are listed here so nothing arrives as '
               'a surprise.')

FOOTERS = {   # each page names the documents it is built from (plan 2), by name, not by file
    'engine': [
        'Built from the promises document of 2026-10-31 (what the engine is for, who counts on each promise and '
        'when), the engine-shape document of 2026-11-01 (the candidate engine drawn whole), the after-game report of '
        '2026-11-01 (around the engine), decisions 20 to 29 on the program\'s state page, and the shared vocabulary '
        '(the words).',
    ],
    'decisions': [
        'Built from the questions of version 7; the engine-shape document of 2026-11-01 (its alternatives and the '
        'choices it leaves to step 3); the cause analysis of 2026-10-30; the standalone pass of 2026-10-31; the '
        'after-game report of 2026-11-01; and decisions 20 to 29 on the program\'s state page.',
    ],
    'promises': [
        'Built from the promises document of 2026-10-31 (its check held 171 claims and corrected 53) and the '
        'standalone pass of 2026-10-31. "Built today" is summarized from the project guide and the capability map.',
        'How the promises depend on each other, the parts that keep them and the promises\' wording come from the '
        'engine-shape document of 2026-11-01 and the four relationship maps it was drawn from, with that document\'s '
        'check.',
    ],
    'parts': [
        'Built from the engine-shape document of 2026-11-01 and the four relationship maps it was drawn from, with '
        'that document\'s check: the qualities, the seventeen parts, which part uses which, the moments, which part '
        'would run where, the tangles and the alternatives. Which promises each part keeps comes from the promises '
        'document of 2026-10-31.',
    ],
    'flaws': [
        'Built from the cause analysis of 2026-10-30 with its two checks, and the standalone pass of 2026-10-31 with '
        'the ESP32 parity table. The cards were reconciled with the engine-shape document of 2026-11-01, each group '
        'checked on its own.',
    ],
    'changes': [
        'Built from the page\'s version history and decisions 20 to 29 on the program\'s state page, the first wording '
        'of each promise in the promises document of 2026-10-31, the notes each card and promise carried after the '
        'relationship map, and the shared vocabulary.',
    ],
}


# ---------------------------------------------------------------------------------------------------
# The shared stylesheet: version 7's tokens and components, plus the site's frame.
# ---------------------------------------------------------------------------------------------------
SITE_CSS = '''
/* The site's frame: one gutter on the outer wrapper, a sticky navigation bar under the safe area,
   the status line, and the components the new pages add. Every colour is a token. */
.site { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.site > * { max-width: 1040px; margin-left: auto; margin-right: auto; box-sizing: border-box; }
body::before { content: ""; position: fixed; top: 0; left: 0; right: 0; height: env(safe-area-inset-top, 0px); background: var(--nav-bg); z-index: 30; }
.skip { position: absolute; left: -9999px; top: 0; }
.skip:focus { left: max(16px, env(safe-area-inset-left, 0px)); top: calc(env(safe-area-inset-top, 0px) + 8px); z-index: 40; background: var(--surface); padding: 6px 10px; border-radius: 6px; }
.sitenav { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 20; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; padding: 10px 0; background: var(--nav-bg); box-shadow: 0 0 0 100vmax var(--nav-bg); clip-path: inset(0 -100vmax); font-family: var(--font-label); font-size: 14.5px; font-weight: 500; }
.sitenav a { color: var(--fg); text-decoration: none; padding: 2px 0; border-bottom: 2px solid transparent; }
.sitenav a:hover { border-bottom-color: var(--line); }
.sitenav a[aria-current="page"] { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
.sitenav .site-name { font-weight: 600; letter-spacing: 0.01em; margin-right: 6px; }
.sitenav .count { display: inline-block; min-width: 1.6em; text-align: center; font-size: 12px; line-height: 1.5; border-radius: 999px; background: var(--accent); color: var(--on-accent); margin-left: 4px; padding: 0 5px; }
.status { font-size: 14px; color: var(--muted); padding: 10px 0 0; margin-top: 0; margin-bottom: 0; }
main.wrap { padding-top: 24px; }
:root { --anchor-gap: calc(env(safe-area-inset-top, 0px) + 104px); }
[id] { scroll-margin-top: var(--anchor-gap); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
h1, h2, h3, h4 { text-wrap: balance; }
section { display: grid; gap: 14px; min-width: 0; }
section > * { min-width: 0; }
.page-head { display: grid; gap: 14px; }
.page-head p { max-width: 72ch; }
.prose { display: grid; gap: 10px; }
.prose p { max-width: 76ch; }
.where-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr)); }
.where-grid > div { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 16px 18px; display: grid; gap: 8px; align-content: start; }
.where-grid > div.open-now { border-left: 4px solid var(--accent); }
.where-grid h3 { font-size: 17px; }
.where-grid ul, .plain-list { margin: 0; padding-left: 18px; display: grid; gap: 8px; font-size: 15px; }
.moments { display: grid; gap: 14px; }
.moment { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 6px; padding: 16px 18px; display: grid; gap: 12px 28px; grid-template-columns: minmax(0, 17rem) minmax(0, 1fr); align-items: start; }
.moment-meta, .moment-counts { display: grid; gap: 10px; align-content: start; min-width: 0; }
@media (max-width: 720px) { .moment { grid-template-columns: minmax(0, 1fr); } }
.moment h3 { font-size: 18px; }
.moment .when { font-size: 14.5px; color: var(--muted); }
.moment ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; font-size: 14.5px; }
.moment ul.counts { list-style: none; padding-left: 0; gap: 10px; }
.moment ul.counts a { font-weight: 500; }
.moment ul.counts span { display: block; color: var(--muted); }
.around { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); align-items: start; }
.around-item { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px; display: grid; gap: 6px; align-content: start; font-size: 14.5px; }
.around-item h3 { font-size: 16px; }
.around-item .tag { margin-right: 6px; }
.guide { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.guide li { display: grid; grid-template-columns: minmax(7.5em, max-content) 1fr; gap: 2px 14px; max-width: 86ch; }
.guide li a { font-weight: 600; }
.words { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); }
.words h3 { font-size: 16px; margin-bottom: 6px; }
.q { scroll-margin-top: var(--anchor-gap); }
.q h4 { font-size: 19px; font-weight: 600; line-height: 1.25; margin: 0; color: var(--fg); }
.q ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; font-size: 15px; }
.q .block { display: grid; gap: 4px; }
.q ul.options { list-style: none; padding-left: 0; gap: 8px; }
.q ul.options li { border-left: 3px solid var(--line); padding-left: 10px; }
.q ul.options strong { font-weight: 600; }
.q .rec { border-top: 1px solid var(--line); padding-top: 10px; }
.q .rec .tag { display: block; color: var(--accent); margin-bottom: 2px; }
.stag { justify-self: start; font-family: var(--font-label); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; border-radius: 999px; padding: 2px 10px; border: 1px solid var(--line); color: var(--muted); }
.stag.s-applied { color: var(--accent); border-color: var(--accent); }
.stag.s-changed { color: var(--fault); border-color: var(--fault); background: var(--chip-live); }
.q.q-applied { border-left-color: var(--accent); }
.q.q-changed { border-left-color: var(--fault); }
.q.q-open { border-left-color: var(--line-strong); }
.qgroup > h3 { font-size: 17px; color: var(--muted); font-weight: 600; }
ol.step3 { margin: 0; padding-left: 22px; display: grid; gap: 6px; max-width: 86ch; }
.decided-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.decided-list li { display: grid; grid-template-columns: minmax(8.5em, max-content) 1fr; gap: 2px 14px; max-width: 92ch; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; }
.decided-list .dn { font-family: var(--font-label); font-weight: 600; }
.decided-list .dd { display: block; font-size: 13px; color: var(--muted); font-weight: 500; }
.log-entry { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 16px 18px; display: grid; gap: 8px; scroll-margin-top: var(--anchor-gap); }
.log-entry h3 { font-size: 18px; }
.log-entry .when { font-family: var(--font-label); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; color: var(--muted); }
.log-entry ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; font-size: 15px; max-width: 86ch; }
.log-entry .prompt { font-size: 15px; color: var(--muted); border-left: 3px solid var(--accent); padding-left: 12px; max-width: 86ch; }
.log-entry .was-title { font-size: 15px; }
.log-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }
.beforeafter { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); }
.beforeafter > div { display: grid; gap: 4px; align-content: start; font-size: 15px; }
.fgroup { display: grid; gap: 16px; border-top: 2px solid var(--line); padding-top: 10px; }
.fgroup > h3 { font-size: 20px; }
.fgroup > h3 .tag { display: block; margin-bottom: 4px; }
.card-head h4 { font-size: 19px; font-weight: 600; line-height: 1.2; margin: 0; }
.card.proposed { border-style: dashed; }
.flawtable th, .flawtable td { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
.flawtable thead th, .glance thead th { font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; color: var(--muted); }
.flawtable tbody th { font-weight: 500; min-width: 16em; }
.flawtable td { min-width: 9em; }
.flawtable td.num { min-width: 4em; }
.flawtable .fid, .glance .fid { font-family: var(--font-mono); font-weight: 500; margin-right: 4px; }
.flawtable a, .glance a { text-decoration: none; }
.glance td { min-width: 12em; font-size: 14px; }
.glance td.flawcell { min-width: 9em; }
.lead-in { max-width: 78ch; }
.alts tbody tr { scroll-margin-top: var(--anchor-gap); }
.alts tbody tr:target th, .alts tbody tr:target td { background: var(--chip); }
.part h3 { margin: 0; font-size: 16px; font-weight: 600; }
footer.site-foot { padding: 32px 0 48px; border-top: 1px solid var(--line); font-size: 14px; color: var(--muted); display: grid; gap: 6px; }
footer.site-foot p { max-width: 90ch; }
footer.site-foot code { font-family: var(--font-mono); font-size: 13px; overflow-wrap: anywhere; }
.dia-svg { margin: 0; background: transparent; font-size: 13px; text-align: center; }
figure.dia.walk .dia-svg svg { min-width: 720px; }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
'''

BASE_RESET = (':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);'
              'padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}'
              '[hidden]{display:none!important}')
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans+Condensed:wght@500;600&display=swap">')

# New tokens the site adds, light and dark (every colour on the site is a token).
SITE_TOKENS_LIGHT = '--nav-bg: #ffffff; --on-accent: #ffffff; --line-strong: #9fb0ab;'
SITE_TOKENS_DARK = '--nav-bg: #17201e; --on-accent: #0b1210; --line-strong: #4a5a56;'


def stylesheet():
    css = V7_CSS
    # The diagram and site tokens join version 7's three :root blocks: light, then the two dark ones.
    light_end = css.index('}', css.index(':root {'))
    css = css[:light_end] + '  ' + DIAGRAM_TOKENS_LIGHT + ' ' + SITE_TOKENS_LIGHT + '\n' + css[light_end:]
    dark_tail = 'color-scheme: dark; }'
    if css.count(dark_tail) != 2:
        raise SystemExit('the stylesheet should have two dark :root blocks')
    css = css.replace(dark_tail, DIAGRAM_TOKENS_DARK + ' ' + SITE_TOKENS_DARK + ' ' + dark_tail)
    # pre.mermaid is gone: its rules now style .dia-svg (SITE_CSS); the overview key's swatches take tokens.
    css = css.replace('pre.mermaid { margin: 0; background: transparent; font-size: 13px; text-align: center; }\n', '')
    css = css.replace('figure.dia.walk pre.mermaid svg { min-width: 720px; }\n', '')
    css = css.replace('.figkey .key.tap { border-color: #0f766e; }', '.figkey .key.tap { border-color: var(--accent); }')
    css = css.replace('.figkey .key.machine { border-color: #b45309; }', '.figkey .key.machine { border-color: var(--warm); }')
    css = css.replace('.figkey .key.outside { border: 2px dashed #6b7280; }', '.figkey .key.outside { border: 2px dashed var(--muted); }')
    css = css.replace('scroll-margin-top: 16px', 'scroll-margin-top: var(--anchor-gap)')
    # Version 7's part-card rules also matched the part chips (a.chip.part), giving each chip the card's
    # padding; they now apply to the card alone.
    for a, b in (('\n.part {', '\narticle.part {'), ('\n.part h4 {', '\narticle.part h4 {'), ('\n.part p {', '\narticle.part p {')):
        if css.count(a) != 1:
            raise SystemExit(f'the stylesheet changed: {a.strip()}')
        css = css.replace(a, b)
    # The gutter moves from .wrap to the outer wrapper .site (set once).
    css = css.replace('padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); ', '')
    if 'pre.mermaid' in css or '#0f766e' in css.split('@media (prefers-color-scheme')[1]:
        raise SystemExit('a pre.mermaid rule or a literal colour was left in the stylesheet')
    return css + SITE_CSS + DIAGRAM_CSS


def nav(page, open_n):
    links = []
    for k, f, name in PAGES:
        cur = ' aria-current="page"' if k == page else ''
        if k == 'decisions':
            links.append(f'<a href="{f}"{cur} aria-label="Decisions, {open_n} open questions">Decisions'
                         f'<span class="count" aria-hidden="true">{open_n}</span></a>')
        else:
            links.append(f'<a href="{f}"{cur}>{e(name)}</a>')
    return (f'<nav class="sitenav" aria-label="Pages of this site"><a class="site-name" href="index.html">{e(SITE_NAME)}</a>'
            + ''.join(links) + '</nav>')


def shell(page, title, body, css, open_n):
    footer = ''.join(f'<p>{p}</p>' for p in FOOTERS[page])
    content = (f'<div class="site">\n<a class="skip" href="#main">Skip to the page</a>\n{nav(page, open_n)}\n'
               f'<p class="status">{e(STATUS_LINE)}</p>\n<main class="wrap" id="main">\n{body}\n</main>\n'
               f'<footer class="site-foot">{footer}</footer>\n</div>\n')
    if page == 'engine':
        return (f'<title>{e(title)}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n{FONTS}\n'
                f'<style>{css}</style>\n{content}')
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            f'<title>{e(title)}</title>\n<style>{BASE_RESET}</style>\n{FONTS}\n<style>{css}</style>\n</head>\n<body>\n'
            f'{content}</body>\n</html>\n')


# ---------------------------------------------------------------------------------------------------
# The pages (plan section 3).
# ---------------------------------------------------------------------------------------------------
def page_engine(D):
    f, purpose = D['front'], D['jobs_data']['purpose']
    w = f['whereYouAre']
    moments = ''.join(f'''<article class="moment">
  <div class="moment-meta">
    <h3>{e(m["name"])}</h3>
    <p class="when">{e(m["when"])}</p>
    <div><span class="tag">Who is there</span><ul>{"".join(f"<li>{e(p)}</li>" for p in m["people"])}</ul></div>
  </div>
  <div class="moment-counts"><span class="tag">What they count on</span><ul class="counts">{"".join(f"<li>{promise_a(p['id'])}<span>{rich(p['why'])}</span></li>" for p in m["promises"])}</ul></div>
</article>''' for m in f['moments'])
    fit = ''.join(f'<p><strong>{e(p["head"])}</strong> {rich(p["text"])}</p>' for p in f['fitSummary'])
    around = ''.join(f'''<article class="around-item">
  <h3>{e(a["name"])}</h3>
  <p>{rich(a["what"])}</p>
  <p><span class="tag">How it connects</span>{rich(a["connects"])}</p>
  <p class="muted"><span class="tag">Status</span>{rich(a["status"])}</p>
</article>''' for a in f['around'])
    around_fig = ''
    if f.get('aroundMermaid', '').strip():
        cap = 'Around the engine: what sits outside it and how each connects'
        around_fig = f'''<figure class="dia wide">
    <figcaption>{e(cap)}</figcaption>
    <div class="scroll">{diagram(present(f["aroundMermaid"]), cap)}</div>
  </figure>'''
    guide = ''.join(f'<li>{page_a(g["page"])}<span>{rich(g["line"])}</span></li>' for g in f['siteGuide'])

    def terms(group):
        return ''.join(f'<dt>{e(t["term"])}</dt><dd>{rich(t["def"])}</dd>' for t in f['words'] if t['group'] == group)
    return f'''<header class="top page-head">
  <h1>What the engine promises</h1>
  <p class="lead">{rich(f["lead"])}</p>
</header>

<section id="where" aria-labelledby="where-h">
  <h2 id="where-h">Where things stand</h2>
  <div class="where-grid">
    <div class="open-now"><h3>Open for you</h3><ul>{li(w["open"])}</ul></div>
    <div><h3>Decided lately</h3><ul>{li(w["decided"])}</ul></div>
    <div><h3>What comes next</h3><ul>{li(w["next"])}</ul></div>
  </div>
</section>

<section class="sa-box" id="purpose" aria-labelledby="purpose-h">
  <h2 id="purpose-h">What the engine is for</h2>
  {"".join(f"<p>{e(x)}</p>" for x in purpose)}
</section>

<section id="moments" aria-labelledby="moments-h">
  <h2 id="moments-h">Who counts on the engine, and when</h2>
  <div class="moments">{moments}</div>
  <p class="standalone">{rich(f["standaloneLine"])}</p>
</section>

<section class="fit" id="fit" aria-labelledby="fit-h">
  <h2 id="fit-h">How it fits together</h2>
  <figure class="dia whole">
    <figcaption>The candidate engine, whole</figcaption>
    <div class="scroll"><div class="svgwrap">{shape_svg()}</div></div>
    <p class="figkey">{rich(WHOLE_KEY)}</p>
  </figure>
  <div class="fit-summary">{fit}</div>
</section>

<section id="around" aria-labelledby="around-h">
  <h2 id="around-h">Around the engine</h2>
  <div class="around">{around}</div>
  {around_fig}
</section>

<section id="guide" aria-labelledby="guide-h">
  <h2 id="guide-h">How to use these pages</h2>
  <ul class="guide">{guide}</ul>
</section>

<section id="words" aria-labelledby="words-h">
  <h2 id="words-h">The words</h2>
  <p>{rich(WORDS_INTRO)}</p>
  <div class="words">
    <div><h3>This site's words</h3><dl class="terms">{terms("page")}</dl></div>
    <div><h3>The words step 3 uses</h3><dl class="terms">{terms("design")}</dl></div>
  </div>
</section>'''


STATUS_TEXT = {'open': 'Open', 'applied': 'Applied, please confirm', 'changed': 'Recommendation changed by the map'}


def question_html(q):
    key = q['key']
    prefix = '' if key == 'promises' else f'{key}. '
    opts = ''
    if q.get('options'):
        opts = ('<div class="block"><span class="tag">The options, and what each costs</span><ul class="options">'
                + ''.join(f'<li><strong>{rich(o["label"])}</strong> {rich(o["cost"])}</li>' for o in q['options'])
                + '</ul></div>')
    return f'''<div class="q q-{q["status"]}" id="{q["anchor"]}">
  <p class="stag s-{q["status"]}">{e(STATUS_TEXT[q["status"]])}</p>
  <h4>{e(prefix)}{rich(q["heading"])}</h4>
  <div class="block"><span class="tag">What it decides</span><p>{rich(q["decides"])}</p></div>
  <div class="block"><span class="tag">What we know</span><ul>{li(q["evidence"])}</ul></div>
  {opts}
  <p class="rec"><span class="tag">{e(q["recKind"])}</span>{rich(q["recommendation"])}</p>
</div>'''


def page_decisions(D):
    d = D['decisions']
    groups = ''.join(f'''<div class="qgroup">
    <h3>{e(g["title"])}</h3>
    {"".join(question_html(q) for q in g["questions"])}
  </div>''' for g in d['groups'])
    # A step-3 item that has a row in the alternatives table links to that row (plan 3.2, item 3).
    items = []
    for s in d['step3']:
        alt = STEP3_ALT.get(next((k for k in STEP3_ALT if s['text'].startswith(k)), None))
        if alt is not None:
            PAGE_OVERRIDE['parts'] = href('parts', alt)
        items.append(f'<li>{rich(s["text"])}</li>')
        PAGE_OVERRIDE.clear()
    decided = ''.join(f'<li><span class="dn">Decision {x["n"]}<span class="dd">{e(x["date"])}</span></span><span>{rich(x["line"])}</span></li>'
                      for x in d['decided'])
    return f'''<header class="page-head">
  <h1>Decisions</h1>
  <div class="prose">{paras(d["intro"])}</div>
</header>

<section class="questions" id="open" aria-labelledby="open-h">
  <h2 id="open-h">Open now</h2>
  {groups}
</section>

<section class="questions" id="step-3" aria-labelledby="step-3-h">
  <h2 id="step-3-h">Coming in step 3, no answer needed</h2>
  <div class="q">
    <h4>{e(STEP3_HEAD)}</h4>
    <p>{e(STEP3_INTRO)}</p>
    <ol class="step3">{"".join(items)}</ol>
  </div>
</section>

<section id="decided" aria-labelledby="decided-h">
  <h2 id="decided-h">Decided</h2>
  <ul class="decided-list">{decided}</ul>
</section>'''


def glance_html(jobs):
    """The ten at a glance: title, who, when, the parts that keep it, the flaws that break it (main one first)."""
    rows = []
    for j in jobs:
        fn = j['functional']
        prim = [f['id'] for f in j['flaws'] if f['primary']]
        sec = [f['id'] for f in j['flaws'] if not f['primary']]

        def fl(i):
            return flaw_a(i, i, 'fid') + (' <span class="muted">(proposed)</span>' if i == 'N1' else '')
        main = ' '.join(fl(i) for i in prim) or '<span class="muted">none yet</span>'
        also = ' '.join(fl(i) for i in sec)
        flaws = f'<span class="tag">Main</span> {main}' + (f'<br/><span class="tag">Also</span> {also}' if also else '')
        parts = ', '.join(part_a(p) for p in j.get('parts', []))
        rows.append(f'<tr><th scope="row">{promise_a(j["id"])}</th><td>{e(fn["people"])}</td><td>{e(fn["moment"])}</td>'
                    f'<td>{parts}</td><td class="flawcell">{flaws}</td></tr>')
    return ('<div class="tablewrap"><table class="glance"><thead><tr><th>Promise</th><th>Who</th><th>When</th>'
            '<th>Parts that would keep it</th><th>Design flaws that break it</th></tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table></div>')


def promise_html(j, by_id):
    """A promise entry (version 7's job_html), without its earlier wording, its "what changed" note and its
    cards: the first two moved to the change log, the cards to the design-flaws page."""
    fn = j['functional']
    anchor = PROMISE_ANCHOR[j['id']]
    needs = ''.join(f'<li>{e(n)}</li>' for n in j['needs'])
    tests = ''.join(f'<li>{e(t)}</li>' for t in j['tests'])
    shorts = []
    for f in sorted(j['flaws'], key=lambda f: not f['primary']):
        fid = f['id']
        link = flaw_a(fid, fid, 'fid')
        note = ' <span class="muted">(proposed)</span>' if fid not in by_id else ''
        cls = '' if f['primary'] else ' class="secondary"'
        shorts.append(f'<li{cls}>{link}{e(f["how"])}{note}</li>')
    standalone = re.sub(r'^In a standalone game:\s*', '', j['standalone'])
    goal_tag = 'The long-term goal' + (' <span class="open">(open for step 3)</span>' if j.get('goalOpen') else '')
    q = j.get('questions') or []
    qtext = ('Answers the pass\'s question' + ('s ' if len(q) > 1 else ' ') + ', '.join(map(str, q))) if q else 'No question of the nine covers it yet'
    return f'''
<section class="job" id="{anchor}" aria-labelledby="{anchor}-h">
  <header class="job-head">
    <h2 id="{anchor}-h">{e(TITLES[j["id"]])}</h2>
    <dl class="who"><dt>Who</dt><dd>{e(fn["people"])}</dd><dt>When</dt><dd>{e(fn["moment"])}</dd></dl>
  </header>
  <div class="countson"><span class="tag">What they count on</span><p class="meaning">{e(fn["need"])}</p></div>
  <div class="job-facts">
    <div><span class="tag">Built today</span><p>{e(BUILT.get(j["id"], ""))}</p></div>
    <div><span class="tag">{goal_tag}</span><p>{e(j["goal"])}</p></div>
  </div>
  {part_row(j.get("parts", []), NAMES, "Kept by these parts of the candidate shape")}
  <div class="short">
    <span class="tag">Broken by these design flaws today, the main one first</span>
    <ul>{"".join(shorts) or '<li class="muted">No design flaw breaks this promise mainly: its planned parts are not built yet.</li>'}</ul>
  </div>
  <p class="standalone"><span class="tag">In a standalone game</span> {e(standalone)}</p>
  <details><summary>What the planned capabilities need from it ({len(j["needs"])})</summary><ul class="examples">{needs}</ul></details>
  <details><summary>Test cases from the shows ({len(j["tests"])}); {e(qtext)}</summary><ol class="examples">{tests}</ol></details>
</section>'''


def page_promises(D):
    jobs, shape = D['jobs'], D['shape']
    head, text = FIT_SUMMARY[3]
    n_links = len(re.findall(r"-\.?->", shape["relationsMermaid"]))
    n_deps = len(re.findall(r"[^.]-->", shape["relationsMermaid"]))
    overview = present(overview_src(jobs)).replace('"useMaxWidth": false}, "sequence"', '"useMaxWidth": false, "nodeSpacing": 20}, "sequence"', 1)
    rel_cap = f'The {n_links} main links between the promises'
    return f'''<header class="page-head">
  <h1>Promises</h1>
  <div class="prose">{paras(D["front"]["intros"]["promises"])}</div>
</header>

<section id="glance" aria-labelledby="glance-h">
  <h2 id="glance-h">The ten at a glance</h2>
  <p class="lead-in"><strong>{e(head)}</strong> {e(text)}</p>
  {glance_html(jobs)}
</section>

<section id="depend" aria-labelledby="depend-h">
  <h2 id="depend-h">How the promises depend on each other</h2>
  <figure class="dia wide">
    <figcaption>The promises at a glance</figcaption>
    <p class="figkey">{OVERVIEW_KEY}</p>
    <div class="scroll">{diagram(overview, "The promises at a glance")}</div>
    <details>
      <summary>{e(rel_cap)}</summary>
      <p class="muted" style="margin:10px 0">{e(RELATIONS_NOTE.format(n=n_deps))}</p>
      <div class="scroll">{diagram(present(relations_src(shape)), rel_cap)}</div>
    </details>
  </figure>
</section>

<section id="the-ten" aria-labelledby="the-ten-h">
  <h2 id="the-ten-h">The ten promises</h2>
</section>
{"".join(promise_html(j, D["by_id"]) for j in jobs)}'''


# The step-3 items that have a row in the alternatives table (plan 3.2, item 3): the item's opening words
# and the row's anchor on the parts page. The build checks that all six find their item.
STEP3_ALT = {
    'Getting facts onto screens': 'alt-delivery',
    'The life of a game': 'alt-lifecycle',
    'The game rules as one shared body': 'alt-rules',
    "The equipment's interface": 'alt-equipment',
    'The standalone tablet': 'alt-standalone-tablet',
    'The scoreboard': 'alt-scoreboard',
}
ALT_ANCHORS = ['alt-delivery', 'alt-rules', 'alt-equipment', 'alt-standalone-tablet', 'alt-answer-and-record',
               'alt-lifecycle', 'alt-scoreboard', 'alt-release']
ALT_TITLE_START = ['Getting state onto screens', 'The rules', 'Equipment', 'The standalone tablet',
                   "The tap's answer and the night's record", 'The lifecycle', 'The scoreboard', 'Release day']


def page_parts(D):
    shape = D['shape']
    assert len(shape['qualities']) == len(QUALITY_KEEPS), 'the qualities changed: update QUALITY_KEEPS'
    quality_today = {3: today_of(shape['mechanisms'][10]['plain'])}   # who decides with no engine: today's way
    qual = ''.join(f'<tr><th scope="row">{e(q["name"])}</th><td>{e(q["plain"])}' + (f' <span class="muted">Today: {e(quality_today[k])}</span>' if k in quality_today else '') + f'</td><td>{promise_links(QUALITY_KEEPS[k])}</td></tr>' for k, q in enumerate(shape['qualities']))
    tangles = ''.join(f'<li><strong>{e(t["title"])}.</strong> {e(t["plain"])} <span class="muted">Flaws: {flaw_links(t["flaws"])}</span></li>' for t in shape['today']['tangles'])
    rows = part_layers(shape)
    edge = {0: '<span class="lvl">Top</span>', len(rows) - 1: '<span class="lvl">Bottom</span>'}
    layers = ''.join(f'<li>{edge.get(k, "")}{"".join(part_link(i) for i in row)}</li>' for k, row in enumerate(rows))
    order = [i for row in reversed(rows) for i in row]
    by_id = {p['id']: p for p in shape['parts']}
    parts = ''.join(part_html(by_id[i]) for i in order)
    devices = ''.join(f'<li><strong>{e(h)}</strong> {e(t)}</li>' for h, t in FIT_DEVICES)
    walks = ''.join(f'''<figure class="dia walk">
      <figcaption>{e(title)}</figcaption>
      <p class="figkey">Keeps {"; ".join(promise_link(j) for j in keeps)}.</p>
      <div class="scroll">{diagram(present(src), title)}</div>
    </figure>''' for title, keeps, src in WALKS)
    if len(shape['alternatives']) != len(ALT_ANCHORS):
        raise SystemExit('the alternatives changed: update ALT_ANCHORS')
    for a, start in zip(shape['alternatives'], ALT_TITLE_START):
        if not a['title'].startswith(start):
            raise SystemExit(f'alternative "{a["title"]}" no longer matches its anchor (ALT_TITLE_START)')
    alts = ''.join(f'<tr id="{anc}"><th scope="row">{e(a["title"])}</th><td>{e(a["a"])}</td><td>{e(a["b"])}</td><td>{e(a["cost"])}</td></tr>'
                   for a, anc in zip(shape['alternatives'], ALT_ANCHORS))
    n_uses = len(re.findall(r"-->", shape["partsMermaid"]))
    uses_cap = f'Which part uses which: {n_uses} links'
    return f'''<header class="page-head">
  <h1>Parts</h1>
  <div class="prose">{paras(D["front"]["intros"]["parts"])}</div>
</header>

<section class="fit-block" id="qualities" aria-labelledby="qualities-h">
  <h2 id="qualities-h">Qualities every part must have</h2>
  <p>{e(QUALITIES_INTRO)}</p>
  <div class="tablewrap"><table class="mech"><thead><tr><th>Quality</th><th>What it means</th><th>Mainly keeps</th></tr></thead><tbody>{qual}</tbody></table></div>
</section>

<section class="fit-block" id="layers" aria-labelledby="layers-h">
  <h2 id="layers-h">The parts in layers</h2>
  <figure class="layers-fig">
    <figcaption>{e(LAYERS_CAPTION)}</figcaption>
    <ol class="layers">{layers}</ol>
  </figure>
  <details>
    <summary>{e(uses_cap)}</summary>
    <p class="muted" style="margin:10px 0">{e(USES_NOTE)}</p>
    <div class="scroll">{diagram(present(shape["partsMermaid"]), uses_cap)}</div>
  </details>
</section>

<section class="fit-block" id="moments" aria-labelledby="moments-h">
  <h2 id="moments-h">Five moments, part by part</h2>
  <p>{e(MOMENTS_KEY)}</p>
  <div class="walks">{walks}</div>
</section>

<section class="fit-block" id="the-parts" aria-labelledby="the-parts-h">
  <h2 id="the-parts-h">The seventeen parts</h2>
  <div class="parts">{parts}</div>
</section>

<section class="fit-block" id="where-they-run" aria-labelledby="where-they-run-h">
  <h2 id="where-they-run-h">Which part would run where</h2>
  <ul class="devices">{devices}</ul>
  <details>
    <summary>As a diagram</summary>
    <div class="scroll">{diagram(present(shape["componentsMermaid"]), "Which part would run where, as a diagram")}</div>
  </details>
</section>

<section class="fit-block" id="tangles" aria-labelledby="tangles-h">
  <h2 id="tangles-h">Where today's code tangles</h2>
  <details>
    <summary>Where the promises' work sits in today's code: {len(shape["today"]["tangles"])} tangles</summary>
    <p class="muted" style="margin:10px 0">{rich(TANGLE_NOTE)}</p>
    <ul class="examples">{tangles}</ul>
  </details>
</section>

<section class="fit-block" id="alternatives" aria-labelledby="alternatives-h">
  <h2 id="alternatives-h">Where a real alternative exists</h2>
  <p>{e(ALTS_INTRO)}</p>
  <div class="tablewrap"><table class="alts"><thead><tr><th>Choice</th><th>The candidate</th><th>The other way</th><th>What each costs</th></tr></thead><tbody>{alts}</tbody></table></div>
</section>'''


def n1_html(D):
    """The proposed N1, a short entry: no card, no record in the cards data. Its text comes from the promises'
    four lines for N1, question C and the standalone pass (inventory row 73)."""
    lines = D['n1_lines']
    main = [(j, h) for j, h, p in lines if p]
    also = [(j, h) for j, h, p in lines if not p]
    parts = D['n1_parts']
    also_html = ''.join(f'<li>{promise_a(j)}: {e(h)}</li>' for j, h in also)
    return f'''
<article class="card proposed" id="n1">
  <header class="card-head">
    <span class="cid">N1</span>
    <h4>{e(N1_TITLE)}</h4>
    <div class="chips"><span class="chip">Proposed</span><span class="chip">{D["n1_findings"]} problems found</span></div>
  </header>
  <div class="story">
    <p><span class="tag">What breaks</span> {e(main[0][1])}</p>
    <div><span class="tag">It also touches</span><ul class="examples">{also_html}</ul></div>
  </div>
  {part_row(parts, NAMES, "Removed by these parts of the candidate shape")}
  <p class="design"><span class="tag">Proposed, with no card</span> {rich("Whether it is a design flaw of its own, with its own rule, is [[q:C]], where question 23 is folded in. Its problems come from the standalone pass.")}</p>
</article>'''


def page_flaws(D):
    cards, jobs, by_id, home = D['cards'], D['jobs'], D['by_id'], D['home']
    # The flaws at a glance.
    others = {}
    for j in jobs:
        for f in j['flaws']:
            if not f['primary']:
                others.setdefault(f['id'], []).append(j['id'])
    rows = []
    entries = [(c['id'], c['title'], c.get('parts', []), c['findings'], bool(c.get('seenLive'))) for c in
               sorted(cards, key=lambda c: int(c['id'][1:]))]
    entries.append(('N1', N1_TITLE + ' (proposed)', D['n1_parts'], D['n1_findings'], False))
    for fid, title, parts, n, live in entries:
        main = promise_a(home[fid], quotes=True)
        oth = '<br/>'.join(promise_a(x, quotes=True) for x in others.get(fid, []))
        rows.append(f'<tr><th scope="row">{flaw_a(fid, fid, "fid")} {flaw_a(fid, title)}</th>'
                    f'<td>{main}</td><td class="muted">{oth}</td><td>{", ".join(part_a(p) for p in parts)}</td>'
                    f'<td class="num">{n}</td><td>{"Seen live" if live else ""}</td></tr>')
    table = ('<div class="tablewrap"><table class="flawtable"><thead><tr><th>Design flaw</th><th>Mainly breaks</th>'
             '<th>Also breaks</th><th>Parts that would remove it</th><th>Findings</th><th>Seen live</th></tr></thead>'
             f'<tbody>{"".join(rows)}</tbody></table></div>')
    # The cards, grouped under the promise each mainly breaks.
    groups = []
    for j in jobs:
        mine = [f['id'] for f in j['flaws'] if f['primary']]
        if not mine:
            continue
        body = ''.join(card_html(by_id[i]) if i in by_id else n1_html(D) for i in mine)
        anchor = 'under-' + PROMISE_ANCHOR[j['id']]
        groups.append(f'''<div class="fgroup" id="{anchor}">
  <h3><span class="tag">Mainly breaks</span>{promise_a(j["id"])}</h3>
  {body}
</div>''')
    total = sum(c['findings'] for c in cards)
    aside_n = sum(n for _, n, _ in SET_ASIDE)
    aside = ''.join(f'<tr><th scope="row">{e(k)}</th><td class="num">{n}</td><td>{e(t)}</td></tr>' for k, n, t in SET_ASIDE)
    sa_all = len(D['new_findings'])
    sa_n1 = sum(1 for f in D['new_findings'] if f['cause'].startswith('N1'))
    intro = EVIDENCE_INTRO.format(total_all=total + aside_n, total=total, aside_n=aside_n, sa_all=sa_all,
                                  sa_cards=sa_all - sa_n1, sa_n1=sa_n1)
    D['totals'] = (total, aside_n, total + aside_n)
    return f'''<header class="page-head">
  <h1>Design flaws</h1>
  <div class="prose">{paras(D["front"]["intros"]["flaws"])}</div>
  {LEGEND}
</header>

<section id="glance" aria-labelledby="glance-h">
  <h2 id="glance-h">The flaws at a glance</h2>
  {table}
</section>

<section class="family" id="cards" aria-labelledby="cards-h">
  <h2 id="cards-h">The cards</h2>
  {"".join(groups)}
</section>

<section class="sa-box" id="standalone" aria-labelledby="standalone-h">
  <h2 id="standalone-h">Standalone games</h2>
  <p>{e(STANDALONE_P1)}</p>
  <p>{e(STANDALONE_P2)}</p>
  <details>
    <summary>The ESP32 against the web scanner with no engine: {len(parity_rows())} differences</summary>
    <p class="muted" style="margin:10px 0">{e(PARITY_NOTE)}</p>
    {parity_html()}
  </details>
</section>

<section id="evidence" aria-labelledby="evidence-h">
  <h2 id="evidence-h">The evidence</h2>
  <p class="intro">{rich(intro)}</p>
  <details>
    <summary>The {aside_n} set aside, and why</summary>
    <div class="tablewrap"><table class="aside"><tbody>{aside}</tbody></table></div>
  </details>
  <details>
    <summary>Where each flaw lives in today's code</summary>
    <p class="muted" style="margin:10px 0">{e(GRID_NOTE)}</p>
    {grid_html(sorted(cards, key=lambda c: int(c['id'][1:])))}
  </details>
</section>'''


def page_changes(D):
    c = D['changes']
    versions = ''.join(f'''<article class="log-entry" id="v{e(v["version"])}">
  <p class="when">Version {e(v["version"])} · {e(v["date"])}</p>
  <h3>{e(v["title"])}</h3>
  <ul>{li(v["items"])}</ul>
  <p class="prompt"><span class="tag">What prompted it</span> {rich(v["prompt"])}</p>
</article>''' for v in c['versions'])
    proms = ''.join(f'''<article class="log-entry" id="was-{PROMISE_ANCHOR[p["id"]]}">
  <h3>{promise_a(p["id"])}</h3>
  <p class="was-title"><span class="tag">Earlier wording, as a job</span> “{e(p["earlierTitle"])}”</p>
  <ul>{li(p["changes"])}</ul>
</article>''' for p in c['promises'])
    cards = ''.join(f'''<article class="log-entry" id="changed-{x["id"].lower()}">
  <h3><span class="cid">{e(x["id"])}</span> {flaw_a(x["id"])}</h3>
  <ul>{li(x["changes"])}</ul>
</article>''' for x in c['cards'])
    recs = ''.join(f'''<article class="log-entry" id="rec-{r["key"].lower()}">
  <h3>{q_a(r["key"], True)}</h3>
  <div class="beforeafter">
    <div><span class="tag">Before</span><p>{rich(r["before"])}</p></div>
    <div><span class="tag">After</span><p>{rich(r["after"])}</p></div>
  </div>
  <p class="prompt"><span class="tag">Why</span> {rich(r["why"])}</p>
</article>''' for r in c['recommendations'])
    return f'''<header class="page-head">
  <h1>Change log</h1>
  <div class="prose">{paras(c["intro"])}</div>
</header>

<section id="versions" aria-labelledby="versions-h">
  <h2 id="versions-h">Versions</h2>
  {versions}
</section>

<section id="earlier-wording" aria-labelledby="earlier-wording-h">
  <h2 id="earlier-wording-h">The promises' earlier wording</h2>
  <div class="log-grid">{proms}</div>
</section>

<section id="card-changes" aria-labelledby="card-changes-h">
  <h2 id="card-changes-h">The cards</h2>
  <div class="log-grid">{cards}</div>
</section>

<section id="recommendations" aria-labelledby="recommendations-h">
  <h2 id="recommendations-h">Recommendations the map changed</h2>
  {recs}
</section>

<section id="vocabulary" aria-labelledby="vocabulary-h">
  <h2 id="vocabulary-h">The words</h2>
  <ul class="plain-list">{li(c["vocabulary"])}</ul>
</section>'''


# ---------------------------------------------------------------------------------------------------
# Checks (plan 5.2), failing loudly.
# ---------------------------------------------------------------------------------------------------
def strip_svgs(s):
    return re.sub(r'<svg\b.*?</svg>', ' ', s, flags=re.S)


def visible_text(s):
    s = re.sub(r'<style\b.*?</style>', ' ', s, flags=re.S)
    s = re.sub(r'<[^>]+>', ' ', s)
    return html.unescape(s)


def prose_words(s):
    s = re.sub(r'<style\b.*?</style>', ' ', s, flags=re.S)
    for tag in ('svg', 'table', 'nav', 'footer', 'code', 'pre', 'title'):
        s = re.sub(rf'<{tag}\b.*?</{tag}>', ' ', s, flags=re.S)
    return len(re.findall(r"[A-Za-z0-9][\w'’.,-]*", html.unescape(re.sub(r'<[^>]+>', ' ', s))))


def check(pages, D):
    fails = []
    ids = {}
    for k, s in pages.items():
        found = re.findall(r'\sid="([^"]+)"', s)
        ids[k] = set(found)
        outside = re.findall(r'\sid="([^"]+)"', strip_svgs(s))
        dup = sorted({x for x in outside if outside.count(x) > 1})
        if dup:
            fails.append(f'{FILE[k]}: duplicate ids {dup}')
    by_file = {FILE[k]: k for k in pages}
    n_links = 0
    for k, s in pages.items():
        body_only = re.sub(r'<nav class="sitenav".*?</nav>', '', s, flags=re.S)
        for h in re.findall(r'<a\b[^>]*?\shref="([^"]*)"', s):
            n_links += 1
            if re.match(r'[a-z]+:', h):
                fails.append(f'{FILE[k]}: link out of the site {h}')
                continue
            f, _, anchor = h.partition('#')
            target = k if f == '' else by_file.get(f)
            if target is None:
                fails.append(f'{FILE[k]}: link to a missing page {h}')
            elif anchor and anchor not in ids[target]:
                fails.append(f'{FILE[k]}: link {h} finds no id "{anchor}" on {FILE[target]}')
            elif f == FILE[k] and f'href="{h}"' in body_only:
                fails.append(f'{FILE[k]}: link {h} names its own page; use a bare #anchor')
        if '[[' in s or ']]' in visible_text(s):
            fails.append(f'{FILE[k]}: an unresolved marker')
        if '@@SVG:' in s:
            fails.append(f'{FILE[k]}: a diagram was not placed')
        text = visible_text(s)
        for m in re.finditer(r'\bJ(?:10|[1-9])\b', text):
            fails.append(f'{FILE[k]}: a promise id in visible text: ...{text[max(0, m.start() - 50):m.end() + 30]!r}')
        if k != 'changes':
            for m in re.finditer(r'\b(?:jobs?|installers?)\b', text, re.I):
                fails.append(f'{FILE[k]}: retired word "{m.group(0)}": ...{text[max(0, m.start() - 50):m.end() + 30]!r}')
        if re.search(r'<script\b', s, re.I) or 'mermaid.min.js' in s or 'class="mermaid"' in s:
            fails.append(f'{FILE[k]}: the page loads a script or Mermaid')
        cur = re.findall(r'<a [^>]*aria-current="page"[^>]*>', s)
        if len(cur) != 1 or f'href="{FILE[k]}"' not in cur[0]:
            fails.append(f'{FILE[k]}: the navigation does not mark this page as current')
    # Each promise, part and flaw once as an entry on its own page; each question once.
    for jid, anc in PROMISE_ANCHOR.items():
        n = len(re.findall(rf'<section class="job" id="{anc}"', pages['promises']))
        if n != 1:
            fails.append(f'promise {anc} appears {n} times as an entry on promises.html')
    for p in D['shape']['parts']:
        n = len(re.findall(rf'<article class="part" id="{part_anchor(p["name"])}"', pages['parts']))
        if n != 1:
            fails.append(f'part {p["name"]} appears {n} times as an entry on parts.html')
    for fid in list(D['by_id']) + ['N1']:
        n = len(re.findall(rf'<article class="card[^"]*" id="{fid.lower()}"', pages['flaws']))
        if n != 1:
            fails.append(f'flaw {fid} appears {n} times as an entry on flaws.html')
    keys = [q['key'] for g in D['decisions']['groups'] for q in g['questions']]
    if len(keys) != len(set(keys)):
        fails.append(f'decisions.json repeats a question key: {keys}')
    for g in D['decisions']['groups']:
        for q in g['questions']:
            n = len(re.findall(rf'<div class="q q-[a-z]+" id="{q["anchor"]}"', pages['decisions']))
            if n != 1:
                fails.append(f'question {q["key"]} appears {n} times on decisions.html')
    for anc in ('q-promises', 'q-a', 'q-b', 'q-c', 'q-d', 'q-e', 'q-f', 'q-g', 'q-22', 'q-24', 'q-25', 'q-19', 'q-21',
                'step-3', 'decided'):
        if anc not in ids['decisions']:
            fails.append(f'decisions.html lacks the plan\'s anchor {anc}')
    for want in ['c%d' % i for i in range(1, 17)] + ['n1']:
        if want not in ids['flaws']:
            fails.append(f'flaws.html lacks the plan\'s anchor {want}')
    alt_links = len(re.findall(r'href="parts\.html#alt-[a-z-]+"', pages['decisions'].split('id="step-3"')[1]))
    if alt_links != 6:
        fails.append(f'the step-3 list links to {alt_links} alternatives rows, not 6')
    # Every diagram placed once, as an inline SVG inside its .dia-svg box.
    for k, s in pages.items():
        boxes = re.findall(r'<div class="dia-svg" role="img" aria-label="[^"]+"><svg\b', s)
        want = sum(1 for key, _, _ in DIAGRAMS if key.startswith(f'd-{k}-'))
        if len(boxes) != want:
            fails.append(f'{FILE[k]}: {len(boxes)} diagrams placed, {want} expected')
    # Every colour in the stylesheet is a token: outside the :root blocks no literal colour is left, except
    # the attribute selectors that restyle Mermaid's fixed presentation attributes (plan 5.1).
    css = next(x for x in re.findall(r'<style>(.*?)</style>', pages['promises'], re.S) if '--anchor-gap' in x)
    rules = re.sub(r':root(?::not\(\[data-theme="light"\]\)|\[data-theme="dark"\])? \{[^}]*\}', '', css)
    rules = re.sub(r'\[(?:fill|stroke)="#[0-9a-fA-F]+"\]', '', rules)
    lit = re.findall(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)', rules)
    if lit:
        fails.append(f'the stylesheet has literal colours outside the tokens: {sorted(set(lit))}')
    for tok in re.findall(r'var\((--[a-z-]+)', css):
        if not re.search(rf'{tok}:', css):
            fails.append(f'the stylesheet uses {tok} but never defines it')
    # The page shells.
    if not pages['engine'].startswith('<title>What the Engine Promises</title>\n<meta name="claude:viewport-fit-sides" content="cover">'):
        fails.append('index.html does not start with its title and the viewport-fit-sides meta')
    if re.search(r'<!doctype|<html\b|<head\b|<body\b', pages['engine'], re.I):
        fails.append('index.html carries a doctype, html, head or body tag')
    for k in pages:
        if k != 'engine' and not pages[k].startswith('<!doctype html>'):
            fails.append(f'{FILE[k]} is not a full document')
    # The evidence totals come from the data (plan 3.5.5).
    total, aside_n, total_all = D['totals']
    if (total, aside_n, total_all) != (337, 21, 358):
        fails.append(f'the evidence totals changed: {total} under the flaws, {aside_n} set aside, {total_all} in all')
    if fails:
        print('CHECKS FAILED:', file=sys.stderr)
        for f in fails:
            print('  ' + f, file=sys.stderr)
        raise SystemExit(1)
    print(f'checks passed: {n_links} links resolve; markers, ids, entries, diagrams and words as the plan asks')


# ---------------------------------------------------------------------------------------------------
def load():
    cards = json.loads(CARDS.read_text())['cards']
    sl = json.loads(STANDALONE.read_text())
    for c in cards:
        t = sl['lines'].get(c['id'], '')
        c['inStandalone'] = t.split(':', 1)[1].strip() if t.lower().startswith('in a standalone game:') else t
        c['inStandalone'] = c['inStandalone'][:1].upper() + c['inStandalone'][1:]
    by_id = {c['id']: c for c in cards}
    assert len(by_id) == 16, f'expected 16 cards, got {len(by_id)}'
    shape = json.loads(SHAPE.read_text())
    NAMES.update({p['id']: p['name'] for p in shape['parts']})
    data = json.loads(JOBS.read_text())
    jobs = data['jobs']
    TITLES.update({j['id']: (j.get('functional') or {}).get('proposedTitle') or j['title'] for j in jobs})
    if set(TITLES) != set(PROMISE_ANCHOR):
        raise SystemExit(f'the promises changed: {sorted(TITLES)}')
    FLAW_TITLES.update({c['id']: c['title'] for c in cards})
    FLAW_TITLES['N1'] = N1_TITLE
    for j in jobs:
        for p in j.get('parts', []):
            KEEPS.setdefault(p, []).append(j['id'])
    assert len(shape['mechanisms']) == len(MECH_PART), 'the shared work changed: update MECH_PART'
    TODAY.update({pid: today_of(m['plain']) for m, pid in zip(shape['mechanisms'], MECH_PART) if pid})
    for c in cards:
        bad = [p for p in c.get('parts', []) if p not in NAMES]
        assert not bad, f'{c["id"]} names unknown parts {bad}'
    home = {f['id']: j['id'] for j in jobs for f in j['flaws'] if f['primary']}
    missing = [c for c in list(by_id) + ['N1'] if c not in home]
    assert not missing, f'flaws with no promise they mainly break: {missing}'
    decisions = json.loads(DECISIONS.read_text())
    for g in decisions['groups']:
        for q in g['questions']:
            QUESTIONS[q['key']] = q['anchor']
    n1_lines = [(j['id'], f['how'], f['primary']) for j in jobs for f in j['flaws'] if f['id'] == 'N1']
    return {
        'cards': cards, 'by_id': by_id, 'shape': shape, 'jobs_data': data, 'jobs': jobs, 'home': home,
        'front': json.loads(FRONT.read_text()), 'decisions': decisions, 'changes': json.loads(CHANGES.read_text()),
        'new_findings': sl['newFindings'], 'n1_lines': n1_lines,
        'n1_parts': [p['id'] for p in shape['parts'] if 'N1' in p['flaws']],
        'n1_findings': sum(1 for f in sl['newFindings'] if f['cause'].startswith('N1')),
    }


def build():
    global CUR
    D = load()
    css = stylesheet()
    open_n = sum(len(g['questions']) for g in D['decisions']['groups'])
    makers = {'engine': page_engine, 'decisions': page_decisions, 'promises': page_promises,
              'parts': page_parts, 'flaws': page_flaws, 'changes': page_changes}
    bodies = {}
    for k, _, _ in PAGES:
        CUR = k
        bodies[k] = makers[k](D)
    CUR = None
    svgs = draw_all()
    pages = {}
    for k, _, name in PAGES:
        body = re.sub(r'@@SVG:([a-z0-9-]+)@@', lambda m: svgs[m.group(1)], bodies[k])
        title = SITE_NAME if k == 'engine' else f'{name} · {SITE_NAME}'
        pages[k] = shell(k, title, body, css, open_n)
    check(pages, D)
    for k, f, _ in PAGES:
        (SITE / f).write_text(pages[k])
    print(f'{"page":<16}{"bytes":>10}{"prose words":>14}')
    for k, f, _ in PAGES:
        print(f'{f:<16}{len(pages[k].encode()):>10}{prose_words(pages[k]):>14}')


if __name__ == '__main__':
    build()
