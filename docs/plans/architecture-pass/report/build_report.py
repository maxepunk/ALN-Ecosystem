"""Build the owner-facing cause report from the checked cards.

Input:  2026-10-31-cause-cards.json (one card per cause, written by the
        cause-report-cards workflow and checked against the analysis).
Output: 2026-10-31-cause-report.html, published as an Artifact page.

Run: python3 -I build_report.py   (from any directory)
"""
import html
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
CARDS = HERE / '2026-10-31-cause-cards.json'
OUT = HERE / '2026-10-31-cause-report.html'

FAMILIES = [
    ('screens', 'Screens keep their own versions of the game', ['C1', 'C6', 'C7', 'C9', 'C10'],
     'The engine decides the game: who claimed which token, each team\'s score, whether a game is '
     'running. Every screen also keeps its own version of those facts and updates it by its own rules. '
     'These five causes are how the screens\' versions drift from the engine\'s. Your decision 11 already '
     'puts the questions that cover them (1, 6, 8 and 9) into one rule for live state.'),
    ('services', 'The engine\'s picture of the programs it drives', ['C2', 'C3'],
     'The engine drives VLC, MPD music, the audio system and Home Assistant lights, and shows their '
     'state on the GM panel. These two causes are how that picture goes stale or wrong.'),
    ('moments', 'Moments when everything changes at once', ['C4', 'C5', 'C12'],
     'A game starting or ending, Reset System, the engine restarting and a new pack being published '
     'each change many facts at once. Nothing in the engine says what each fact should do at those '
     'moments, so each one handles whatever its author remembered.'),
    ('machine', 'The show machine is shared', ['C8'],
     'The live engine, the tests, and later the preview engine all use the same machine: the same '
     'process files, the same TV, the same audio.'),
    ('answers', 'One question, several answers', ['C11'],
     'Inside one part of the engine, the same question is answered in several places, each by its '
     'own rule, so the answers can disagree.'),
    ('audience', 'Who is connected, and what each one receives', ['C13'],
     'The engine sends everything to every connection and asks few of them who they are.'),
    ('checks', 'Checks that do not exist (no question covers these)', ['C14', 'C15', 'C16'],
     'Each of these three is a missing check: that two parts agree on the names and shapes they share, '
     'that the deployed pieces match, that a passing test proves the real path. None of the nine '
     'questions covers them. Question 18 asks whether the pass should take them on.'),
]

# Where a cause lives: a card's module paths, sorted into the parts of the engine.
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


def chips(card):
    out = [f'<span class="chip">{card["findings"]} findings</span>']
    q = card.get('questions') or []
    out.append(f'<span class="chip">{"Questions " + ", ".join(map(str, q)) if q else "No question covers it"}</span>')
    if card.get('blueFixes'):
        out.append(f'<span class="chip">Blue fixed: {e(", ".join(card["blueFixes"]))}</span>')
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
    <summary>The findings behind it, and the code they live in</summary>
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
    return f'<div class="tablewrap"><table class="grid"><thead><tr><th scope="col">Cause</th>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>'


SET_ASIDE = [
    ('Already fixed in this tree', 7, 'Report cells escaped; the health word "dormant" in both contracts and on the tablet; the harness-minimum review items; a routing snapshot guard; the environment template\'s bus variables (green\'s follow-ups).'),
    ('Plain fixes for phase 2', 5, 'A name like "constructor" read as a real key in plain-object lookups; the web scanner loading its QR library from the internet; a test helper that switches certificate checks off; standalone mode\'s red "Disconnected" pill.'),
    ('Code-structure notes, no game symptom', 2, 'A second wrapper for running programs in the kiosk driver; the sound panel written inline instead of by its own renderer.'),
    ('No fault', 2, 'Two equal snapshots sent on connect; planned config-tool functions not built yet.'),
    ('A question for you', 1, 'A rejected or duplicate GM scan is recorded nowhere. This became question 19.'),
    ('Documents', 4, 'Plans, briefs and two CLAUDE.md files that disagree with the code. Decision 20: documents are fixed as we go.'),
]


def build():
    cards = json.loads(CARDS.read_text())['cards']
    by_id = {c['id']: c for c in cards}
    assert len(by_id) == 16, f'expected 16 cards, got {len(by_id)}'
    total = sum(c['findings'] for c in cards)
    toc = ''.join(f'<li><a href="#{fid}">{e(title)}</a> <span class="muted">{" ".join(ids)}</span></li>' for fid, title, ids, _ in FAMILIES)
    fams = []
    for fid, title, ids, intro in FAMILIES:
        fams.append(f'<section class="family" id="{fid}"><h2>{e(title)}</h2><p class="intro">{e(intro)}</p>'
                    + ''.join(card_html(by_id[i]) for i in ids) + '</section>')
    aside = ''.join(f'<tr><th scope="row">{e(k)}</th><td class="num">{n}</td><td>{e(t)}</td></tr>' for k, n, t in SET_ASIDE)
    aside_n = sum(n for _, n, _ in SET_ASIDE)
    page = TEMPLATE.format(
        total=total, total_all=total + aside_n, aside_n=aside_n, toc=toc, grid=grid_html(sorted(cards, key=lambda c: int(c['id'][1:]))),
        families=''.join(fams), aside=aside)
    OUT.write_text(page)
    print(f'wrote {OUT} ({len(page)} bytes, {len(cards)} cards, {total} findings in causes)')


