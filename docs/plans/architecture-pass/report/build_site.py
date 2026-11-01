"""Build the owner's site, version 9: six linked pages in the proactive frame (2026-11-01).

Plan: site/2026-11-01-site-plan-v2.md (the pages, anchors, markers and checks of version 9); where it is silent,
site/2026-11-01-site-plan.md sections 2, 4, 5 and 6 (the frame, the design system, the diagram pipeline).
Log: site/v9/build-log.md (where each version 8 section went, the jargon rows applied, the checks).

Inputs: the page data in this folder (2026-10-31-cause-cards.json, 2026-10-31-engine-jobs.json,
        2026-10-31-standalone-lines.json, 2026-11-01-engine-shape.json), the parity table in
        ../2026-10-31-standalone-pass.md, the requirements (../requirements/2026-11-01-quality-targets.json and
        ../requirements/2026-11-01-extension-cases.json), and the version 9 overlays in site/v9/ (front.json,
        decisions.json, design.json, changes.json, rules.json).
Output: site/index.html (the artifact's main page: no doctype, html, head or body tags), and site/decisions.html,
        requirements.html, design.html, today.html, changes.html (full documents). Version 8's promises.html,
        parts.html and flaws.html are deleted when the build succeeds.

Every Mermaid diagram is drawn at build time by render_diagrams.js (one call for the whole site) and themed by
diagram_theme.theme_svg(); no page loads Mermaid or any script library. Each page carries one small inline script
(OPEN_SCRIPT) that opens the folds holding a link's target.

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
V9 = SITE / 'v9'
CARDS = HERE / '2026-10-31-cause-cards.json'
JOBS = HERE / '2026-10-31-engine-jobs.json'
STANDALONE = HERE / '2026-10-31-standalone-lines.json'
SHAPE = HERE / '2026-11-01-engine-shape.json'
PASS = HERE.parent / '2026-10-31-standalone-pass.md'
QUALITY_TARGETS = HERE.parent / 'requirements' / '2026-11-01-quality-targets.json'
EXTENSION_CASES = HERE.parent / 'requirements' / '2026-11-01-extension-cases.json'
FRONT = V9 / 'front.json'
DECISIONS = V9 / 'decisions.json'
DESIGN = V9 / 'design.json'
CHANGES = V9 / 'changes.json'
RULES = V9 / 'rules.json'
RENDER = HERE / 'render_diagrams.js'
RETIRED_PAGES = ('promises.html', 'parts.html', 'flaws.html')

# ---------------------------------------------------------------------------------------------------
# Constants carried from version 8, in the plain wordings (site/checks/jargon-table.md, the rows for
# build_site.py; each change names its row).
# ---------------------------------------------------------------------------------------------------

# Where each part of the earlier candidate runs, in the owner's words.
RUNS_ON = {'backend': 'the engine', 'gm-tablet': 'GM tablets', 'player-devices': 'player scanners',
           'scoreboards': 'the scoreboards', 'config-tool': 'the config tool', 'tests': 'the tests',
           'gm-tablet-standin': ''}
NAMES = {}  # part id -> plain name, filled from the shape by load()

# What each promise already has today, from the root CLAUDE.md ("GM Scanner Admin Capabilities", "Event
# Architecture") and the list of planned capabilities' "built" rows. Rows P31 (J2), P40 (J3), P79 (J8) and P92
# (J10) applied; in J10 the test rig is built again when the build half starts (the decision "Build the test rig
# when building starts"), and "the test level above logic alone" names the level (real programs with stand-in
# hardware).
BUILT = {
    'J1': 'Packs that hold tokens, modes, scoring, groups and cues; a gate that refuses a broken pack; a second, toy game kept beside ALN.',
    'J2': 'One game record on the engine; a full catch-up to each screen when it connects; live updates for scores, transactions and player scans; the TV and Pi 4 scoreboards.',
    'J3': 'GM scans scored as transactions; player scans kept in the game record; an answer to every GM command; the post-game report and an after-game check that the night\'s records add up. Outside the engine, the director pastes that report by hand into ALN\'s article writer, the Director Console.',
    'J4': 'Video on the TV, music, sounds, lights, the Bluetooth speaker and audio routing; cues and timelines; the health dashboard; items held while a service is down.',
    'J5': 'Create, start, pause and end a game; Reset System; a game restored after an engine restart; the game clock.',
    'J6': 'The config tool; a store for drafting and publishing packs.',
    'J7': 'The GM password and its login token; a watch-only pass for the Pi 4 scoreboard; anonymous player scans.',
    'J8': 'Venue profiles and "not installed tonight"; standalone modes on the GM tablet and the phone\'s scanner; the blue and green machine method: a new show machine is built beside the one in use and swapped in by replugging.',
    'J9': 'Health words healthy, down and not installed tonight (grey) for each service on the health panel; a first, minimal preflight.',
    'J10': 'Four kinds of automated test, from small tests of single pieces of code to full run-through tests of the whole system in a browser; an automatic test run of the real engine and its programs, at the level of real programs with stand-in hardware, started by hand or by a change to its own files (the standing test rig was lost when the cloud computer it ran on was wiped; its recipe survives, and the rig is built again when the build half starts); an automatic test run on every proposed change before it joins the main code; and a rule that the share of code the tests reach may not fall.',
}
# The pieces already well built (plan v2 section 3.5 item 2), from the decision record: "Corrections to the
# readers and the hardening pieces" and "Blue's fixes are evidence of design causes".
WELL_BUILT = [
    'Three pieces finished in the hardening block, the roadmap\'s work to make the show machine safer, stay in the '
    'engine and change only where a design choice requires: the list of kinds of equipment a pack says it needs, '
    'the code that marks equipment not installed tonight, and the smallest test set-up '
    '([[dec:corrections-to-the-readers-and-the-hardening-pieces]]).',
]

# Where a flaw lives: a card's module paths, sorted into the parts of the engine. Row F163: "Contracts" is
# "Message lists".
PARTS = [
    ('GM tablets', lambda p: p.startswith('ALNScanner/src') or p.startswith('ALNScanner/index') or p.startswith('ALNScanner/sw')),
    ('Scoreboards', lambda p: 'scoreboard' in p),
    ('Player scanners', lambda p: p.startswith('aln-memory-scanner') or p.startswith('arduino-cyd-player-scanner')),
    ('Game state', lambda p: any(k in p for k in ('sessionService', 'transactionService', 'stateService', 'models/', 'gameRules', 'websocket/', 'broadcasts', 'scanRoutes', 'adminEvents', 'systemReset', 'routes/'))),
    ('Show control', lambda p: any(k in p for k in ('vlc', 'music', 'audioRouting', 'lighting', 'bluetooth', 'sound', 'cueEngine', 'videoQueue', 'gameClock', 'serviceHealth', 'displayDriver', 'dbusSignal', 'mpd', 'commandExecutor', 'dormancy', 'processMonitor', 'ducking'))),
    ('Pack, config tool', lambda p: p.startswith('config-tool') or p.startswith('ALN-TokenData') or 'packService' in p or 'pack' in p.split('/')[-1].lower()),
    ('Tests', lambda p: '/tests/' in p or p.startswith('tests/') or p.startswith('.github')),
    ('Deployment', lambda p: any(k in p for k in ('DEPLOYMENT_GUIDE', 'ecosystem.config', '.gitmodules', 'scripts/', 'setup.sh', 'CLAUDE.md', 'package.json'))),
    ('Message lists', lambda p: 'contracts/' in p),
]

e = html.escape


OUTSIDE_NINE = {'C14', 'C15', 'C16'}  # the review: no question of the nine covers these
# A card's seenLive note is either a problem seen live or, where the card sets reproducedInTest, one the review
# reproduced only by running the engine's code in a test.
SEEN_LIVE, SEEN_TEST = 'Seen live', 'Reproduced in a test'
NUM_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

# The nine architecture pass questions by name (jargon wording 24 and the words box's revision 1; rows P21 to
# P30 replace the numbers in each promise's test summary, and the cards' chips take the same names).
PASS_QUESTIONS = {
    1: 'who decides each fact',
    2: 'whether a service\'s state travels with its health',
    3: 'how the engine reads the programs it runs',
    4: 'whether anything but the live engine can touch the live show',
    5: 'whether one question gets one answer',
    6: 'what each fact does between games',
    7: 'whether each screen gets only what its role needs',
    8: 'how copies update and whether a screen shows their age',
    9: 'whether the catch-up after a reconnect matches the live message',
}


def pass_questions(nums):
    """'the architecture pass question(s) on A, on B, and on C' (rows P21 to P30)."""
    names = [PASS_QUESTIONS[int(n)] for n in nums]
    if len(names) == 1:
        return 'the architecture pass question on ' + names[0]
    return ('the architecture pass questions on ' + ', on '.join(names[:-1]) + (',' if len(names) > 2 else '')
            + ' and on ' + names[-1])


def seen_label(card):
    if not card.get('seenLive'):
        return ''
    return SEEN_TEST if card.get('reproducedInTest') else SEEN_LIVE


def chips(card):
    out = [f'<span class="chip">{card["findings"]} problems found</span>']
    # Row F6: blue's fix codes become a count.
    n = len(card.get('blueFixes') or [])
    if n == 1:
        out.append('<span class="chip">A fix on blue points here</span>')
    elif n > 1:
        out.append(f'<span class="chip">{NUM_WORD[n].capitalize()} fixes on blue point here</span>')
    if card.get('seenLive'):
        out.append(f'<span class="chip">{SEEN_TEST}</span>' if card.get('reproducedInTest')
                   else f'<span class="chip live">{SEEN_LIVE}</span>')
    return ''.join(out)


def questions_line(card):
    """The architecture pass questions a card touches, by name (rows P21 to P30's table; version 8 numbered them)."""
    q = card.get('questions') or []
    if card['id'] in OUTSIDE_NINE:
        text = 'No architecture pass question covers it' + (f'; the nearest is the one on {PASS_QUESTIONS[int(q[0])]}' if q else '')
    else:
        text = 'Touches ' + pass_questions(q)
    return f'<p class="qline">{e(text)}.</p>'


INIT = '%%{init: {"flowchart": {"useMaxWidth": false}, "sequence": {"useMaxWidth": false}}}%%'
SEQ_INIT = ('%%{init: {"sequence": {"useMaxWidth": true, "mirrorActors": false, "actorMargin": 22, "width": 112, '
            '"boxMargin": 6, "messageMargin": 26, "messageFontSize": 13, "noteFontSize": 12.5, "actorFontSize": 13}}}%%')


def present(src, keep_direction=False):
    """Draw flowcharts top-down at natural size; the card scrolls a wide one in its own box.
    Sequence diagrams are drawn compact, with no repeated row of participants at the bottom."""
    if src.strip().startswith('sequenceDiagram'):
        return SEQ_INIT + '\n' + src.strip()
    lines = src.strip().split('\n')
    if lines[0].strip() == 'flowchart LR' and not keep_direction:
        lines[0] = 'flowchart TD'
    return INIT + '\n' + '\n'.join(lines)


# The findings set aside (rows F158 to F162; "phase 2" is the build half, plan v2 section 2; the question and
# the decision go by their titles).
SET_ASIDE = [
    ('Already fixed in today\'s code', 7, 'Odd characters in the after-game report\'s tables made safe; the health word for not installed tonight, in both written lists of messages and on the tablet; four items the review raised about the smallest test set-up; a guard on the audio routing in the catch-up; two machine settings the deployment guide asks for, now in the settings template (fixed on 2026-10-30, with three small fixes for green, the new show machine).'),
    ('Plain fixes for the build half', 5, 'A built-in programming word such as "constructor" mistaken for a real service, station or token; the phone\'s scanner loading its QR library from the internet; a test helper that switches off the check that a device is talking to the real engine; standalone mode\'s red "Disconnected" label.'),
    ('Code-structure notes, no game symptom', 2, 'A second piece of code for starting programs, inside the code that runs the TV\'s browser; the sound panel drawn by the admin page\'s own code instead of its own drawing code.'),
    ('No fault', 2, 'Two identical catch-ups sent on connect; planned config-tool functions not built yet.'),
    ('A question for you', 1, 'A rejected or duplicate GM scan is recorded nowhere. It is your open question [[q:O]] on Decisions.'),
    ('Documents', 4, 'Plans, briefs and two of the developers\' guide files that disagree with the code. Documents are fixed as we go ([[dec:no-rule-for-documents-fix-as-we-go]]).'),
]


# Cells of the parity table restated in plain words (rows F138 to F156; rows 12 and 14 keep version 8's entries
# for the ids the site never shows). Row number -> {cell index: text}.
PARITY_WORDS = {
    '1': {1: 'The web address it is opened from',
          3: 'A declared standalone setting in the scanner\'s settings file that skips Wi-Fi, the check-in with the engine and the queue of saved scans'},
    '2': {2: 'The settings check wants a Wi-Fi name, the engine\'s address and a 3-digit team id, but a failed check only writes a note; the device starts and scans from its memory card'},
    '3': {1: 'Its own copy of the token list', 2: 'The token list on its memory card, written only when the engine sends it'},
    '4': {1: 'The pack\'s own format', 2: 'A different format, the list one level deeper',
          3: 'Read the pack\'s format, or convert it when loading the card'},
    '6': {1: None,   # PARITY_PREFIX: the cell's start only
          2: 'Kept only while switched on, taken from the engine\'s list of pictures and sounds, which today does not say which pack it is, and shown only by a command typed over a cable',
          3: 'Read which pack it is from a file on the card and show it on the status screen'},
    '7': {1: 'Lowercase, keeping only letters, digits and underscores'},
    '8': {1: '3-second pop-up with the id'},
    '9': {1: 'The picture named in the token list', 2: 'A picture file named after the token'},
    '10': {1: 'The page\'s offline helper shows a stand-in picture as if it were the memory', 2: 'The screen shows its own error'},
    '11': {1: 'Plays the sound file the token names, in any format',
           2: 'Plays a sound file named after the token if one exists, whatever the token says',
           3: 'Read the sound the token names, and accept both sound formats'},
    '12': {1: '"New Memory!" or "Memory Revisited", kept in the phone\'s browser for good',
           3: 'Optional. One design for the situation "Tablets and phones decide facts the engine owns" takes the seen mark away from player devices instead.'},
    '14': {2: 'One line in the queue on the memory card, at most 100, oldest dropped',
           3: 'Decide what a standalone record of player scans is before matching either side.'},
    '15': {2: 'A dummy date in 1970, because it never gets the time from the network'},
    '16': {2: 'Queue and token list until cleared by a command typed over a cable, or sent to the engine'},
    '18': {2: None,    # PARITY_PREFIX: the cell's start only
           3: 'Shorten or drop the window when standalone (an empty Wi-Fi name already skips Wi-Fi and the check-in with the engine)'},
    '20': {2: 'Double-tap, after a 1-second opening screen'},
    '23': {2: 'Required by the settings check, which does not stop start-up; whatever value was read, or nothing, is written on each queued scan'},
    '19': {1: 'QR camera, NFC, typed entry, a link carrying the token',
           2: 'NFC reader only; a test command typed over a cable in test mode'},
    '17': {1: 'A fixed "Offline" label', 2: 'Red Wi-Fi and engine lines, queue count'},
    '21': {1: 'The first load, from the website and a code library online', 3: 'Nothing; the hardware scanner is ahead here'},
    '22': {3: 'Nothing; the hardware scanner is ahead here'},
    '24': {1: 'The settings page tests and saves an engine address the page will not use',
           2: 'Commands typed over a cable that set and save the same address'},
}
# Rows F142 and F153 quote only the start of a cell ("..."): the rest of the cell is kept and its start replaced.
PARITY_PREFIX = {
    ('6', 1): ('Reads ./data/pack-manifest.json, which is absent,', 'Reads the pack\'s file list, which is missing,'),
    ('18', 2): ('A 30 s window on every boot with DEBUG_MODE off; with a WiFi name set, up to 10 s WiFi and up to about 61 s health retry; with no WiFi name both are skipped',
                'A 30 s window at every start in normal show mode; with a Wi-Fi name set, up to 10 s for Wi-Fi and up to about 61 s retrying the check-in with the engine; with no Wi-Fi name both are skipped'),
}


def parity_rows():
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
        n = m.group(1)
        for k, words in PARITY_WORDS.get(n, {}).items():
            if (n, k) in PARITY_PREFIX:
                old, new = PARITY_PREFIX[(n, k)]
                if not clean[k].startswith(old):
                    raise SystemExit(f'parity row {n}, cell {k}: the start "{old}" changed in the standalone review')
                clean[k] = new + clean[k][len(old):]
            else:
                clean[k] = words
        rows.append((n, clean, weak))
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


# Which piece of shared work each part takes over (the shape's mechanisms, in their order; the eleventh, who
# decides when there is no engine, is a quality, not a part). Used for each part's "Today" line.
MECH_PART = ['P1', 'P6', 'P7', 'P11', 'P8', 'P10', 'P4', 'P13', 'P2', 'P16', None]
# Which promises each of the earlier candidate's qualities mainly keeps (the shape's qualities, in their order).
QUALITY_KEEPS = [['J9'], ['J10'], ['J1', 'J8'], ['J8'], ['J7']]
KEEPS = {}   # part id -> the promises it mainly keeps, from each promise's parts; filled by load()
TODAY = {}   # part id -> how its work is done today, from the shared work it takes over; filled by load()


def today_of(plain):
    """A shared-work entry is its definition, then how it is done today: keep the first sentence after the
    definition that speaks of today, alone."""
    sentences = [x.strip() for x in re.split(r'(?<=[.;])\s+(?=[A-Z])', plain) if x.strip()]
    rest = next((x for x in sentences[1:] if re.search(r'\btoday\b', x, re.I)), sentences[-1])
    if rest.startswith('Today '):   # the card's label already says "Today"
        rest = rest[6].upper() + rest[7:]
    return rest


# The plain summary of how the earlier candidate fits together (the shape's section 2.1 and the end of its
# section 1). Version 8 showed the first three on the front page and the fourth over the promises' glance table;
# version 9 keeps all four with the earlier candidate. Wordings 8 and 9 (the designer's changes to the game
# between shows; the developer's tests), 10 (each running copy's own files, network ports and settings), 15 (a
# separate trial copy) and 66 (the engine for "backend") applied.
FIT_SUMMARY = [
    ('What happens at every tap.', 'In a networked game, four promises meet at every tap. The designer\'s pack sets the rules. The game\'s record, the same on every screen, is what the tap is judged against. The answer comes back to the GM or the player, and an accepted tap joins the record. The roles say who tapped and who may see the result.'),
    ('The engine\'s own machinery.', 'The equipment reports what it is doing. The verdict turns that, and the venue technician\'s profile, into go, no-go or "not installed tonight". The life of a game says when to check again and what to reset, which feeds back into the equipment. The profile feeds this loop from outside. In today\'s code the loop is also a chain of seven modules of the engine that depend on each other in a circle, with the game\'s record caught inside it.'),
    ('Two promises reach the show from outside.', 'The designer\'s changes to the game between shows and the developer\'s tests reach a live show only through the pack and through each running copy of the engine keeping its own files, network ports and settings, so a test or a separate trial copy of the engine never touches the live show.'),
    ('How each promise is kept.', 'Most promises are kept by one or two parts of their own. Two are kept mainly by a quality every part must have, with a few parts of their own: [[promise:J9|reading a screen without a second question]] by a label on every fact (how sure, how old), and [[promise:J10|proving a change before it reaches anyone]] by tests every part passes. [[promise:J5|The lifecycle buttons]] rest on a table of moments (setup, start, pause, end, reset, restart, the next game) that most other promises read.'),
]

# The relationship of the promises at a glance, drawn from the shape's section 2.1. Row P7: the arrow from the
# developer's promise reads "each engine copy's own files and settings".
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
  J10 -->|"each engine copy's own files and settings"| J8
  classDef tap stroke:#0f766e,stroke-width:3px;
  classDef machine stroke:#b45309,stroke-width:3px;
  classDef outside stroke:#6b7280,stroke-width:2px,stroke-dasharray:5 4;
  class J1,J2,J3,J7 tap;
  class J4,J8,J9,J5 machine;
  class J6,J10 outside;
"""

# Which parts would run where (the shape's section 4.3), one line per device. Rows A57 to A61 applied, with "the
# design rounds" for step 3.
FIT_DEVICES = [
    ('The engine', 'would decide every fact of a networked game, serve the pack, admit every connection, answer every request through one door and send every fact to the screens through one route.'),
    ('A GM tablet in a networked game', 'would draw what it is sent, with each fact\'s label, and send requests in one shared format. It would keep no list of its own and decide nothing before the engine answers. Today it decides before the engine answers.'),
    ('A GM tablet in a standalone game', 'would be the same app with its standalone setting on. In the candidate it runs the same record, lifecycle, answering and delivery parts the engine runs, with small stand-ins that report every service the engine runs (video, music, lights) as not installed tonight. The other way is an engine of its own, kept equal by tests.'),
    ('The phone and the hardware scanner', 'would draw, send scans in one shared format, and read the reply words and the few rules they need as data made from the one source. They would stay equal by sharing that data.'),
    ('The scoreboards', 'would be one page in two places, the TV and the Pi 4, drawing what they are sent and deciding nothing. Today the page decides which modes count as evidence. One page or a view inside the GM app is an open choice for the design rounds.'),
    ('The config tool', 'would hold the design studio and the venue technician\'s profile editor, and talk to the running engine only by sending it requests. Today it writes the engine\'s files. A separate program or pages the engine itself serves is an open choice for the design rounds.'),
    ('The tests', 'would run on an engine of their own, with stand-ins for the equipment, and never touch the live one. Today they use the live display and audio.'),
]


def wrap_label(text, per_line=4):
    words = text.split()
    return '<br/>'.join(' '.join(words[i:i + per_line]) for i in range(0, len(words), per_line))


# The earlier candidate drawn whole (the shape's sections 4.1 to 4.3). Hand-drawn SVG on a 1000 x 800 grid.
# Rows I12 to I16 applied to the labels.
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
    text(44, 124, 'tablets and scanners also keep a copy of the pack, marked with its version, and the game rules', size=11, op='.75')
    box(580, 50, 128, 80, 'Design studio', ('the config tool,', 'sends requests only'))
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
    box(436, 496, 190, 68, 'Verdict', ('what the game needs vs', "tonight's kit: go, no-go", 'or not installed'))
    box(716, 390, 250, 60, 'Show runner', ('cues, clock, video queue,', 'held items'))
    box(716, 500, 250, 60, 'Equipment', ('video, music, sound,', 'lights, displays'))
    box(716, 585, 250, 50, 'Outside programs', ('VLC, the music player, lights',), dashed=True, name_size=12.5)
    arrow([(376, 420), (286, 420)], 'keeps, clears', (331, 412), anchor='middle')
    arrow([(626, 420), (716, 420)], 'resets', (671, 412), anchor='middle')
    arrow([(520, 450), (520, 496)], 'asks', (528, 478), both=True)
    arrow([(841, 450), (841, 500)], 'drives', (849, 480))
    arrow([(716, 515), (650, 515), (650, 440), (626, 440)], 'what runs', (656, 480))
    arrow([(161, 450), (161, 500)], "the night's facts", (169, 480))
    arrow([(376, 440), (330, 440), (330, 530), (286, 530)], 'the end', (322, 487), anchor='end')
    arrow([(841, 560), (841, 585)], 'commands, checks', (849, 577), both=True)
    # the foundations
    band(20, 700, 960, 92, 'Foundations: the parts above build on these', right=True)
    box(36, 728, 170, 52, 'Game rules', ("the pack's rules,", 'one copy everywhere'))
    box(330, 728, 170, 52, 'Venue fit', ("tonight's kit and", 'its bindings'))
    box(540, 728, 170, 52, 'Engine instance', ('its own files, ports', 'and settings'))
    box(740, 728, 180, 52, 'Pack channel', ('one pack, its version', 'marked on every copy'))
    arrow([(121, 728), (121, 650)], 'the rules, from the pack in use', (129, 690))
    arrow([(400, 728), (400, 450)], "tonight's profile", (392, 640), anchor='end')
    arrow([(920, 754), (990, 754), (990, 241), (980, 241)], 'the pack version', (982, 676), anchor='end')

    defs = ('<defs>'
            '<marker id="shp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker>'
            '<marker id="shpA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill: var(--accent)"/></marker>'
            '</defs>')
    label = ('The earlier candidate as a whole: devices and tools on top; Answering, the one door in, and Delivery, the '
             "one door out; behind them the game's facts, the life of a game and the room; the foundations below.")
    return (f'<svg class="shape-svg" viewBox="0 0 1000 800" role="img" aria-label="{e(label)}" '
            f'font-family="IBM Plex Sans, system-ui, sans-serif">{defs}{"".join(out)}</svg>')


# Five moments followed through the parts, each with the promises it keeps. Rows A12 to A14 applied; A10 and A11
# keep the drawing tool's "alt", which MOMENTS_KEY explains (row A9).
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
  L->>X: what the game needs, the profile, what runs
  X-->>L: go, two lights grey: not installed tonight
  L-->>A: go
  A-->>V: go, checked live, two lights not installed tonight"""),
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
/* Layout: one reading column. */
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
.tag, figcaption, .grid th span { font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; font-weight: 600; color: var(--muted); }
.muted { color: var(--muted); }
.lead { font-size: 18px; max-width: 68ch; }
header.top { display: grid; gap: 14px; }
.legend { display: flex; flex-wrap: wrap; gap: 10px 18px; font-size: 14px; }
.sw { display: inline-block; width: 22px; height: 14px; border-radius: 3px; border: 3px solid var(--fault); vertical-align: -2px; margin-right: 6px; }
.sw.owner { border-color: var(--accent); }
dl.terms { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; margin: 0; font-size: 15px; }
dl.terms dt { font-weight: 600; }
dl.terms dd { margin: 0; color: var(--muted); }
.tablewrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
.grid th, .grid td { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: middle; }
.grid thead th { white-space: normal; vertical-align: bottom; min-width: 64px; }
.grid tbody th { font-weight: 400; min-width: 220px; }
.grid tbody th a { text-decoration: none; }
.grid td.dot { color: var(--accent); text-align: center; font-size: 15px; }
.family { display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px; }
.intro { max-width: 72ch; color: var(--muted); font-size: 17px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 22px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; scroll-margin-top: 16px; }
.wrap > *, .family > *, .card > * { min-width: 0; }
.card-head { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; align-items: baseline; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
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
.job-head .meaning { font-size: 17px; max-width: 74ch; }
.job-facts { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }
.job-facts > div { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px; display: grid; gap: 6px; align-content: start; }
.open { color: var(--fault); font-weight: 600; }
.short { display: grid; gap: 8px; }
.short ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; }
.short li { max-width: 80ch; }
.secondary { color: var(--muted); }
.glance td, .glance th { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
.glance tbody th { font-weight: 500; min-width: 15em; }
.glance a { text-decoration: none; }
.qgroup { display: grid; gap: 14px; }
.q h3 { color: var(--fg); }
.partrow { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
.partrow .tag { margin-right: 4px; }
a.chip.part { text-decoration: none; color: var(--fg); border: 1px solid var(--accent); background: transparent; }
a.chip.part:hover { background: var(--chip); }
.job-head dl.who { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0; font-size: 15px; max-width: 80ch; }
dl.who dt { font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.06em; font-size: 12px; font-weight: 600; color: var(--muted); padding-top: 3px; }
dl.who dd { margin: 0; }
.fit-summary { display: grid; gap: 10px; max-width: 78ch; background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 6px; padding: 16px 20px; }
.fit-block { display: grid; gap: 10px; min-width: 0; }
.fit-block > *, .fit-block details { min-width: 0; }
.fit-block > p { max-width: 76ch; }
.mech th, .mech td, .alts th, .alts td { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
.mech thead th, .alts thead th { font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; color: var(--muted); }
.mech tbody th { font-weight: 600; min-width: 10em; }
.alts tbody th { font-weight: 600; min-width: 11em; }
.alts td { min-width: 14em; }
.pmeta a { text-decoration: none; margin-right: 2px; }
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
# The site: pages, anchors, links and markers (plan v2 sections 1 and 2; plan v1 section 4).
# ---------------------------------------------------------------------------------------------------
PAGES = [  # key, file, name in the navigation and in [[page:]] markers
    ('engine', 'index.html', 'The engine'),
    ('decisions', 'decisions.html', 'Decisions'),
    ('requirements', 'requirements.html', 'Requirements'),
    ('design', 'design.html', 'Design'),
    ('today', 'today.html', 'Today\'s engine'),
    ('changes', 'changes.html', 'Change log'),
]
FILE = {k: f for k, f, _ in PAGES}
PAGE_NAME = {k: n for k, _, n in PAGES}
RETIRED_MARKER_PAGES = ('promises', 'parts', 'flaws')
SITE_NAME = 'What the Engine Promises'
STATUS_LINE = ('Architecture pass, design half: the requirements. Nothing in the design is decided unless a page '
               'says so. Updated 2026-11-01.')

PROMISE_ANCHOR = {'J1': 'designers-game', 'J2': 'one-game', 'J3': 'every-tap', 'J4': 'the-room',
                  'J5': 'lifecycle-buttons', 'J6': 'change-a-value', 'J7': 'each-person', 'J8': 'the-venue',
                  'J9': 'read-a-screen', 'J10': 'proven-change'}
N1_TITLE = 'Nothing declares a game standalone'   # the question's words for the proposed flaw (it has no card)

CUR = None          # the page being rendered; links within it are bare #anchors
TITLES = {}         # promise id -> its title; ids never reach a page
TITLE_TO_PROMISE = {}
FLAW_TITLES = {}    # flaw id -> its title
QUESTIONS = {}      # question letter -> its anchor
Q_TITLES = {}       # question letter -> its title
QT = {}             # quality target id -> the target
EX = {}             # extension case id -> the case
DEC = {}            # decision slug -> its decided entry


def slug(text):
    """The title in lower case, every run of non-letters one hyphen, trimmed (plan v2, markers)."""
    return re.sub(r'[^a-z]+', '-', text.lower()).strip('-')


def part_anchor(name):
    """The part slugs of plan v1: the name in lowercase, apostrophes dropped, other non-letters as hyphens."""
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
    return f'<a{c} href="{href("requirements", PROMISE_ANCHOR[jid])}">{t}</a>'


def promise_link(jid):
    """Version 7's promise link: the title in quotes."""
    return promise_a(jid, quotes=True)


def promise_links(ids):
    return '<br/>'.join(promise_link(i) for i in ids)


def part_a(pid, text=None, chip=False):
    if pid not in NAMES:
        raise SystemExit(f'unknown part {pid}')
    c = ' class="chip part"' if chip else ''
    return f'<a{c} href="{href("design", part_anchor(NAMES[pid]))}">{e(text if text is not None else NAMES[pid])}</a>'


def part_link(pid):
    return part_a(pid, chip=True)


def part_row(pids, label):
    if not pids:
        return ''
    note = ''
    if JOINS in pids:   # replaced by the decision "One published protocol and an outside test bench"
        note = (f'<p class="replaced muted">{e(NAMES[JOINS])} is since replaced by '
                f'<a href="{href("design", "decided-the-published-protocol")}">the published protocol</a> and '
                f'<a href="{href("design", "decided-the-test-bench-outside-the-engine")}">the test bench outside the engine</a>.</p>')
    return f'<div class="partrow"><span class="tag">{e(label)}</span>{"".join(part_link(p) for p in pids)}</div>{note}'


def flaw_a(fid, text=None, cls=''):
    """A flaw by its title alone, linked to its situation on Today's engine (plan v2: flaws go by title)."""
    if fid not in FLAW_TITLES:
        raise SystemExit(f'unknown design flaw {fid}')
    c = f' class="{cls}"' if cls else ''
    t = f' title="{e(FLAW_TITLES[fid])}"' if text is not None and text != FLAW_TITLES[fid] else ''
    return f'<a{c}{t} href="{href("today", fid.lower())}">{e(text if text is not None else FLAW_TITLES[fid])}</a>'


def flaw_list(ids):
    return '; '.join(flaw_a(i) for i in ids)


def q_text(key, capital):
    return f'{"Question" if capital else "question"} {key}'


def q_a(key, capital=False, text=None):
    if key not in QUESTIONS:
        raise SystemExit(f'unknown question {key}')
    if text is None and CUR not in ('decisions', 'changes'):
        text = Q_TITLES[key]   # questions carry letters only on Decisions (and as history on the change log)
    return f'<a href="{href("decisions", QUESTIONS[key])}">{e(text if text is not None else q_text(key, capital))}</a>'


def qt_a(qid, text=None):
    if qid not in QT:
        raise SystemExit(f'unknown quality target {qid}')
    return f'<a href="{href("requirements", qid.lower())}">{e(text if text is not None else QT[qid]["title"])}</a>'


def ex_a(xid, text=None):
    if xid not in EX:
        raise SystemExit(f'unknown extension case {xid}')
    return f'<a href="{href("requirements", xid.lower())}">{e(text if text is not None else EX[xid]["title"])}</a>'


def dec_a(s, text=None):
    if s not in DEC:
        raise SystemExit(f'unknown decision [[dec:{s}]]')
    return f'<a href="{href("decisions", "dec-" + s)}">{e(text if text is not None else DEC[s]["title"])}</a>'


def page_a(name, text=None):
    """A page by its name; "page#anchor" lands on that id of the page (the check finds every id)."""
    name, _, anchor = name.partition('#')
    if name in RETIRED_MARKER_PAGES:
        raise SystemExit(f'retired marker [[page:{name}]]: the {name} page is gone in version 9')
    if name not in FILE:
        raise SystemExit(f'unknown page {name}')
    return f'<a href="{href(name, anchor or None)}">{e(text if text is not None else PAGE_NAME[name])}</a>'


MARKER = re.compile(r'\[\[([a-z]+):([^\]|]+)(?:\|([^\]]*))?\]\]')


def rich(text):
    """Plain overlay text to HTML: escape the text around each [[marker]] and resolve the marker."""
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
            out.append(page_a(key, label))
        elif kind == 'qt':
            out.append(qt_a(key, label))
        elif kind == 'ex':
            out.append(ex_a(key, label))
        elif kind == 'dec':
            out.append(dec_a(key, label))
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


def cap1(s):
    return s[:1].upper() + s[1:]


# ---------------------------------------------------------------------------------------------------
# Diagrams: collected while the pages render, drawn in one call, themed, then placed (plan v1 5.1).
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
# Texts version 8 wrote in its builder, in the plain wordings (each change names its jargon row).
# ---------------------------------------------------------------------------------------------------
OVERVIEW_KEY = ('<span class="key tap"></span>what happens at every tap <span class="key machine"></span>the engine\'s own '
                'machinery <span class="key outside"></span>from outside the show. Each arrow runs from a promise to one '
                'that cannot be kept without it, and says what passes. The dotted line is a label every fact carries, '
                'not a dependency.')
RELATIONS_NOTE = ('{n} are dependencies: without them, the promise at the arrow\'s end cannot be kept at a show. One is a '
                  'quality and one is work two promises share; they are drawn dotted.')   # row P8
QUALITIES_INTRO = ('A quality is not a part. It is something every part must have, so that a promise holds everywhere '
                   'and not in one place only. These five are the earlier candidate\'s own; the twelve qualities the '
                   'requirements group their targets under are on [[page:requirements#qualities|Requirements]].')
TANGLE_NOTE = ('A tangle is one piece of work spread over many places with nothing joining them, one place doing many '
               'kinds of work, or a lower piece of code relying on one that should rely on it. Each causes some of the '
               'design flaws named under it.')   # row A75
WHOLE_KEY = ('Every request comes in through Answering and gets one reply; every fact goes out to the screens through '
             'Delivery, with its label (how old, how sure). Delivery reads what changed in the game record, the '
             'lifecycle, the room and the pack channel; no part sends to it. Behind the two doors sit the game\'s facts, '
             'the life of a game and the room; the parts above build on the foundations, directly or through another '
             'part. The arrows show what passes at a show. Before a start, the lifecycle hands the verdict tonight\'s '
             'profile and what is running, and asks for go, no-go or not installed tonight; it also takes up a new pack '
             'from the pack channel, only between games. The two doors and their arrows are drawn in teal; the dashed '
             'box is an outside program, not a part. The rows group the parts by what they do; they are not the layers '
             'of which part uses which, shown [[page:design#layers|below]]. In a standalone game the GM tablet runs the '
             'same doors, game record and lifecycle itself, with small stand-ins for connections, the room, the verdict '
             'and the engine\'s own files and settings. The [[page:design#walks|five walkthroughs]] below follow single '
             'moments step by step.')   # rows I17, I18
MOMENTS_KEY = ('Each moment follows one thing that happens at a show through the parts that handle it, in order. Solid '
               'arrows are requests; dashed arrows are answers. Delivery always asks what changed; nothing pushes facts '
               'to it. Each screen asked Delivery, when it connected, to keep it up to date; Delivery\'s dashed arrows to '
               'screens answer that standing request. A box marked "alt" holds two ways the moment can go, each named '
               'in brackets.')   # row A9
LAYERS_CAPTION = ('The parts in layers, top row first. Each part uses only the parts in the rows below it, so nothing '
                  'loops back: a change low down can affect the parts above it, and nothing above can break what sits '
                  'below. Tap a part to read it.')
USES_NOTE = 'An arrow means "uses". No arrow loops back.'
ALTS_INTRO = ('For these, drawing the earlier candidate found two sound ways to build a part or to word a promise. The '
              'design rounds put each in front of you with the designs side by side; no answer is needed now.')   # row A102
WORDS_INTRO = ('The site\'s own words come first, then the names of the steps of the work, then the words the design '
               'rounds use; each situation on [[page:today]] ends with the reason restated in them.')   # row I49
LEGEND = ('<div class="legend"><span><span class="sw"></span>where it goes wrong</span>'
          '<span><span class="sw owner"></span>the one place that would own the fact</span></div>')
STANDALONE_P1 = ('The decision [[dec:standalone-games-declared-never-mixed]] adds a requirement: a whole game can run with no '
                 'engine, the GM tablet and the player scanners each working alone, as a choice the game declares and '
                 'never mixed. In a standalone game the GM tablet decides everything about the game (used tokens, '
                 'scores, teams, the game\'s start, pause and end) from its own hand-kept copies of the engine\'s rules. '
                 'Each player scanner decides only whether a token is known, and the phone also whether it has seen '
                 'that token before.')
STANDALONE_P2 = ('Four design flaws cause no problem in a standalone game, four apply in part and eight in full. Each '
                 'promise and each situation says what changes. The two biggest gaps: nothing says that a game is '
                 'standalone, and every device shows the missing engine as a failure ("Offline" on the phone all night, '
                 'red "DISCONNECTED" on the hardware scanner, "VIDEO UNAVAILABLE, Rescan later" for a video that can '
                 'never play).')   # row F135
PARITY_NOTE = ('Your parity rule says the two player scanners match wherever possible. Shaded rows are ones where both '
               'are weak, or the phone\'s scanner is the weaker side, so matching it would copy a gap.')
EVIDENCE_INTRO = ('{total_all} problems came from blue\'s records, the review\'s survey of today\'s code and, for one, the '
                  'survey of ALN\'s after-game tools; {total} of them sit under the sixteen situations above, and '
                  '{aside_n} needed no change to the design. The review of standalone games added {sa_all} more: '
                  '{sa_cards} placed under the same situations, and {sa_n1} under the proposed seventeenth, '
                  '[[flaw:N1]].')   # row F157
EARLIER_NOTE = ('Every promise was restated from the side of the people it serves in version 5 and retitled under '
                'decision 27 in version 6. Each note says what the candidate shape changed. "Now" means the candidate '
                'shape, which is not decided.')   # row C35
NOW_NOTE = 'Each note says what the candidate shape changed. "Now" means the candidate shape, which is not decided.'   # row C47
# Version 8's Parts introduction, in the candidate's past tense (design check row 24; "Step 3 starts from this
# frame" left out, as the design rounds no longer start from the candidate).
PARTS_KEY = ('Most of today\'s problems sit in work several promises depend on: getting a fact onto a screen, answering '
             'a request, knowing who is connected, the line between one game and the next. Each is done several times '
             'today, in different places. The earlier candidate made each such piece of work one part, and the work '
             'only one promise needs got a part too: seventeen parts in all. The parts already well built today (the game rules, and '
             'the verdict with its health words) were its pattern for the rest. On each card, Mainly keeps names the '
             'promises the part exists for, and Also needed by the promises that use it; Today, on the cards that carry '
             'it, says how the part\'s work is done now; Removes names the design flaws the part would take away; Runs on '
             'says which devices would host it; and Where it can be swapped names what plugs into it, where behaviour can '
             'change without touching the rest.')
# The guide to a card (today check rows 3 and 4): version 8's intro, in plain words.
CARD_GUIDE = ('Each card tells one moment at a show and why it happens, then what it does in a standalone game. The '
              'drawing shows where it goes wrong today. The card\'s head names the architecture pass\'s own questions it '
              'touches (the nine questions the pass answers, not the questions on Decisions). Folded under the drawing '
              'is how the earlier candidate would remove it, with "In design terms", which restates the cause in the '
              'words listed on [[page:engine#words|The engine page]]. "The problems behind it" lists a few of the card\'s '
              'problems and the code they live in.')
GRID_NOTE = 'A dot means the situation\'s problems sit in that part of the engine.'
LATER_INTRO = ('Inside the design rounds come these later choices. They are listed here so nothing arrives as a surprise. '
               'The six with a row in the earlier candidate\'s alternatives table on [[page:design]] link to it, where '
               'both designs and their costs are compared.')   # rows D45 and D46, as plan v2 frames them
DECIDED_HISTORY = ('Each decision is written as it stands today, with its dated history in the decision record. The '
                   '[[page:changes#numbers|change log]] maps each old number to its title.')
TODAY_GROUP_TAG = 'Mainly touches'

# Each page names the documents it is built from, by name (plan v1 section 2; rows I54, D56, P107, P108, A119,
# F164 and C79, with the plan's names: the design half, the earlier candidate, the decision record).
FOOTERS = {
    'engine': [
        'Built from the promises (2026-10-31: what the engine is for, who counts on each promise and when), the '
        'quality targets and the extension cases (2026-11-01), the roadmap (the blocks and the readiness states), '
        'the decision record (by topic), and the glossary (the words).',
    ],
    'decisions': [
        'Built from the decision record (by topic, with the old numbers mapped to titles); the questions of version '
        '7, the earlier one-page report; the quality targets and the extension cases (2026-11-01); the earlier '
        'candidate (2026-11-01, its alternatives and the choices it leaves to the design rounds); the review that '
        'named the design flaws (2026-10-30); the review of standalone games (2026-10-31); the survey of ALN\'s '
        'after-game tools (2026-11-01); the promises (2026-10-31); and the panel\'s brief (2026-11-01).',
    ],
    'requirements': [
        'Built from the promises (2026-10-31; a check confirmed 171 of its statements and corrected 53), the quality '
        'targets and the extension cases (2026-11-01, each with its own check), the roadmap\'s standing '
        'constraints, and the review of standalone games (2026-10-31).',
        'Where today\'s engine falls short comes from the review that named the design flaws (2026-10-30); what the '
        'planned capabilities need comes from the list of planned capabilities drawn from the roadmap you approved.',
    ],
    'design': [
        'Built from the decision record (the design half\'s order, the published protocol, the test bench, the test '
        'rig and the after-game boundary), the quality targets and the extension cases (2026-11-01), and the '
        'earlier candidate (2026-11-01) with the four studies of how the promises fit together that it was drawn '
        'from, and its check: its picture, qualities, parts, walkthroughs, devices, tangles and alternatives.',
    ],
    'today': [
        'Built from the review that named the design flaws (2026-10-30) and its two checks; the review of standalone '
        'games (2026-10-31), with the table comparing the hardware scanner with the phone\'s scanner; the promises '
        '(2026-10-31; which promise each flaw touches, and what each already has); the earlier candidate '
        '(2026-11-01; the folded side of each situation); the survey of ALN\'s after-game tools (2026-11-01; the sale and '
        'adjustment times printed hours apart); and the decision record (the pieces already well built). "What each promise already has" is '
        'summarized from the project\'s guide for developers and the list of planned capabilities.',
    ],
    'changes': [
        'Built from this report\'s version history and the decision record (its old numbers mapped to titles), the '
        'first wording of each promise (the promises, 2026-10-31), the notes each card and promise carried after the '
        'candidate shape was drawn, the review that named the design flaws (2026-10-30: the two clocks and the '
        'totals), the questions of version 7 (E, F and G, after the candidate shape), the survey of ALN\'s after-game '
        'tools (2026-11-01), the jargon check of 2026-11-01, the glossary, the roadmap (the blocks, the older phase '
        'names and the test stages), the plan for the architecture pass (its old steps), the quality targets and the '
        'extension cases (2026-11-01, the counts), and the panel\'s brief (2026-11-01).',
    ],
}

# The one script any page carries (plan v2 section 2, brief): a link into folded content opens every <details>
# holding its target, on load and on hashchange. No library.
OPEN_SCRIPT = '''<script>
(function () {
  function openTarget() {
    var id = decodeURIComponent(location.hash.slice(1));
    var t = id && document.getElementById(id);
    if (!t) return;
    for (var d = t.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
    t.scrollIntoView();
  }
  window.addEventListener('hashchange', openTarget);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openTarget);
  else openTarget();
})();
</script>'''


# ---------------------------------------------------------------------------------------------------
# The shared stylesheet: version 7's tokens and components, plus the site's frame.
# ---------------------------------------------------------------------------------------------------
SITE_CSS = '''
/* The site's frame: one gutter on the outer wrapper, a sticky navigation bar under the safe area,
   the status line, and the components the pages add. Every colour is a token. */
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
h4 { margin: 0; line-height: 1.25; }
section { display: grid; gap: 14px; min-width: 0; }
section > * { min-width: 0; }
.page-head { display: grid; gap: 14px; }
.page-head p { max-width: 72ch; }
.prose { display: grid; gap: 10px; }
.prose p { max-width: 76ch; }
.plain-list { margin: 0; padding-left: 18px; display: grid; gap: 8px; font-size: 15px; }
/* Where the work stands: done, now, next. */
.timeline { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr)); }
.timeline > div { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 16px 18px; display: grid; gap: 8px; align-content: start; }
.timeline > div.tl-now { border-left: 4px solid var(--accent); }
.timeline h3 { font-size: 17px; }
.timeline ul, .timeline ol { margin: 0; padding-left: 20px; display: grid; gap: 8px; font-size: 15px; }
.timeline li.current { font-weight: 600; }
.timeline .here { display: inline-block; font-family: var(--font-label); font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; border-radius: 999px; padding: 0 8px; margin-right: 6px; background: var(--accent); color: var(--on-accent); }
.callout { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 6px; padding: 14px 18px; max-width: 86ch; }
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
.guide { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.guide li { display: grid; grid-template-columns: minmax(8.5em, max-content) 1fr; gap: 2px 14px; max-width: 86ch; }
.guide li a { font-weight: 600; }
@media (max-width: 520px) { .guide li { grid-template-columns: minmax(0, 1fr); } }
.lines { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; max-width: 88ch; }
.lines li { border-left: 3px solid var(--line); padding-left: 12px; }
.lines li > a:first-child, .lines li > strong { font-weight: 600; display: block; }
.growth { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); align-items: start; }
.growth > div { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px; display: grid; gap: 6px; font-size: 14.5px; }
.growth h3 { font-size: 16px; }
.words { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); }
.words h3 { font-size: 16px; margin-bottom: 6px; }
@media (max-width: 520px) { dl.terms { grid-template-columns: minmax(0, 1fr); } dl.terms dd { margin-bottom: 8px; } }
.world-svg { display: block; width: 100%; height: auto; color: var(--fg); }
.world-narrow { display: none; max-width: 420px; margin: 0 auto; }
@media (max-width: 700px) { .world-wide { display: none; } .world-narrow { display: block; } }
/* Decisions. */
.q { scroll-margin-top: var(--anchor-gap); }
.q h3 { font-size: 19px; font-weight: 600; line-height: 1.25; margin: 0; color: var(--fg); }
.q h3 .letter { color: var(--accent); margin-right: 4px; }
.q ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; font-size: 15px; }
.q .block { display: grid; gap: 4px; }
.q ul.options { list-style: none; padding-left: 0; gap: 8px; }
.q ul.options li { border-left: 3px solid var(--line); padding-left: 10px; }
.q ul.options strong { font-weight: 600; }
.q .rec { border-top: 1px solid var(--line); padding-top: 10px; }
.q .rec .tag { display: block; color: var(--accent); margin-bottom: 2px; }
.stag { justify-self: start; font-family: var(--font-label); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; border-radius: 999px; padding: 2px 10px; border: 1px solid var(--line); color: var(--muted); }
.stag.s-applied, .stag.k-settled { color: var(--accent); border-color: var(--accent); }
.stag.s-changed { color: var(--fault); border-color: var(--fault); background: var(--chip-live); }
.stag.k-partly-settled { color: var(--warm); border-color: var(--warm); }
.stag.k-proposed { color: var(--fg); border-color: var(--line-strong); border-style: dashed; }
.q.q-applied { border-left-color: var(--accent); }
.q.q-changed { border-left-color: var(--fault); }
.q.q-open { border-left-color: var(--line-strong); }
.qgroup > h3 { font-size: 17px; color: var(--muted); font-weight: 600; }
ul.rounds, ul.later { margin: 0; padding-left: 22px; display: grid; gap: 8px; max-width: 88ch; }
ul.rounds li a.round { font-weight: 600; }
.topic { display: grid; gap: 10px; }
.topic > h3 { font-size: 18px; }
.decided-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.decided-list li { display: grid; gap: 4px; max-width: 92ch; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; }
.decided-list .dn { font-weight: 600; }
.decided-list .dd { font-family: var(--font-label); font-size: 12.5px; color: var(--muted); font-weight: 500; margin-left: 8px; }
/* Requirements. */
.req-group { display: grid; gap: 12px; border-top: 2px solid var(--line); padding-top: 10px; }
.req-group > h3 { font-size: 20px; }
.req-group > p { max-width: 80ch; color: var(--muted); }
.reqs { display: grid; gap: 12px; }
.req { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 14px 18px; display: grid; gap: 8px; max-width: 100%; }
.req h4 { font-size: 17px; font-weight: 600; }
.req p { max-width: 82ch; font-size: 15px; }
.req .tag { margin-right: 6px; }
.req .numset { background: var(--chip); border-radius: 6px; padding: 8px 12px; }
.req .numset a { font-size: 14px; white-space: nowrap; }
.req .state { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; }
.req .state .small { font-size: 13.5px; color: var(--muted); flex: 1 1 20em; }
.served { display: grid; gap: 6px; }
.served ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 15px; }
.rule-group { display: grid; gap: 10px; }
.rule-group > h3 { font-size: 18px; margin-top: 10px; }
.rules { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.rules li { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; display: grid; gap: 4px; max-width: 92ch; }
.rules li strong { font-weight: 600; }
.rules li .src { font-size: 13.5px; color: var(--muted); }
/* Design. */
.ahead { display: grid; gap: 16px; }
.pb { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); }
.pb-sec { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 16px 20px; display: grid; gap: 8px; }
.pb-sec h3 { font-size: 17px; }
.pb-sec p { max-width: 82ch; font-size: 15px; }
ul.pb-items { margin: 0; padding-left: 20px; display: grid; gap: 6px; max-width: 82ch; font-size: 15px; }
.ahead-item { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 6px; padding: 16px 20px; display: grid; gap: 10px; }
.ahead-item h3 .ord { color: var(--muted); font-weight: 500; margin-right: 6px; }
.ahead-item .block { display: grid; gap: 4px; }
.ahead-item .block p { max-width: 82ch; font-size: 15px; }
.directions { display: grid; gap: 14px; }
.direction { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 16px 20px; display: grid; gap: 10px; }
.direction p { max-width: 80ch; font-size: 15.5px; }
details.earlier { border: 1px dashed var(--line-strong); border-radius: 8px; padding: 14px 18px; background: var(--surface); }
details.earlier > summary { font-size: 15.5px; color: var(--fg); line-height: 1.5; }
details.earlier > summary .tag { color: var(--accent); }
details.earlier > summary .note { display: block; margin-top: 4px; }
details.earlier[open] > summary { margin-bottom: 18px; }
.earlier-body { display: grid; gap: 34px; min-width: 0; }
.earlier-body > section > h3 { font-size: 20px; }
.replaced { font-size: 14px; color: var(--warm); font-weight: 500; }
.replaced a { font-weight: 500; }
article.part.is-replaced { border-style: dashed; }
/* Today's engine. */
.fgroup { display: grid; gap: 16px; border-top: 2px solid var(--line); padding-top: 10px; }
.fgroup > h3 { font-size: 20px; }
.fgroup > h3 .tag { display: block; margin-bottom: 4px; }
.card-head h3 { font-size: 19px; font-weight: 600; line-height: 1.2; margin: 0; }
.card.proposed { border-style: dashed; }
.qline { font-size: 14px; color: var(--muted); }
details.fold > summary { margin-bottom: 0; }
details.fold[open] > summary { margin-bottom: 12px; }
details.fold .diagrams, details.fold .partrow { margin-bottom: 10px; }
.works { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.works li { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 10px 14px; display: grid; gap: 4px; max-width: 92ch; font-size: 15px; }
.works li > a:first-child { font-weight: 600; }
.flawtable th, .flawtable td { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
.flawtable thead th, .glance thead th, .logtable thead th { font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; color: var(--muted); }
.flawtable tbody th { font-weight: 500; min-width: 13em; }
.flawtable td { min-width: 9em; }
.flawtable td.num { min-width: 4em; }
.flawtable a, .glance a { text-decoration: none; }
.glance td { font-size: 14px; }
.glance td.who, .glance td.when { min-width: 12em; }
/* Change log. */
.log-entry { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 16px 18px; display: grid; gap: 8px; scroll-margin-top: var(--anchor-gap); }
.log-entry h3 { font-size: 18px; }
.log-entry .when { font-family: var(--font-label); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; color: var(--muted); }
.log-entry ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; font-size: 15px; max-width: 86ch; }
.log-entry .prompt { font-size: 15px; color: var(--muted); border-left: 3px solid var(--accent); padding-left: 12px; max-width: 86ch; }
.log-entry .was-title { font-size: 15px; }
.log-entry .cid { font-family: var(--font-mono); font-weight: 500; font-size: 15px; color: var(--accent); margin-right: 6px; }
.log-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); }
.beforeafter { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); }
.beforeafter > div { display: grid; gap: 4px; align-content: start; font-size: 15px; }
.logtable th, .logtable td { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; font-size: 14px; }
.logtable td, .logtable th { min-width: 12em; }
.lead-in { max-width: 78ch; }
.alts tbody tr { scroll-margin-top: var(--anchor-gap); }
.alts tbody tr:target th, .alts tbody tr:target td { background: var(--chip); }
.part h3, .part h4 { margin: 0; font-size: 16px; font-weight: 600; }
footer.site-foot { padding: 32px 0 48px; border-top: 1px solid var(--line); font-size: 14px; color: var(--muted); display: grid; gap: 6px; }
footer.site-foot p { max-width: 90ch; }
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
    # Version 7's part-card rules also matched the part chips (a.chip.part); they apply to the card alone.
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
    footer = ''.join(f'<p>{e(p)}</p>' for p in FOOTERS[page])
    content = (f'<div class="site">\n<a class="skip" href="#main">Skip to the page</a>\n{nav(page, open_n)}\n'
               f'<p class="status">{e(STATUS_LINE)}</p>\n<main class="wrap" id="main">\n{body}\n</main>\n'
               f'<footer class="site-foot">{footer}</footer>\n</div>\n{OPEN_SCRIPT}\n')
    if page == 'engine':
        return (f'<title>{e(title)}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n{FONTS}\n'
                f'<style>{css}</style>\n{content}')
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            f'<title>{e(title)}</title>\n<style>{BASE_RESET}</style>\n{FONTS}\n<style>{css}</style>\n</head>\n<body>\n'
            f'{content}</body>\n</html>\n')


# The engine in its world, hand-drawn in two layouts: wide for desktop, stacked for phones (CSS shows one at a time,
# at 700 pixels). Each person is one box naming the devices or tools they use; every message and file crosses the
# published protocol on its way to or from the engine; the operator and the developer reach the engine below the
# band, as front.worldKey describes; the outside programs sit on the engine's far side. The text is the picture's
# only source; the front-page check reads it against the requirements and front.worldKey.
WORLD_CAPTION = 'The people and their devices, the published protocol, the engine, and the outside programs it drives.'
WORLD_PEOPLE = {   # name -> (wide sublines, narrow sublines)
    'Designer': (['makes the game in the design tool,', 'with content from Notion today'], ['the design tool,', 'content from Notion']),
    'Operator': (['you, or a future one: installs and picks', 'packs; swaps machines between events'], ['installs and picks packs,', 'swaps machines']),
    'Venue technician': (["fits the venue: tonight's kit"], ['the venue profile']),
    'Director': (['tells the night afterwards,', "in the Director's console"], ["Director's console"]),
    'GM': (['runs the game on the GM tablets'], ['GM tablets']),
    'Players': (['tap tokens on phones and scanners'], ['phones and scanners']),
    'Audience': (['watch the TV and scoreboards'], ['TV and scoreboards']),
    'Stranger': (['on the venue wifi'], ['on the venue wifi']),
    'Developer': (['on the team or from outside: changes the', 'code and tests it from the test bench'], ['on the team or outside:', 'code, and its tests']),
}
WORLD_PROGRAMS = ['Video player', 'Music player', 'Audio and Bluetooth', 'Lighting', "The TV's browser"]


def world_svg(layout):
    """One layout of the world picture: 'wide' (1000 x 590) or 'narrow' (360 x 786)."""
    out = []
    mk, mka = ('wmk', 'wmkA') if layout == 'wide' else ('nmk', 'nmkA')

    def text(x, y, t, size=11.5, anchor='start', weight=None, op=None):
        w = f' font-weight="{weight}"' if weight else ''
        o = f' opacity="{op}"' if op else ''
        out.append(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}"{w}{o} fill="currentColor">{e(t)}</text>')

    def band(x, y, w, h, accent=False):
        stroke = ' style="fill: var(--chip); stroke: var(--accent)" stroke-width="2" stroke-dasharray="7 5"' if accent \
            else ' style="fill: var(--chip)"'
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8"{stroke} fill-opacity=".6"/>')

    def person(x, y, w, h, name, subs, size=13.5):
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" style="fill: var(--surface); stroke: currentColor" stroke-width="1.2"/>')
        text(x + 12, y + 19, name, size=size, weight='600')
        for i, t in enumerate(subs):
            text(x + 12, y + 35 + i * 14, t, size=11, op='.8')

    def item(x, y, w, h, name, subs=(), accent=False, size=12.5, name_size=None):
        stroke = 'var(--accent)' if accent else 'currentColor'
        sw = 2.6 if accent else 1.2
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" style="fill: var(--surface); stroke: {stroke}" stroke-width="{sw}"/>')
        lines = [name] + list(subs)
        top = y + h / 2 - (len(lines) - 1) * 7 + 4.5
        for i, t in enumerate(lines):
            text(x + w / 2, round(top + i * 14, 1), t, size=(name_size or size) if i == 0 else 11, anchor='middle',
                 weight='600' if i == 0 else None, op=None if i == 0 else '.8')

    def arrow(points, label=None, at=None, anchor='middle', both=False, accent=False):
        d = 'M' + ' L'.join(f'{px},{py}' for px, py in points)
        m = mka if accent else mk
        start = f' marker-start="url(#{m})"' if both else ''
        stroke = 'var(--accent)' if accent else 'currentColor'
        out.append(f'<path d="{d}" fill="none" style="stroke: {stroke}" stroke-width="1.5" marker-end="url(#{m})"{start}/>')
        if label:
            text(at[0], at[1], label, size=11, anchor=anchor, op='.9')

    def stopped(a, b, label=None, at=None, anchor='middle'):
        """A line that ends at a bar: nothing gets through (the stranger on the venue wifi)."""
        (x1, y1), (x2, y2) = a, b
        out.append(f'<path d="M{x1},{y1} L{x2},{y2}" fill="none" style="stroke: currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>')
        if y1 == y2:
            out.append(f'<path d="M{x2},{y2 - 9} L{x2},{y2 + 9}" fill="none" style="stroke: currentColor" stroke-width="2.6"/>')
        else:
            out.append(f'<path d="M{x2 - 9},{y2} L{x2 + 9},{y2}" fill="none" style="stroke: currentColor" stroke-width="2.6"/>')
        if label:
            text(at[0], at[1], label, size=11, anchor=anchor, op='.9')

    def head(x, y, t):
        text(x, y, t.upper(), size=10.5, weight='600', op='.7')

    if layout == 'wide':
        W, H = 1000, 590
        head(28, 26, 'The people and their devices')
        head(444, 26, 'The published protocol')
        head(680, 26, 'The engine')
        head(848, 26, 'Outside programs')
        band(16, 36, 302, 544)
        band(432, 36, 186, 500, accent=True)
        band(836, 36, 154, 272)
        rows = [('Designer', 52, 58), ('Operator', 118, 58), ('Venue technician', 184, 44), ('Director', 236, 58),
                ('GM', 302, 44), ('Players', 354, 44), ('Audience', 406, 44), ('Stranger', 458, 44), ('Developer', 510, 58)]
        for name, y, h in rows:
            person(28, y, 278, h, name, WORLD_PEOPLE[name][0])
        item(444, 50, 162, 32, 'Media list and bundle')
        item(444, 88, 162, 72, 'The pack')
        item(444, 190, 162, 32, 'Venue profile')
        item(444, 236, 162, 58, "The night's record", ['written at the end', 'of a game'])
        item(444, 302, 162, 226, 'Messages', ['what a device may ask,', 'what the engine answers,', 'what it tells screens'])
        item(680, 50, 120, 520, 'The engine', ['its inside is what', 'the design decides'], accent=True, name_size=16)
        for i, name in enumerate(WORLD_PROGRAMS):
            item(848, 52 + i * 42, 130, 34, name, name_size=12)
            arrow([(800, 69 + i * 42), (848, 69 + i * 42)], both=True)
        text(913, 280, 'the engine drives each', size=10.5, anchor='middle', op='.8')
        text(913, 294, 'and asks how it is', size=10.5, anchor='middle', op='.8')
        # people and the protocol
        arrow([(306, 66), (444, 66)], 'publishes', (375, 60))
        arrow([(306, 100), (444, 100)])
        arrow([(306, 146), (444, 146)], 'installs, picks', (375, 140))
        arrow([(306, 206), (444, 206)], 'writes', (375, 200))
        arrow([(444, 265), (306, 265)], 'read after the show', (375, 259))
        arrow([(306, 324), (444, 324)], 'commands, answers', (375, 318), both=True)
        arrow([(306, 376), (444, 376)], 'scans, answers', (375, 370), both=True)
        arrow([(444, 428), (306, 428)], 'scores, evidence', (375, 422))
        stopped((306, 480), (428, 480), 'gets nothing', (367, 474))
        arrow([(306, 520), (444, 520)], 'tests', (375, 514))
        # the protocol and the engine
        arrow([(606, 66), (680, 66)])
        arrow([(606, 124), (680, 124)])
        arrow([(606, 206), (680, 206)])
        arrow([(680, 265), (606, 265)])
        arrow([(606, 415), (680, 415)], both=True, accent=True)
        # below the band: the code itself
        arrow([(306, 558), (680, 558)], 'changes the code', (493, 553))
    else:
        W, H = 360, 786
        head(26, 18, 'The people and their devices')
        band(18, 26, 336, 318)
        grid = [('Designer', 26, 36), ('Venue technician', 190, 36), ('GM', 26, 100), ('Players', 190, 100),
                ('Audience', 26, 164), ('Director', 190, 164), ('Developer', 26, 228), ('Operator', 190, 228)]
        for name, x, y in grid:
            person(x, y, 156, 56, name, WORLD_PEOPLE[name][1], size=13)
        person(190, 292, 156, 44, 'Stranger', WORLD_PEOPLE['Stranger'][1], size=13)
        arrow([(104, 346), (104, 374)], both=True)
        text(114, 364, 'sends and receives', size=11, op='.9')
        stopped((268, 338), (268, 370), 'gets nothing', (278, 362), anchor='start')
        band(18, 376, 336, 162, accent=True)
        head(26, 394, 'The published protocol')
        item(26, 402, 320, 48, 'Messages', ['what a device asks, the answers, what screens show'])
        item(26, 458, 156, 32, 'The pack')
        item(190, 458, 156, 32, 'Media list and bundle')
        item(26, 498, 156, 32, 'Venue profile')
        item(190, 498, 156, 32, "The night's record")
        arrow([(104, 540), (104, 568)], both=True, accent=True)
        item(26, 570, 150, 196, 'The engine', ['its inside is what', 'the design decides'], accent=True, name_size=16)
        band(192, 552, 162, 226)
        head(200, 570, 'Outside programs')
        for i, name in enumerate(WORLD_PROGRAMS):
            item(200, 578 + i * 38, 146, 32, name, name_size=11.5)
            arrow([(176, 594 + i * 38), (200, 594 + i * 38)], both=True)
        # the developer's code change goes round the protocol, not through it
        arrow([(26, 262), (9, 262), (9, 740), (26, 740)])
    defs = ('<defs>'
            f'<marker id="{mk}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker>'
            f'<marker id="{mka}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill: var(--accent)"/></marker>'
            '</defs>')
    return (f'<svg class="world-svg world-{layout}" viewBox="0 0 {W} {H}" role="img" aria-label="{e(WORLD_CAPTION)}" '
            f'font-family="IBM Plex Sans, system-ui, sans-serif">{defs}{"".join(out)}</svg>')


# ---------------------------------------------------------------------------------------------------
# index.html, The engine (plan v2 section 3.1).
# ---------------------------------------------------------------------------------------------------
def page_engine(D):
    f, purpose = D['front'], D['jobs_data']['purpose']
    tl = f['timeline']

    def tl_items(items, ordered=False):
        out = []
        for x in items:
            if x.get('current'):
                out.append(f'<li class="current" aria-current="step"><span class="here">Now</span>{rich(x["text"])}</li>')
            else:
                out.append(f'<li>{rich(x["text"])}</li>')
        tag = 'ol' if ordered else 'ul'
        return f'<{tag}>{"".join(out)}</{tag}>'
    if sum(1 for x in tl['now'] if x.get('current')) != 1:
        raise SystemExit('front.timeline.now must mark exactly one current item')
    moments = ''.join(f'''<article class="moment">
  <div class="moment-meta">
    <h3>{e(m["name"])}</h3>
    <p class="when">{e(m["when"])}</p>
    <div><span class="tag">Who is there</span><ul>{"".join(f"<li>{e(p)}</li>" for p in m["people"])}</ul></div>
  </div>
  <div class="moment-counts"><span class="tag">What they count on</span><ul class="counts">{"".join(f"<li>{promise_a(p['id'])}<span>{rich(p['why'])}</span></li>" for p in m["promises"])}</ul></div>
</article>''' for m in f['moments'])
    guide = ''.join(f'<li>{page_a(g["page"])}<span>{rich(g["line"])}</span></li>' for g in f['siteGuide'])
    quals = ''.join(f'<li><a href="{href("requirements", "quality-" + slug(q["quality"]))}">{e(q["quality"])}</a>{rich(q["line"])}</li>'
                    for q in f['qualities'])
    growth = ''.join(f'<div><h3><a href="{href("requirements", "growth-" + slug(g["who"]))}">{e(g["who"])}</a></h3><p>{rich(g["line"])}</p></div>'
                     for g in f['growth'])
    cap = WORLD_CAPTION
    world = world_svg('wide') + world_svg('narrow')
    lately = ''.join(f'<li>{dec_a(x["slug"])}<span>{rich(x["line"])}</span></li>' for x in f['decidedLately'])

    def terms(group):
        return ''.join(f'<dt>{e(t["term"])}</dt><dd>{rich(t["def"])}</dd>' for t in f['words'] if t['group'] == group)
    return f'''<header class="top page-head">
  <h1>What the engine promises</h1>
  <p class="lead">{rich(f["lead"])}</p>
</header>

<section id="where" aria-labelledby="where-h">
  <h2 id="where-h">Where the work stands</h2>
  <div class="timeline">
    <div><h3>Done</h3>{tl_items(tl["done"])}</div>
    <div class="tl-now"><h3>Now: the design half</h3>{tl_items(tl["now"])}</div>
    <div><h3>Next</h3>{tl_items(tl["next"])}</div>
  </div>
</section>

<section id="now" aria-labelledby="now-h">
  <h2 id="now-h">What you can do now</h2>
  <p class="callout">{rich(f["now"])}</p>
</section>

<section id="guide" aria-labelledby="guide-h">
  <h2 id="guide-h">The pages</h2>
  <ul class="guide">{guide}</ul>
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

<section id="qualities" aria-labelledby="qualities-h">
  <h2 id="qualities-h">How well it must work</h2>
  <ul class="lines">{quals}</ul>
</section>

<section id="growth" aria-labelledby="growth-h">
  <h2 id="growth-h">How it must grow</h2>
  <div class="growth">{growth}</div>
</section>

<section id="world" aria-labelledby="world-h">
  <h2 id="world-h">The engine in its world</h2>
  <figure class="dia wide world">
    <figcaption>{e(cap)}</figcaption>
    <div class="world-pic">{world}</div>
    <p class="figkey">{rich(f["worldKey"])}</p>
  </figure>
</section>

<section id="lately" aria-labelledby="lately-h">
  <h2 id="lately-h">Decided lately</h2>
  <ul class="lines">{lately}</ul>
</section>

<section id="words" aria-labelledby="words-h">
  <h2 id="words-h">The words</h2>
  <p>{rich(WORDS_INTRO)}</p>
  <div class="words">
    <div><h3>This site's words</h3><dl class="terms">{terms("page")}</dl></div>
    <div><h3>The names of the steps</h3><dl class="terms">{terms("sequence")}</dl>
      <h3 style="margin-top:18px">The words the design rounds use</h3><dl class="terms">{terms("design")}</dl></div>
  </div>
</section>'''


# ---------------------------------------------------------------------------------------------------
# decisions.html (plan v2 section 3.2).
# ---------------------------------------------------------------------------------------------------
# Row D3, with plan v2's name (the decisions overlay's intro uses the same words).
STATUS_TEXT = {'open': 'Open', 'applied': 'Applied, please confirm', 'changed': 'Recommendation changed by the earlier candidate'}
# The later choices that have a row in the earlier candidate's alternatives table: the item's opening words and
# the row's anchor on the design page. The build checks that all six find their item.
LATER_ALT = {
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


def question_html(q):
    opts = ''
    if q.get('options'):
        opts = ('<div class="block"><span class="tag">The options, and what each costs</span><ul class="options">'
                + ''.join(f'<li><strong>{rich(o["label"])}</strong> {rich(o["cost"])}</li>' for o in q['options'])
                + '</ul></div>')
    if q['anchor'] != 'q-' + q['letter'].lower():
        raise SystemExit(f'question {q["letter"]}: anchor {q["anchor"]} is not q-<letter>')
    return f'''<article class="q q-{q["status"]}" id="{q["anchor"]}">
  <p class="stag s-{q["status"]}">{e(STATUS_TEXT[q["status"]])}</p>
  <h3><span class="letter">{e(q["letter"])}.</span> {rich(q["title"])}</h3>
  <div class="block"><span class="tag">What it decides</span><p>{rich(q["decides"])}</p></div>
  <div class="block"><span class="tag">What we know</span><ul>{li(q["evidence"])}</ul></div>
  {opts}
  <p class="rec"><span class="tag">{e(q["recKind"])}</span>{rich(q["recommendation"])}</p>
</article>'''


def page_decisions(D):
    d = D['decisions']
    groups = ''.join(f'''<div class="qgroup" id="g-{slug(g["title"])}">
    <h3>{e(g["title"])}</h3>
    {"".join(question_html(q) for q in g["questions"])}
  </div>''' for g in d['groups'])
    rounds = []
    for r in d['designRounds']:
        head, sep, rest = r['text'].partition(':')
        if not sep:
            raise SystemExit(f'design round without a name before its colon: {r["text"][:60]}')
        m = re.fullmatch(r'design\.html#(d-[a-z-]+)', r['link'])
        if not m:
            raise SystemExit(f'design round link is not design.html#d-<slug>: {r["link"]}')
        rounds.append(f'<li><a class="round" href="{href("design", m.group(1))}">{e(head)}</a>:{rich(rest)}</li>')
    later = []
    for s in d['later']:
        k = next((k for k in LATER_ALT if s['text'].startswith(k)), None)
        if k is None:
            later.append(f'<li>{rich(s["text"])}</li>')
        else:
            later.append(f'<li><a href="{href("design", LATER_ALT[k])}">{e(k)}</a>{rich(s["text"][len(k):])}</li>')
    topics = []
    for t in d['decided']:
        entries = ''.join(f'<li id="dec-{x["slug"]}"><span class="dn">{e(x["title"])}<span class="dd">{e(x["date"])}</span></span>'
                          f'<span>{rich(x["line"])}</span></li>' for x in t['entries'])
        topics.append(f'''<div class="topic" id="t-{t["slug"]}">
    <h3>{e(t["topic"])}</h3>
    <ul class="decided-list">{entries}</ul>
  </div>''')
    return f'''<header class="page-head">
  <h1>Decisions</h1>
  <div class="prose">{paras(d["intro"])}</div>
</header>

<section class="questions" id="open" aria-labelledby="open-h">
  <h2 id="open-h">Open now</h2>
  {groups}
</section>

<section id="design-rounds" aria-labelledby="design-rounds-h">
  <h2 id="design-rounds-h">Coming in the design rounds, no answer needed now</h2>
  <p>The top-level decisions, in the order the design rounds take them, hardest to reverse first. Each links to its entry on {page_a("design")}.</p>
  <ul class="rounds">{"".join(rounds)}</ul>
  <h3>Later choices</h3>
  <p>{rich(LATER_INTRO)}</p>
  <ul class="later">{"".join(later)}</ul>
</section>

<section id="decided" aria-labelledby="decided-h">
  <h2 id="decided-h">Decided, by topic</h2>
  <p>{rich(DECIDED_HISTORY)}</p>
  {"".join(topics)}
</section>'''


# ---------------------------------------------------------------------------------------------------
# requirements.html (plan v2 section 3.3).
# ---------------------------------------------------------------------------------------------------
STATUS_KIND = {'settled': 'Settled', 'partly settled': 'Partly settled', 'proposed': 'Proposed'}


def serves(item):
    return [TITLE_TO_PROMISE[t] for t in item['promises']]


def state_html(item):
    k = item['statusKind']
    if k not in STATUS_KIND:
        raise SystemExit(f'{item["id"]}: unknown statusKind {k}')
    return (f'<p class="state"><span class="stag k-{slug(k)}">{e(STATUS_KIND[k])}</span>'
            f'<span class="small">{rich(status_grounds(item["status"]))}</span></p>')


def status_grounds(s):
    """The status sentence without the word its tag already shows (requirements check row 16): "settled by the
    owner (X)" reads "On: X"; a qualified "settled by the owner in part (X); ..." reads "Your word in part (X); ..."."""
    for lead in ('settled by the owner', 'proposed'):
        if not s.startswith(lead):
            continue
        open_at = s.find('(')
        qual = s[len(lead):open_at].strip()
        if open_at < 0 or (qual and lead == 'proposed'):
            break
        depth = 0
        for i in range(open_at, len(s)):
            depth += {'(': 1, ')': -1}.get(s[i], 0)
            if depth == 0:
                break
        inner, rest = s[open_at + 1:i], s[i + 1:]
        if qual:
            return f'Your word {qual} ({inner}){rest}'
        return f'On: {inner}{rest}'
    return cap1(s)


def promise_served_list(ids):
    return '; '.join(promise_a(j) for j in ids)


def glance_html(jobs, D):
    """The ten at a glance: title, who, when, how many quality targets and extension cases serve it."""
    rows = []
    for j in jobs:
        fn = j['functional']
        nq, nx = len(D['served_qt'][j['id']]), len(D['served_ex'][j['id']])
        rows.append(f'<tr><th scope="row">{promise_a(j["id"])}</th><td class="who">{e(fn["people"])}</td><td class="when">{e(fn["moment"])}</td>'
                    f'<td class="num">{nq}</td><td class="num">{nx}</td></tr>')
    return ('<div class="tablewrap"><table class="glance"><thead><tr><th>Promise</th><th>Who</th><th>When</th>'
            '<th>Quality targets</th><th>Extension cases</th></tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table></div>')


def promise_html(j, D):
    """A promise entry (version 8's), in version 9's frame: "Built today" moved to Today's engine and the earlier
    candidate's parts to the part cards on Design; "Broken by" is "Where today's engine falls short"; the
    quality targets and extension cases that serve it follow."""
    fn = j['functional']
    anchor = PROMISE_ANCHOR[j['id']]
    needs = ''.join(f'<li>{e(n)}</li>' for n in j['needs'])
    tests = ''.join(f'<li>{e(t)}</li>' for t in j['tests'])

    def short(f):
        fid = f['id']
        note = ' <span class="muted">(proposed)</span>' if fid == 'N1' else ''
        cls = '' if f['primary'] else ' class="secondary"'
        return f'<li{cls}>{flaw_a(fid)}{note}: {e(f["how"])}</li>'
    main = ''.join(short(f) for f in j['flaws'] if f['primary'])
    also = ''.join(short(f) for f in j['flaws'] if not f['primary'])
    if not main and also:   # version 8's "Main: None yet" (requirements check row 6)
        main = '<li class="muted">None yet: its planned capabilities are not built.</li>'
    shorts = ([f'<span class="tag">Mainly</span><ul>{main}</ul>'] if main else []) + \
             ([f'<span class="tag">Also</span><ul>{also}</ul>'] if also else [])
    standalone = re.sub(r'^In a standalone game:\s*', '', j['standalone'])
    goal_tag = 'The long-term goal' + (' <span class="open">(open for the design rounds)</span>' if j.get('goalOpen') else '')   # row P55
    q = j.get('questions') or []
    qtext = ('answers ' + pass_questions(q)) if q else 'no architecture pass question covers it yet'   # rows P21 to P30
    qts = ''.join(f'<li>{qt_a(x)}</li>' for x in D['served_qt'][j['id']])
    exs = ''.join(f'<li>{ex_a(x)}</li>' for x in D['served_ex'][j['id']])
    return f'''
<section class="job" id="{anchor}" aria-labelledby="{anchor}-h">
  <header class="job-head">
    <h3 id="{anchor}-h">{e(TITLES[j["id"]])}</h3>
    <dl class="who"><dt>Who</dt><dd>{e(fn["people"])}</dd><dt>When</dt><dd>{e(fn["moment"])}</dd></dl>
  </header>
  <div class="countson"><span class="tag">What they count on</span><p class="meaning">{e(fn["need"])}</p></div>
  <div class="job-facts">
    <div><span class="tag">{goal_tag}</span><p>{e(j["goal"])}</p></div>
    <div class="served"><span class="tag">Served by these quality targets</span><ul>{qts}</ul>
      <span class="tag">and these extension cases</span><ul>{exs}</ul></div>
  </div>
  <div class="short">
    <span class="tag">Where today's engine falls short</span>
    {"".join(shorts) or '<ul><li class="muted">No design flaw breaks this promise mainly: its planned capabilities are not built yet.</li></ul>'}
  </div>
  <p class="standalone"><span class="tag">In a standalone game</span> {e(standalone)}</p>
  <details><summary>What the planned capabilities need from it ({len(j["needs"])})</summary><ul class="examples">{needs}</ul></details>
  <details><summary>Test situations from the shows ({len(j["tests"])}); {e(qtext)}</summary><ul class="examples">{tests}</ul></details>
</section>'''


def qt_html(t):
    num = ''
    if t.get('numberToSet', '').strip():
        num = (f'<p class="numset"><span class="tag">Number to set</span>{rich(cap1(t["numberToSet"]))}. '
               f'{rich("Listed with the other numbers to set on [[q:A|Decisions]].")}</p>')
    return f'''<article class="req" id="{t["id"].lower()}">
  <h4>{e(t["title"])}</h4>
  <p>{rich(t["situation"])}</p>
  {num}
  <p><span class="tag">Serves</span>{promise_served_list(serves(t))}</p>
  {state_html(t)}
  <p><span class="tag">Why it matters</span>{rich(t["why"])}</p>
</article>'''


def ex_html(x):
    return f'''<article class="req" id="{x["id"].lower()}">
  <h4>{e(x["title"])}</h4>
  <p><span class="tag">Who</span>{rich(cap1(x["who"]))}</p>
  <p>{rich(x["case"])}</p>
  <p><span class="tag">Goes through</span>{rich(x["throughWhat"])}</p>
  <p><span class="tag">Must not need</span>{rich(x["mustNotNeed"])}</p>
  <p><span class="tag">When</span>{rich(cap1(x["when"]))}</p>
  <p><span class="tag">Serves</span>{promise_served_list(serves(x))}</p>
  {state_html(x)}
  <p><span class="tag">Why</span>{rich(x["why"])}</p>
</article>'''


def growth_groups(D):
    """Each extension case in exactly one group: the growth item whose line links it with an [[ex:]] marker."""
    groups, seen = [], {}
    for g in D['front']['growth']:
        ids = re.findall(r'\[\[ex:(EX\d+)(?:\|[^\]]*)?\]\]', g['line'])
        for x in ids:
            if x in seen:
                raise SystemExit(f'extension case {x} falls in two groups: "{seen[x]}" and "{g["who"]}"')
            seen[x] = g['who']
        groups.append((g, ids))
    missing = [x for x in EX if x not in seen]
    if missing:
        raise SystemExit(f'extension cases in no group of front.growth: {missing}')
    return groups


def page_requirements(D):
    jobs, R = D['jobs'], D['rules']
    quality_groups = []
    order = []
    for t in D['qt_list']:
        if t['quality'] not in order:
            order.append(t['quality'])
    for qname in order:
        items = [t for t in D['qt_list'] if t['quality'] == qname]
        quality_groups.append(f'''<div class="req-group" id="quality-{slug(qname)}">
    <h3>{e(qname)}</h3>
    <div class="reqs">{"".join(qt_html(t) for t in items)}</div>
  </div>''')
    growth = ''.join(f'''<div class="req-group" id="growth-{slug(g["who"])}">
    <h3>{e(g["who"])}</h3>
    <p>{rich(g["line"])}</p>
    <div class="reqs">{"".join(ex_html(EX[x]) for x in ids)}</div>
  </div>''' for g, ids in growth_groups(D))
    rules = ''.join(f'''<div class="rule-group" id="rules-{g["slug"]}">
    <h3>{e(g["title"])}</h3>
    <ul class="rules">{"".join(f'<li id="rule-{r["slug"]}"><strong>{e(r["title"])}</strong><span>{rich(r["line"])}</span><span class="src">{rich(r["source"])}</span></li>' for r in g["rules"])}</ul>
  </div>''' for g in R['groups'])
    n_num = sum(1 for t in D['qt_list'] if t.get('numberToSet', '').strip())
    return f'''<header class="page-head">
  <h1>Requirements</h1>
  <div class="prose">{paras(D["front"]["intros"]["requirements"])}</div>
</header>

<section id="promises" aria-labelledby="promises-h">
  <h2 id="promises-h">The promises</h2>
  <p class="lead-in">Ten promises, each what a person can count on at a given moment. The table counts the quality targets and extension cases that serve each one.</p>
  {glance_html(jobs, D)}
  {"".join(promise_html(j, D) for j in jobs)}
</section>

<section id="qualities" aria-labelledby="qualities-h">
  <h2 id="qualities-h">How well it must work</h2>
  <p class="lead-in">{len(D["qt_list"])} quality targets under {len(order)} qualities. {cap1(NUM_WORD[n_num] if n_num < len(NUM_WORD) else str(n_num))} leave a number for you to set; {rich("Decisions lists them in one place, under the question [[q:A]].")}</p>
  {"".join(quality_groups)}
</section>

<section id="growth" aria-labelledby="growth-h">
  <h2 id="growth-h">How it must grow</h2>
  <p class="lead-in">{len(EX)} extension cases, grouped by the kind of person who does the growing.</p>
  {growth}
</section>

<section id="rules" aria-labelledby="rules-h">
  <h2 id="rules-h">The standing rules</h2>
  <div class="prose">{paras(R["intro"])}</div>
  {rules}
</section>'''


# ---------------------------------------------------------------------------------------------------
# design.html (plan v2 section 3.4), with the earlier candidate folded at the end.
# ---------------------------------------------------------------------------------------------------
JOINS = 'P16'   # Joins and proofs: replaced by the published protocol and the test bench


def overview_src(jobs):
    """The at-a-glance diagram with each node labelled by its promise's title."""
    src = OVERVIEW
    for j in jobs:
        src = src.replace(f'@{j["id"]}@', wrap_label(TITLES[j["id"]]))
    assert '@' not in src, 'a promise in the overview has no title'
    return src


def relations_src(shape):
    """The full diagram of links between promises, each node labelled by its promise's title alone."""
    return re.sub(r'^(\s*)(J\d+)\["[^"]*"\]', lambda m: f'{m.group(1)}{m.group(2)}["{wrap_label(TITLES[m.group(2)])}"]', shape['relationsMermaid'], flags=re.M)


def part_html(p, D):
    """A part card (version 8's), now inside the earlier candidate on Design; flaws go by title."""
    also = [j for j in p.get('jobs', []) if j not in KEEPS.get(p['id'], [])]
    runs = ', '.join(RUNS_ON.get(r, r) for r in p['runsOn'] if r != 'gm-tablet-standin')
    if 'gm-tablet-standin' in p['runsOn']:
        runs += '; in a standalone game, a small stand-in on the GM tablet'
    replaced = ''
    cls = 'part'
    if p['id'] == JOINS:
        cls = 'part is-replaced'
        dirs = D['design_decided']
        replaced = (f'<p class="replaced">Replaced by the published protocol and the test bench: '
                    f'<a href="{href("design", "decided-" + dirs["protocol"])}">the published protocol</a>, '
                    f'<a href="{href("design", "decided-" + dirs["bench"])}">the test bench outside the engine</a>.</p>')
    return f'''<article class="{cls}" id="{part_anchor(p["name"])}">
  <h4>{e(p["name"])}</h4>
  {replaced}
  <p>{e(p["plain"])}</p>
  <p class="pmeta"><span class="tag">Mainly keeps</span> {promise_links(KEEPS.get(p["id"], []))}</p>
  {f'<p class="pmeta muted"><span class="tag">Also needed by</span> {promise_links(also)}</p>' if also else ''}
  {f'<p class="pmeta"><span class="tag">Today</span> {e(TODAY[p["id"]])}</p>' if p["id"] in TODAY else ''}
  <p class="pmeta"><span class="tag">Removes</span> {flaw_list(p["flaws"])}</p>
  <p class="pmeta"><span class="tag">Runs on</span> {e(runs)}</p>
  <p class="pmeta muted"><span class="tag">Where it can be swapped</span> {e(p["seams"])}</p>
</article>'''


def earlier_html(D):
    """Version 8's Parts page, with the whole-engine picture and the promises' dependencies, inside one fold."""
    shape, jobs = D['shape'], D['jobs']
    assert len(shape['qualities']) == len(QUALITY_KEEPS), 'the qualities changed: update QUALITY_KEEPS'
    t = today_of(shape['mechanisms'][10]['plain'])   # who decides with no engine: today's way
    quality_today = {3: t[:1].lower() + t[1:]}
    qual = ''.join(f'<tr><th scope="row">{e(q["name"])}</th><td>{e(q["plain"])}' + (f' <span class="muted">Today: {e(quality_today[k])}</span>' if k in quality_today else '') + f'</td><td>{promise_links(QUALITY_KEEPS[k])}</td></tr>' for k, q in enumerate(shape['qualities']))
    tangles = ''.join(f'<li><strong>{e(t["title"])}.</strong> {e(t["plain"])} <span class="muted">Situations: {flaw_list(t["flaws"])}</span></li>' for t in shape['today']['tangles'])
    rows = part_layers(shape)
    edge = {0: '<span class="lvl">Top</span>', len(rows) - 1: '<span class="lvl">Bottom</span>'}
    layers = ''.join(f'<li>{edge.get(k, "")}{"".join(part_link(i) for i in row)}</li>' for k, row in enumerate(rows))
    order = [i for row in reversed(rows) for i in row]
    by_id = {p['id']: p for p in shape['parts']}
    parts = ''.join(part_html(by_id[i], D) for i in order)
    devices = ''.join(f'<li><strong>{e(h)}</strong> {e(t)}</li>' for h, t in FIT_DEVICES)
    walks = ''.join(f'''<figure class="dia walk">
      <figcaption>{e(title)}</figcaption>
      <p class="figkey">Shows {"; ".join(promise_link(j) for j in keeps)}.</p>
      <div class="scroll">{diagram(present(src), title)}</div>
    </figure>''' for title, keeps, src in WALKS)
    if len(shape['alternatives']) != len(ALT_ANCHORS):
        raise SystemExit('the alternatives changed: update ALT_ANCHORS')
    for a, start in zip(shape['alternatives'], ALT_TITLE_START):
        if not a['title'].startswith(start):
            raise SystemExit(f'alternative "{a["title"]}" no longer matches its anchor (ALT_TITLE_START)')
    alts = ''.join(f'<tr id="{anc}"><th scope="row">{rich(a["title"])}</th><td>{rich(a["a"])}</td><td>{rich(a["b"])}</td><td>{rich(a["cost"])}</td></tr>'
                   for a, anc in zip(shape['alternatives'], ALT_ANCHORS))
    n_uses = len(re.findall(r"-->", shape["partsMermaid"]))
    uses_src = re.sub(r'\["P\d+ ', '["', shape['partsMermaid'])   # boxes by name only: no part numbers on the page
    uses_cap = f'Which part uses which: {n_uses} links'
    fit = ''.join(f'<p><strong>{e(h)}</strong> {rich(t)}</p>' for h, t in FIT_SUMMARY)
    n_links = len(re.findall(r"-\.?->", shape["relationsMermaid"]))
    n_deps = len(re.findall(r"[^.]-->", shape["relationsMermaid"]))
    overview = present(overview_src(jobs)).replace('"useMaxWidth": false}, "sequence"', '"useMaxWidth": false, "nodeSpacing": 20}, "sequence"', 1)
    rel_cap = f'The {n_links} main links between the promises'
    return f'''<details class="earlier">
    <summary><span class="tag">Open the earlier candidate</span><span class="note">{rich(D["design"]["earlierNote"])}</span></summary>
    <div class="earlier-body">

<section class="fit-block" id="whole" aria-labelledby="whole-h">
  <h3 id="whole-h">The earlier candidate, whole</h3>
  <figure class="dia whole">
    <figcaption>The earlier candidate, whole</figcaption>
    <div class="scroll"><div class="svgwrap">{shape_svg()}</div></div>
    <p class="figkey">{rich(WHOLE_KEY)}</p>
  </figure>
  <div class="fit-summary">{fit}</div>
</section>

<section class="fit-block" id="depend" aria-labelledby="depend-h">
  <h3 id="depend-h">How the promises depend on each other</h3>
  <figure class="dia wide">
    <figcaption>The main dependencies in brief</figcaption>
    <p class="figkey">{OVERVIEW_KEY}</p>
    <div class="scroll">{diagram(overview, "The main dependencies in brief")}</div>
    <details>
      <summary>{e(rel_cap)}</summary>
      <p class="muted" style="margin:10px 0">{e(RELATIONS_NOTE.format(n=n_deps))}</p>
      <div class="scroll">{diagram(present(relations_src(shape)), rel_cap)}</div>
    </details>
  </figure>
</section>

<section class="fit-block" id="candidate-qualities" aria-labelledby="candidate-qualities-h">
  <h3 id="candidate-qualities-h">Qualities every part must have</h3>
  <p>{rich(QUALITIES_INTRO)}</p>
  <div class="tablewrap"><table class="mech"><thead><tr><th>Quality</th><th>What it means</th><th>Mainly keeps</th></tr></thead><tbody>{qual}</tbody></table></div>
</section>

<section class="fit-block" id="layers" aria-labelledby="layers-h">
  <h3 id="layers-h">The parts in layers</h3>
  <figure class="layers-fig">
    <figcaption>{e(LAYERS_CAPTION)}</figcaption>
    <ol class="layers">{layers}</ol>
  </figure>
  <details>
    <summary>{e(uses_cap)}</summary>
    <p class="muted" style="margin:10px 0">{e(USES_NOTE)}</p>
    <div class="scroll">{diagram(present(uses_src), uses_cap)}</div>
  </details>
</section>

<section class="fit-block" id="walks" aria-labelledby="walks-h">
  <h3 id="walks-h">Five moments, part by part</h3>
  <p>{e(MOMENTS_KEY)}</p>
  <div class="walks">{walks}</div>
</section>

<section class="fit-block" id="the-parts" aria-labelledby="the-parts-h">
  <h3 id="the-parts-h">The seventeen parts</h3>
  <p>{e(PARTS_KEY)}</p>
  <div class="parts">{parts}</div>
</section>

<section class="fit-block" id="where-they-run" aria-labelledby="where-they-run-h">
  <h3 id="where-they-run-h">Which part would run where</h3>
  <ul class="devices">{devices}</ul>
  <details>
    <summary>In a standalone game, promise by promise</summary>
    <ul class="devices">{"".join(f'<li><strong>{promise_a(j["id"])}</strong> {e(j["standaloneCandidate"])}</li>' for j in jobs)}</ul>
  </details>
  <details>
    <summary>As a diagram</summary>
    <div class="scroll">{diagram(present(shape["componentsMermaid"]), "Which part would run where, as a diagram")}</div>
  </details>
</section>

<section class="fit-block" id="tangles" aria-labelledby="tangles-h">
  <h3 id="tangles-h">Where today's code tangles</h3>
  <details>
    <summary>Where the promises' work sits in today's code: {len(shape["today"]["tangles"])} tangles</summary>
    <p class="muted" style="margin:10px 0">{rich(TANGLE_NOTE)}</p>
    <ul class="examples">{tangles}</ul>
  </details>
</section>

<section class="fit-block" id="alternatives" aria-labelledby="alternatives-h">
  <h3 id="alternatives-h">Where a real alternative exists</h3>
  <p>{e(ALTS_INTRO)}</p>
  <div class="tablewrap"><table class="alts"><thead><tr><th>Choice</th><th>The candidate</th><th>The other way</th><th>What each costs</th></tr></thead><tbody>{alts}</tbody></table></div>
</section>
    </div>
  </details>'''


def page_design(D):
    g = D['design']
    ahead = ''.join(f'''<article class="ahead-item" id="d-{a["slug"]}">
    <h3>{e(a["title"])}</h3>
    <div class="block"><span class="tag">What it decides</span><p>{rich(a["decides"])}</p></div>
    <div class="block"><span class="tag">What drives it</span><p>{rich(a["drivers"])}</p></div>
    <div class="block"><span class="tag">Already settled around it</span><p>{rich(a["settled"])}</p></div>
    <div class="block"><span class="tag">What the panel and the design round bring</span><p>{rich(a["panel"])}</p></div>
  </article>''' for k, a in enumerate(g['ahead'], 1))
    for a in g['ahead']:
        if a['slug'] != slug(a['title']):
            raise SystemExit(f'design.ahead slug {a["slug"]} is not the slug of its title')
    decided = ''.join(f'''<article class="direction" id="decided-{x["slug"]}">
    <h3>{e(x["title"])}</h3>
    {paras(x["paragraphs"])}
  </article>''' for x in g['decided'])
    later = []
    for x in g['later']:
        alt = (x.get('alt') or '').strip()
        link = f' <a href="{href("design", alt)}">The earlier candidate compares both.</a>' if alt else ''
        later.append(f'<li>{rich(x["text"])}{link}</li>')
    pb = g['panel']
    if pb['slug'] != 'panel':
        raise SystemExit('design.panel must carry the slug "panel" (the anchor the Decisions page links to)')

    def pb_items(items):
        return ''.join(f'<li><strong>{e(i["lead"])}.</strong> {rich(i["text"])}</li>' for i in items)
    pb_secs = ''.join(f'''<div class="pb-sec">
    <h3>{e(sec["title"])}</h3>
    {paras(sec.get("paragraphs", []))}
    {f'<ul class="pb-items">{pb_items(sec["items"])}</ul>' if sec.get("items") else ''}
    {paras(sec.get("after", []))}
  </div>''' for sec in pb['sections'])
    return f'''<header class="page-head">
  <h1>Design</h1>
  <div class="prose">{paras(D["front"]["intros"]["design"])}</div>
</header>

<section id="ahead" aria-labelledby="ahead-h">
  <h2 id="ahead-h">The decisions ahead</h2>
  <div class="ahead">{ahead}</div>
</section>

<section id="panel" aria-labelledby="panel-h">
  <h2 id="panel-h">{e(pb["title"])}</h2>
  <div class="prose">{paras(pb["intro"])}</div>
  <div class="pb">{pb_secs}</div>
</section>

<section id="decided" aria-labelledby="decided-h">
  <h2 id="decided-h">Decided directions</h2>
  <div class="directions">{decided}</div>
</section>

<section id="later" aria-labelledby="later-h">
  <h2 id="later-h">Later choices</h2>
  <p>Mid-level choices that still stand. Each is settled inside one of the decisions ahead, or by the build plan.</p>
  <ul class="later">{"".join(later)}</ul>
</section>

<section id="earlier" aria-labelledby="earlier-h">
  <h2 id="earlier-h">The earlier candidate</h2>
  {earlier_html(D)}
</section>'''


# ---------------------------------------------------------------------------------------------------
# today.html (plan v2 section 3.5).
# ---------------------------------------------------------------------------------------------------
def card_html(c):
    """A situation (version 8's card): title only; the candidate's side folded (plan v2 3.5 item 3)."""
    ex = ''.join(f'<li>{e(x["text"])}</li>' for x in c['examples'])   # row F7: no finding ids
    mods = ''.join(f'<code>{e(m)}</code>' for m in c['modules'])
    live = f'<p class="live-note"><span class="tag">{seen_label(c)}</span> {e(c["seenLive"])}</p>' if c.get('seenLive') else ''
    sa = c.get('inStandalone', '')
    sa_html = f'<p class="standalone"><span class="tag">In a standalone game</span> {rich(sa)}</p>' if sa else ''
    return f'''
<article class="card" id="{c["id"].lower()}">
  <header class="card-head">
    <h3>{e(c["title"])}</h3>
    <div class="chips">{chips(c)}</div>
    {questions_line(c)}
  </header>
  <div class="story">
    <p><span class="tag">At a show</span> {e(c["atAShow"])}</p>
    <p><span class="tag">Why it happens</span> {e(c["whyItHappens"])}</p>
    {live}
    {sa_html}
  </div>
  <figure class="dia before">
    <figcaption>{e(c["before"]["caption"])}</figcaption>
    <div class="scroll">{diagram(present(c["before"]["mermaid"]), c["before"]["caption"])}</div>
  </figure>
  <details class="fold">
    <summary>How the earlier candidate would remove it</summary>
    <figure class="dia after">
      <figcaption>{e(c["after"]["caption"])}</figcaption>
      <div class="scroll">{diagram(present(c["after"]["mermaid"]), c["after"]["caption"])}</div>
      <p class="after-note">{e(c["after"]["note"].replace(" Or: ", " The other way the earlier candidate weighed: "))}</p>
    </figure>
    {part_row(c.get("parts", []), "Removed by these parts of the earlier candidate")}
    <p class="design"><span class="tag">In design terms</span> {e(c["designTerms"])}</p>
  </details>
  <details>
    <summary>The problems behind it, and the code they live in</summary>
    <ul class="examples">{ex}</ul>
    <div class="mods">{mods}</div>
  </details>
</article>'''


def n1_html(D):
    """The proposed seventeenth, a short entry: no card, no record in the cards data (row F82)."""
    lines = D['n1_lines']
    main = [(j, h) for j, h, p in lines if p]
    also = [(j, h) for j, h, p in lines if not p]
    also_html = ''.join(f'<li>{promise_a(j)}: {e(h)}</li>' for j, h in also)
    return f'''
<article class="card proposed" id="n1">
  <header class="card-head">
    <h3>{e(N1_TITLE)}</h3>
    <div class="chips"><span class="chip">Proposed</span><span class="chip">{D["n1_findings"]} problems found</span></div>
  </header>
  <div class="story">
    <p><span class="tag">What breaks</span> {e(main[0][1])}</p>
    <p><span class="tag">It mainly touches</span> {promise_a(main[0][0])}</p>
    <div><span class="tag">It also touches</span><ul class="examples">{also_html}</ul></div>
  </div>
  <details class="fold">
    <summary>How the earlier candidate would remove it</summary>
    {part_row(D["n1_parts"], "Removed by these parts of the earlier candidate")}
  </details>
  <p class="design"><span class="tag">Waiting for your answer</span> {rich("Whether it is a design flaw of its own, needing its own design choice, is part of your question [[q:G]]. Its problems come from the review of standalone games.")}</p>
</article>'''


def grid_html(cards):
    head = ''.join(f'<th scope="col"><span>{e(name)}</span></th>' for name, _ in PARTS)
    rows = []
    for c in cards:
        cells = []
        for _, match in PARTS:
            hit = any(match(m) for m in c['modules'])
            cells.append('<td class="dot" aria-label="yes">●</td>' if hit else '<td></td>')
        rows.append(f'<tr><th scope="row">{flaw_a(c["id"])}</th>{"".join(cells)}</tr>')
    return f'<div class="tablewrap"><table class="grid"><thead><tr><th scope="col">Situation</th>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>'


def parity_html():
    body = ''.join(
        f'<tr{" class=both-weak" if weak else ""}><th scope="row">{e(c[0])}</th><td>{e(c[1])}</td><td>{e(c[2])}</td><td>{e(c[3])}</td></tr>'
        for n, c, weak in parity_rows())
    # Row F137.
    return ('<div class="tablewrap"><table class="parity"><thead><tr><th>Behaviour</th>'
            '<th>Phone\'s scanner, standalone</th><th>Hardware scanner, no engine</th><th>What the hardware scanner would need (a proposal, not decided)</th>'
            f'</tr></thead><tbody>{body}</tbody></table></div>')


def page_today(D):
    cards, jobs, by_id, home = D['cards'], D['jobs'], D['by_id'], D['home']
    works = ''.join(f'<li>{promise_a(j["id"])}<span>{e(BUILT[j["id"]])}</span></li>' for j in jobs)
    well = ''.join(f'<li><span>{rich(x)}</span></li>' for x in WELL_BUILT)
    # The situations at a glance.
    others = {}
    for j in jobs:
        for f in j['flaws']:
            if not f['primary']:
                others.setdefault(f['id'], []).append(j['id'])
    rows = []
    order = [f['id'] for j in jobs for f in j['flaws'] if f['primary'] and f['id'] != 'N1']   # the cards' order below
    entries = [(i, by_id[i]['findings'], seen_label(by_id[i])) for i in order]
    entries.append(('N1', D['n1_findings'], ''))
    n_live = sum(1 for x in entries if x[2] == SEEN_LIVE)
    n_test = sum(1 for x in entries if x[2] == SEEN_TEST)
    for fid, n, live in entries:
        note = ' <span class="muted">(proposed)</span>' if fid == 'N1' else ''
        oth = '<br/>'.join(promise_a(x, quotes=True) for x in others.get(fid, []))
        rows.append(f'<tr><th scope="row">{flaw_a(fid)}{note}</th><td>{promise_a(home[fid], quotes=True)}</td>'
                    f'<td class="muted">{oth}</td><td class="num">{n}</td><td>{live}</td></tr>')
    table = ('<div class="tablewrap"><table class="flawtable"><thead><tr><th>Situation</th><th>Mainly touches</th>'
             '<th>Also touches</th><th>Problems</th><th>Seen live or in a test</th></tr></thead>'
             f'<tbody>{"".join(rows)}</tbody></table></div>'
             f'<p class="muted">{NUM_WORD[n_live].capitalize()} situations were seen live; '
             f'{NUM_WORD[n_test]} more were reproduced in a test.</p>')
    # The sixteen, grouped under the promise each mainly touches; the proposed seventeenth after them.
    groups = []
    for j in jobs:
        mine = [f['id'] for f in j['flaws'] if f['primary'] and f['id'] != 'N1']
        if not mine:
            continue
        body = ''.join(card_html(by_id[i]) for i in mine)
        groups.append(f'''<div class="fgroup" id="under-{PROMISE_ANCHOR[j["id"]]}">
  <h3><span class="tag">{TODAY_GROUP_TAG}</span>{promise_a(j["id"])}</h3>
  {body}
</div>''')
    total = sum(c['findings'] for c in cards)
    aside_n = sum(n for _, n, _ in SET_ASIDE)
    aside = ''.join(f'<tr><th scope="row">{e(k)}</th><td class="num">{n}</td><td>{rich(t)}</td></tr>' for k, n, t in SET_ASIDE)
    sa_all = len(D['new_findings'])
    sa_n1 = sum(1 for f in D['new_findings'] if f['cause'].startswith('N1'))
    intro = EVIDENCE_INTRO.format(total_all=total + aside_n, total=total, aside_n=aside_n, sa_all=sa_all,
                                  sa_cards=sa_all - sa_n1, sa_n1=sa_n1)
    D['totals'] = (total, aside_n, total + aside_n)
    n_parity = len(parity_rows())
    return f'''<header class="page-head">
  <h1>Today's engine</h1>
  <div class="prose">{paras(D["front"]["intros"]["today"])}</div>
</header>

<section id="works" aria-labelledby="works-h">
  <h2 id="works-h">What works today</h2>
  <h3>What each promise already has</h3>
  <ul class="works">{works}</ul>
  <h3>The pieces already well built</h3>
  <ul class="works">{well}</ul>
</section>

<section id="situations" aria-labelledby="situations-h">
  <h2 id="situations-h">Sixteen situations any new design must handle</h2>
  <p class="lead-in">{rich(CARD_GUIDE)}</p>
  {LEGEND}
  {table}
  <div class="family">{"".join(groups)}</div>
  <h3>The proposed seventeenth</h3>
  {n1_html(D)}
</section>

<section class="sa-box" id="standalone" aria-labelledby="standalone-h">
  <h2 id="standalone-h">Standalone today</h2>
  <details>
    <summary>Standalone games today, and the hardware scanner against the phone's scanner with no engine: {n_parity} differences</summary>
    <p>{rich(STANDALONE_P1)}</p>
    <p style="margin-top:10px">{rich(STANDALONE_P2)}</p>
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
    <summary>Where each situation lives in today's code</summary>
    <p class="muted" style="margin:10px 0">{e(GRID_NOTE)}</p>
    {grid_html(sorted(cards, key=lambda c: int(c['id'][1:])))}
  </details>
</section>'''


# ---------------------------------------------------------------------------------------------------
# changes.html (plan v2 section 3.6).
# ---------------------------------------------------------------------------------------------------
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
  <h3><span class="cid">{e(x["id"])}</span>{flaw_a(x["id"])}</h3>
  <ul>{li(x["changes"])}</ul>
</article>''' for x in c['cards'])
    recs = []
    for r in c['recommendations']:
        m = re.fullmatch(r'\[\[q:([A-Z])\]\]', r['question'].strip())
        if not m:
            raise SystemExit(f'recommendation {r["key"]}: "question" is not a [[q:X]] marker')
        title = next(q['title'] for g in D['decisions']['groups'] for q in g['questions'] if q['letter'] == m.group(1))
        recs.append(f'''<article class="log-entry" id="rec-{r["key"].lower()}">
  <p class="when">Earlier question {e(r["key"])}</p>
  <h3>{rich(r["question"])}: {rich(title)}</h3>
  <div class="beforeafter">
    <div><span class="tag">Before</span><p>{rich(r["before"])}</p></div>
    <div><span class="tag">After</span><p>{rich(r["after"])}</p></div>
  </div>
  <p class="prompt"><span class="tag">Why</span> {rich(r["why"])}</p>
</article>''')
    jargon = ''.join(f'<tr><th scope="row">{rich(x["was"])}</th><td>{rich(x["now"])}</td></tr>' for x in c['jargon'])
    numbers = ''.join(f'<tr><th scope="row">{rich(x["was"])}</th><td>{rich(x["title"])}</td><td>{rich(x["where"])}</td></tr>' for x in c['numbers'])
    seq = ''.join(f'<tr><th scope="row">{rich(x["was"])}</th><td>{rich(x["now"])}</td></tr>' for x in c['sequence'])
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
  <p>{e(EARLIER_NOTE)}</p>
  <div class="log-grid">{proms}</div>
</section>

<section id="card-changes" aria-labelledby="card-changes-h">
  <h2 id="card-changes-h">The cards</h2>
  <p>{e(NOW_NOTE)}</p>
  <div class="log-grid">{cards}</div>
</section>

<section id="recommendations" aria-labelledby="recommendations-h">
  <h2 id="recommendations-h">Recommendations the earlier candidate changed</h2>
  {"".join(recs)}
</section>

<section id="vocabulary" aria-labelledby="vocabulary-h">
  <h2 id="vocabulary-h">The words</h2>
  <ul class="plain-list">{li(c["vocabulary"])}</ul>
</section>

<section id="jargon" aria-labelledby="jargon-h">
  <h2 id="jargon-h">The words replaced in version 9</h2>
  <div class="tablewrap"><table class="logtable"><thead><tr><th>Was</th><th>Now</th></tr></thead><tbody>{jargon}</tbody></table></div>
</section>

<section id="numbers" aria-labelledby="numbers-h">
  <h2 id="numbers-h">Old numbers and their titles</h2>
  <div class="tablewrap"><table class="logtable"><thead><tr><th>Was</th><th>Title</th><th>Where it is now</th></tr></thead><tbody>{numbers}</tbody></table></div>
</section>

<section id="sequence" aria-labelledby="sequence-h">
  <h2 id="sequence-h">Old sequencing words and the new names</h2>
  <div class="tablewrap"><table class="logtable"><thead><tr><th>Was</th><th>Now</th></tr></thead><tbody>{seq}</tbody></table></div>
</section>'''


# ---------------------------------------------------------------------------------------------------
# Checks (plan v2 section 5 and plan v1 5.2), failing loudly.
# ---------------------------------------------------------------------------------------------------
def strip_svgs(s):
    return re.sub(r'<svg\b.*?</svg>', ' ', s, flags=re.S)


def visible_text(s):
    s = re.sub(r'<style\b.*?</style>', ' ', s, flags=re.S)
    s = re.sub(r'<script\b.*?</script>', ' ', s, flags=re.S)
    s = re.sub(r'<title\b.*?</title>', ' ', s, flags=re.S)
    s = re.sub(r'<[^>]+>', ' ', s)
    return html.unescape(s)


def reader_text(s):
    """What a reader reads as prose, for the word checks: visible text without the code-file lists (engineers'
    reference, untouched by the jargon table) and without the navigation (its count of open questions)."""
    s = re.sub(r'<code\b.*?</code>', ' ', s, flags=re.S)
    s = re.sub(r'<nav class="sitenav".*?</nav>', ' ', s, flags=re.S)
    return visible_text(s)


def prose_words(s):
    s = re.sub(r'<style\b.*?</style>', ' ', s, flags=re.S)
    s = re.sub(r'<script\b.*?</script>', ' ', s, flags=re.S)
    for tag in ('svg', 'table', 'nav', 'footer', 'code', 'pre', 'title'):
        s = re.sub(rf'<{tag}\b.*?</{tag}>', ' ', s, flags=re.S)
    return len(re.findall(r"[A-Za-z0-9][\w'’.,-]*", html.unescape(re.sub(r'<[^>]+>', ' ', s))))


def index_prose_without(s):
    """The front page's prose without the moments and the words (plan v2 3.1: under about 2,500 words)."""
    for sid in ('moments', 'words'):
        s = re.sub(rf'<section id="{sid}"[\s>].*?</section>', ' ', s, flags=re.S)
    return prose_words(s)


def index_sentences_without(s):
    """The same, counting sentences only: headings, figure captions and the small labels left out."""
    for sid in ('moments', 'words'):
        s = re.sub(rf'<section id="{sid}"[\s>].*?</section>', ' ', s, flags=re.S)
    s = re.sub(r'<(h[1-4]|figcaption)\b.*?</\1>', ' ', s, flags=re.S)
    s = re.sub(r'<span class="(?:tag|here)">.*?</span>', ' ', s, flags=re.S)
    return prose_words(s)


# Visible ids no page but the change log may show (plan v2 section 5).
VISIBLE_IDS = re.compile(r'\b(?:J(?:10|[1-9])|C(?:1[0-6]|[1-9])|N1|QT\d+|EX\d+|[A-Z]{1,2}-\d{2,3})\b')
BARE_NUMBERS = re.compile(r'\b(?:phase|step|round|block|decision|question)s? \d+\b', re.I)
# Retired words: allowed on changes.html only (the brief's list, then every other term of the jargon table's
# "Term as it appears" column a pattern matches without false positives). No exceptions: the three phrases the
# first build let through ("kind of job", "a developer's job", "orchestrator" for the agent running the pass) were
# reworded at their sources on 2026-11-01.
RETIRED = [
    ('job', r'\bjobs?\b'),
    ('installer', r'\binstallers?\b'),
    ('orchestrator', r'\borchestrators?\b'),
    ('the planning half', r'\bplanning half\b'),
    ('the building half', r'\bbuilding half\b'),
    ('the map', r'\bthe map\b'),
    ('relationship map', r'\brelationship maps?\b'),
    ('hot-apply', r'\bhot-apply\b'),
    ('preview instance', r'\bpreview (?:instance|engine|profile)\b'),
    ('capability N', r'\bcapabilit(?:y|ies) \d'),
    ("the designer's week", r"\bdesigner['’]s week\b"),
    ("the developer's proof", r"\bdeveloper['’]s proofs?\b"),
    ('the cause analysis', r'\bcause analysis\b'),
    ('the standalone pass', r'\bstandalone pass\b'),
    ('parity table', r'\bparity table\b'),
    ("the program's state page", r"\bprogram['’]s state page\b"),
    ('the capability map', r'\bcapability map\b'),
    ('the engine-shape document', r'\bengine-shape document\b'),
    ('the promises document', r'\bpromises document\b'),
    ('the shared vocabulary', r'\bshared vocabulary\b'),
    ('the old container', r'\bold container\b'),
    ('start-or-adopt', r'\bstart-or-adopt\b'),
    ('interaction primitives', r'\binteraction primitives?\b'),
    ('session bundle', r'\bsession[- ]bundle\b'),
    ('two-pack proof', r'\btwo-pack proof\b'),
    ('toy pack', r'\btoy pack\b'),
    ('deploy chain', r'\bdeploy chain\b'),
    ('Deploy stage', r'\bDeploy stage\b'),
    ('auth tiers', r'\bauth tiers?\b'),
    ('activation gate', r'\bactivation gate\b'),
    ('start gate', r'\bstart gate\b'),
    ('web scanner', r'\bweb (?:player )?scanner\b'),
    ('ESP32', r'\bESP32\b'),
    ('the session validator', r'\bsession validator\b'),
    ('snapshot builder', r'\bsnapshot builders?\b'),
    ('catch-up snapshot', r'\b(?:catch-up|full) snapshots?\b'),
    ('envelope', r'\benvelopes?\b'),
    ('pack stamp', r'\bpack stamp\b'),
    ('preview engine', r'\bpreview engine\b'),
    ('supervision shapes', r'\bsupervision shapes?\b'),
    ('per-engine names', r'\bper-engine nam'),
    ('the floor', r'\bthe floor\b'),
    ('described set', r'\bdescribed set\b'),
    ('handoff', r'\bhandoff\b'),
    ('kiosk', r'\bkiosk\b'),
    ('MPD', r'\bMPD\b'),
    ('ducking', r'\bducking\b'),
    ('Step 3', r'\bstep[- ]3\b'),
]


INDEX_LIMIT = 2500


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
            if f in RETIRED_PAGES:
                fails.append(f'{FILE[k]}: link to a retired page {h}')
                continue
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
        text = reader_text(s)
        if k != 'changes':
            for m in VISIBLE_IDS.finditer(text):
                fails.append(f'{FILE[k]}: a visible id "{m.group(0)}": ...{text[max(0, m.start() - 50):m.end() + 30]!r}')
            for m in BARE_NUMBERS.finditer(text):
                fails.append(f'{FILE[k]}: a bare sequencing number "{m.group(0)}": ...{text[max(0, m.start() - 50):m.end() + 30]!r}')
            for name, pat in RETIRED:
                for m in re.finditer(pat, text, 0 if name in ('ESP32', 'MPD', 'Deploy stage') else re.I):
                    fails.append(f'{FILE[k]}: retired word "{name}": ...{text[max(0, m.start() - 50):m.end() + 30]!r}')
        if '—' in text:
            fails.append(f'{FILE[k]}: an em dash in visible text')
        scripts = re.findall(r'<script\b.*?</script>', s, flags=re.S | re.I)
        if scripts != [OPEN_SCRIPT] or 'mermaid.min.js' in s or 'class="mermaid"' in s:
            fails.append(f'{FILE[k]}: the page loads a script other than the one fold opener, or Mermaid')
        cur = re.findall(r'<a [^>]*aria-current="page"[^>]*>', s)
        if len(cur) != 1 or f'href="{FILE[k]}"' not in cur[0]:
            fails.append(f'{FILE[k]}: the navigation does not mark this page as current')
        if f'<p class="status">{e(STATUS_LINE)}</p>' not in s:
            fails.append(f'{FILE[k]}: the status line is not the plan\'s')
    # Each promise, quality target, extension case, flaw and question once as an entry on its home page; each
    # part of the earlier candidate once on Design.
    def once(page, pattern, what):
        n = len(re.findall(pattern, pages[page]))
        if n != 1:
            fails.append(f'{what} appears {n} times as an entry on {FILE[page]}')
    for jid, anc in PROMISE_ANCHOR.items():
        once('requirements', rf'<section class="job" id="{anc}"', f'promise {anc}')
    for qid in QT:
        once('requirements', rf'<article class="req" id="{qid.lower()}"', f'quality target {qid}')
    for xid in EX:
        once('requirements', rf'<article class="req" id="{xid.lower()}"', f'extension case {xid}')
    for fid in list(D['by_id']) + ['N1']:
        once('today', rf'<article class="card[^"]*" id="{fid.lower()}"', f'flaw {fid}')
    for g in D['decisions']['groups']:
        for q in g['questions']:
            once('decisions', rf'<article class="q q-[a-z]+" id="{q["anchor"]}"', f'question {q["letter"]}')
    for p in D['shape']['parts']:
        once('design', rf'<article class="part[^"]*" id="{part_anchor(p["name"])}"', f'part {p["name"]}')
    for t in D['decisions']['decided']:
        for x in t['entries']:
            once('decisions', rf'<li id="dec-{x["slug"]}"', f'decision {x["slug"]}')
    # Titles unique within each kind.
    kinds = {
        'promise': list(TITLES.values()),
        'quality target': [t['title'] for t in QT.values()],
        'extension case': [x['title'] for x in EX.values()],
        'flaw': list(FLAW_TITLES.values()),
        'question': [q['title'] for g in D['decisions']['groups'] for q in g['questions']],
        'decision': [x['title'] for t in D['decisions']['decided'] for x in t['entries']],
        'decision ahead': [a['title'] for a in D['design']['ahead']],
        'standing rule': [r['title'] for g in D['rules']['groups'] for r in g['rules']],
    }
    for kind, titles in kinds.items():
        dup = sorted({t for t in titles if titles.count(t) > 1})
        if dup:
            fails.append(f'{kind} titles repeat: {dup}')
    letters = [q['letter'] for g in D['decisions']['groups'] for q in g['questions']]
    if len(letters) != len(set(letters)):
        fails.append(f'decisions.json repeats a question letter: {letters}')
    # The plan's anchors.
    want = {
        'requirements': list(PROMISE_ANCHOR.values()) + ['promises', 'qualities', 'growth', 'rules']
        + [f'quality-{slug(t["quality"])}' for t in QT.values()],
        'design': ['ahead', 'decided', 'later', 'earlier', 'alternatives'] + ALT_ANCHORS
        + [f'd-{a["slug"]}' for a in D['design']['ahead']] + [f'decided-{x["slug"]}' for x in D['design']['decided']],
        'today': ['c%d' % i for i in range(1, 17)] + ['n1', 'works', 'situations', 'standalone', 'evidence'],
        'decisions': [q['anchor'] for g in D['decisions']['groups'] for q in g['questions']]
        + ['design-rounds', 'decided'] + [f't-{t["slug"]}' for t in D['decisions']['decided']],
    }
    for page, anchors in want.items():
        for anc in anchors:
            if anc not in ids[page]:
                fails.append(f'{FILE[page]} lacks the plan\'s anchor {anc}')
    rounds = pages['decisions'].split('id="design-rounds"')[1]
    if len(re.findall(r'class="round" href="design\.html#d-', rounds)) != len(D['decisions']['designRounds']):
        fails.append('a design round does not link to its entry on design.html')
    alt_links = len(re.findall(r'href="design\.html#alt-[a-z-]+"', rounds.split('id="decided"')[0]))
    if alt_links != 6:
        fails.append(f'the later choices on decisions.html link to {alt_links} alternatives rows, not 6')
    for x in D['design']['later']:
        if (x.get('alt') or '').strip() and x['alt'] not in ids['design']:
            fails.append(f'design.later item with alt {x["alt"]} finds no row')
    # The earlier candidate: one <details>, closed, its summary carrying the plan's label.
    if not re.search(r'<section id="earlier"[^>]*>\s*<h2[^>]*>[^<]*</h2>\s*<details class="earlier">', pages['design']):
        fails.append('design.html: the earlier candidate is not one closed <details> under its heading')
    if 'Replaced by the published protocol and the test bench' not in pages['design']:
        fails.append('design.html: Joins and proofs is not marked as replaced')
    # Every diagram placed once, as an inline SVG inside its .dia-svg box.
    for k, s in pages.items():
        boxes = re.findall(r'<div class="dia-svg" role="img" aria-label="[^"]+"><svg\b', s)
        want_n = sum(1 for key, _, _ in DIAGRAMS if key.startswith(f'd-{k}-'))
        if len(boxes) != want_n:
            fails.append(f'{FILE[k]}: {len(boxes)} diagrams placed, {want_n} expected')
    # Every colour in the stylesheet is a token.
    css = next(x for x in re.findall(r'<style>(.*?)</style>', pages['requirements'], re.S) if '--anchor-gap' in x)
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
    # The evidence totals come from the data.
    total, aside_n, total_all = D['totals']
    if (total, aside_n, total_all) != (337, 21, 358):
        fails.append(f'the evidence totals changed: {total} under the flaws, {aside_n} set aside, {total_all} in all')
    # "Under about 2,500 words" (plan v2 3.1): above 2,500 the build warns; above 2,625 (5 per cent over) it fails.
    n_index = index_sentences_without(pages['engine'])
    if n_index > INDEX_LIMIT * 1.05:
        fails.append(f'index.html prose without the moments and the words is {n_index} words, well over about {INDEX_LIMIT}')
    elif n_index > INDEX_LIMIT:
        print(f'WARNING: index.html prose without the moments and the words is {n_index} words, a little over {INDEX_LIMIT}')
    if fails:
        print('CHECKS FAILED:', file=sys.stderr)
        for f in fails:
            print('  ' + f, file=sys.stderr)
        raise SystemExit(1)
    print(f'checks passed: {n_links} links resolve; markers, ids, entries, titles, diagrams and words as the plan asks')


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
    TITLE_TO_PROMISE.update({t: j for j, t in TITLES.items()})
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
            QUESTIONS[q['letter']] = q['anchor']
            Q_TITLES[q['letter']] = q['title']
    for t in decisions['decided']:
        if t['slug'] != slug(t['topic']):
            raise SystemExit(f'decided topic slug {t["slug"]} is not the slug of "{t["topic"]}"')
        for x in t['entries']:
            if x['slug'] != slug(x['title']):
                raise SystemExit(f'decision slug {x["slug"]} is not the slug of "{x["title"]}"')
            DEC[x['slug']] = x
    qt_list = json.loads(QUALITY_TARGETS.read_text())['targets']
    ex_list = json.loads(EXTENSION_CASES.read_text())['cases']
    QT.update({t['id']: t for t in qt_list})
    EX.update({x['id']: x for x in ex_list})
    served_qt = {j: [] for j in TITLES}
    served_ex = {j: [] for j in TITLES}
    for items, served in ((qt_list, served_qt), (ex_list, served_ex)):
        for it in items:
            if not it.get('title', '').strip():
                raise SystemExit(f'{it["id"]} has no title')
            for p in it['promises']:
                if p not in TITLE_TO_PROMISE:
                    raise SystemExit(f'{it["id"]} names a promise by a title no promise has: "{p}"')
                served[TITLE_TO_PROMISE[p]].append(it['id'])
    design = json.loads(DESIGN.read_text())
    dslugs = [x['slug'] for x in design['decided']]
    design_decided = {'protocol': next(s for s in dslugs if 'protocol' in s), 'bench': next(s for s in dslugs if 'bench' in s)}
    n1_lines = [(j['id'], f['how'], f['primary']) for j in jobs for f in j['flaws'] if f['id'] == 'N1']
    return {
        'cards': cards, 'by_id': by_id, 'shape': shape, 'jobs_data': data, 'jobs': jobs, 'home': home,
        'front': json.loads(FRONT.read_text()), 'decisions': decisions, 'design': design,
        'design_decided': design_decided, 'changes': json.loads(CHANGES.read_text()),
        'rules': json.loads(RULES.read_text()), 'qt_list': qt_list, 'ex_list': ex_list,
        'served_qt': served_qt, 'served_ex': served_ex,
        'new_findings': sl['newFindings'], 'n1_lines': n1_lines,
        'n1_parts': [p['id'] for p in shape['parts'] if 'N1' in p['flaws']],
        'n1_findings': sum(1 for f in sl['newFindings'] if f['cause'].startswith('N1')),
    }


def build():
    global CUR
    D = load()
    css = stylesheet()
    open_n = sum(len(g['questions']) for g in D['decisions']['groups'])
    makers = {'engine': page_engine, 'decisions': page_decisions, 'requirements': page_requirements,
              'design': page_design, 'today': page_today, 'changes': page_changes}
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
    for f in RETIRED_PAGES:
        if (SITE / f).exists():
            (SITE / f).unlink()
            print(f'deleted {f} (version 8)')
    print(f'{"page":<20}{"bytes":>10}{"prose words":>14}')
    for k, f, _ in PAGES:
        print(f'{f:<20}{len(pages[k].encode()):>10}{prose_words(pages[k]):>14}')
    print(f'index.html without the moments and the words: {index_prose_without(pages["engine"])} words in all, '
          f'{index_sentences_without(pages["engine"])} in sentences (headings, captions and labels left out)')


if __name__ == '__main__':
    build()