TEMPLATE = '''<title>ALN Cause Analysis</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans+Condensed:wght@500;600&display=swap">
<style>
/* Layout: one reading column; each card pairs a "today" diagram with a candidate one, side by side when wide, stacked when narrow. */
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
@media (prefers-reduced-motion: reduce) {{ * {{ scroll-behavior: auto; }} }}
</style>

<div class="wrap">
<header class="top">
  <p class="eyebrow">Architecture pass · phase 1, step 1 · checked draft, 2026-10-31</p>
  <h1>Sixteen causes behind the engine's faults</h1>
  <p class="lead">Every fix blue made in September, every finding blue left open, and every fault the engine maps turned up: {total_all} findings in all. {total} of them group under sixteen design choices that let them happen, and the other {aside_n} need no rule. Fix a cause and you fix its whole family, including the faults nobody has hit yet.</p>
</header>

<section class="decide" aria-labelledby="deciding">
  <h2 id="deciding">What you are deciding</h2>
  <p><strong>Question 17.</strong> Is this the right list? Look for a fault you have seen at a show that no card explains, or two cards that are really one problem.</p>
  <p><strong>Question 18.</strong> The last three causes, C14 to C16, fall outside the pass's nine questions. Should the pass take them on? The options are <a href="#your-questions">at the end</a>.</p>
</section>

<section class="howto" aria-label="How to read a card">
  <div>
    <h2>How to read a card</h2>
    <p><span class="tag">At a show</span> is a moment a GM or a player would see. <span class="tag">Why it happens</span> is the design reason behind it.</p>
    <p>Two diagrams sit side by side. <strong>Today</strong> shows how the fault happens now. <strong>Candidate, not decided</strong> shows one way the design could remove it. Nothing on the right is decided: step 3 puts competing designs in front of you.</p>
    <div class="legend"><span><span class="sw"></span>where it goes wrong</span><span><span class="sw owner"></span>the one place that would own the fact</span></div>
  </div>
  <div>
    <h2>The design words</h2>
    <p>Each card ends with the reason restated in the vocabulary step 3 uses.</p>
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

<section aria-labelledby="where">
  <h2 id="where">Where each cause lives</h2>
  <p class="intro" style="margin:8px 0 14px">A dot means the cause's findings sit in that part of the engine. Rows are in order of how much each cause affects a show night, most first.</p>
  {grid}
</section>

<section aria-labelledby="families">
  <h2 id="families">Seven families</h2>
  <ol class="toc" style="margin-top:10px">{toc}</ol>
</section>

{families}

<section aria-labelledby="aside">
  <h2 id="aside">Set aside, {aside_n} findings</h2>
  <p class="intro" style="margin:8px 0 14px">These need no rule. Each still has a home.</p>
  <div class="tablewrap"><table class="aside"><tbody>{aside}</tbody></table></div>
</section>

<section class="questions" id="your-questions" aria-labelledby="qhead">
  <h2 id="qhead">Your questions</h2>
  <div class="q">
    <h3>17. Is this the right list?</h3>
    <p>Two things would change it: a fault you have seen at a show that no card explains, or two cards that are really the same problem. If you see neither, the list stands and step 2 can start.</p>
  </div>
  <div class="q">
    <h3>18. Should the pass take on C14, C15 and C16?</h3>
    <ol type="a">
      <li>Add three questions, 10 to 12, so each of these causes gets a rule and a proof test like the other nine.</li>
      <li>Add C14 and C16 as questions. C15 goes to the pre-show check that phase 2 rebuilds anyway, which would check the deployed pieces before a show.</li>
      <li>Keep nine questions. All three become working method for phase 2 instead of rules.</li>
    </ol>
    <p class="rec">Recommendation: a. The pass ends when every rule's test passes on the rig, and C16 is the risk that those tests pass without proving the real path, so it needs a rule of its own. C15 is the one that bites on a show night: a rollback that quietly keeps serving the new scanner build.</p>
  </div>
  <p class="muted">Questions 19 and 21 are in the chat. Question 20 is decided: no rule for documents, and documents are fixed as we go.</p>
</section>

<footer>
  <p>Built from <code>docs/plans/architecture-pass/2026-10-30-cause-analysis.md</code>, its four reader sheets and its two check files. The check held 632 claims, corrected 78, struck 34 and found 7 new faults. The cards were drawn from that analysis on 2026-10-31 and checked against the code.</p>
</footer>
</div>
'''

if __name__ == '__main__':
    import sys
    if len(sys.argv) == 3:  # draft preview: build_report.py <cards.json> <out.html>
        CARDS, OUT = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    build()
