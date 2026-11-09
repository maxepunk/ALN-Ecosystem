export const meta = {
  name: 'site-v10-fable-review',
  description: 'At the owner\'s request, Fable 5.2 agents review version 10 of the owner site: is the design approach optimal, and is what the owner is asked clearly defined? Four reviewers, a refute-by-default check of each, one merged report',
  phases: [
    { title: 'Probe', detail: 'confirm the requested model answers' },
    { title: 'Review', detail: 'four lenses: the conflicts (A to F); the other asks and the page; the design approach; an outside architect' },
    { title: 'Verify', detail: 'one refute-by-default check per review' },
    { title: 'Synthesize', detail: 'one merged report for the agent running the pass' },
  ],
}

// args: { model: 'claude-fable-5-2', fallback: 'fable', date: '2026-11-09', base: '<commit the review reads>', text: '<folder of the pages as text>' }
const A = args || {}
const DATE = A.date || '2026-11-09'
const ROOT = '/home/user/ALN-Ecosystem'
const AP = `${ROOT}/docs/plans/architecture-pass`
const OUT = `${AP}/report/site/checks`
const TEXT = A.text

let MODEL = A.model || 'claude-fable-5-2'
phase('Probe')
let probe = null
try {
  probe = await agent('Reply with exactly the word: ok', { label: `probe:${MODEL}`, phase: 'Probe', model: MODEL, effort: 'low' })
} catch (e) {
  probe = null
}
if (!probe || !String(probe).toLowerCase().includes('ok')) {
  log(`The model ${MODEL} did not answer; the review falls back to ${A.fallback || 'fable'}.`)
  MODEL = A.fallback || 'fable'
}
log(`Every reviewer, checker and the merge run on ${MODEL}.`)

const COMMON = `
You are reviewing version 10 of "What the Engine Promises", the owner's site for the architecture pass of the ALN engine (published at commit ${A.base}). Today is ${DATE}.

The engine runs "About Last Night", a two-hour immersive game: a server on a Raspberry Pi 5 (the show machine) runs the game, video, sound, music and lighting; game masters (GMs) work from tablets (a web app); players scan memory tokens with phones (a web page) or small hardware scanners (ESP32); a TV shows the scoreboard. The architecture pass designs the engine's next iteration under the owner's goal, in their words: "design a long-term optimal architecture for our engine that makes it intuitive and easy to maintain, continue development on, and extend (proactive)". The engine is to serve many games in many productions and may be open-sourced; ALN is its first production. The pass is in its design half: the requirements now; then an independent panel of architects; then six design rounds, hardest-to-reverse decisions first; a build plan; a hostile review; final questions; the owner's sign-off. Then the build half.

Version 10 reworked the Decisions page after the owner asked whether all of version 9's eighteen questions were really theirs to decide. The owner's words, and their seven comments that day, are in ${AP}/rework/2026-11-02-owner-comments.md: read it first. The page now asks only what the owner alone can decide (ten questions, A to J, in four groups), lists three readings of the owner's words for them to confirm, fourteen calls the agent running the pass made (each with its reason, for the owner to overrule), and the requirements for the owner to review. The owner has not answered yet. Before answering, they asked for this review, in their words: "to make sure the design is optimal and what you need input from me about is clearly defined before I give my input". You are one of four independent reviewers, each with one lens. The agent running the pass wrote these pages and their earlier checks; do not take its framing as given.

Where things are:
- The six pages as text, exactly as published (links as [text](href), element ids as {#id}): ${TEXT}/index.md (the front page, "The engine"), decisions.md, requirements.md, design.md, today.md ("Today's engine"), changes.md (the change log). The built pages are ${AP}/report/site/*.html.
- Their sources: ${AP}/report/site/v9/decisions.json, design.json, front.json, changes.json (the page overlays); ${AP}/requirements/2026-11-01-quality-targets.json and 2026-11-01-extension-cases.json; the promise data ${AP}/report/2026-10-31-engine-jobs.json; the design-flaw cards ${AP}/report/2026-10-31-cause-cards.json; the builder ${AP}/report/build_site.py.
- The decision record ${AP}/DECISIONS.md; the panel's brief ${AP}/panel/2026-11-01-panel-brief.md; the program document ${ROOT}/docs/plans/2026-10-30-architecture-pass.md; the roadmap ${ROOT}/docs/plans/ROADMAP.md; the domain words ${ROOT}/CONTEXT.md; the review of today's engine ${AP}/2026-10-30-cause-analysis.md; the earlier candidate shape ${AP}/2026-11-01-engine-shape.md.
- Today's code: ${ROOT}/backend/, ${ROOT}/ALNScanner/ (GM app), ${ROOT}/aln-memory-scanner/ (phone scanner), ${ROOT}/arduino-cyd-player-scanner/ (hardware scanner), ${ROOT}/ALN-TokenData/ (the game pack). Each has a CLAUDE.md that maps it.

Rules: read only, and write only the one report file named below. Never open ${ROOT}/backend/.env (it holds a live access token). Never read /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner (stale copies); read only under ${ROOT} and ${TEXT}. Run no git command that changes anything.

The owner's rules for what they read, which any text you propose for the site must follow: plain, short, active sentences; no metaphors; no em dashes; no internal codes or code names; explain by how the system behaves at a show; the site says "you" to the owner; a title dropped into a sentence takes typographic quotes. The owner also asks that the agent investigate and cite before asking, and that anything new comes back to them as a question first.

What makes a question the owner's (the page's own four tests): only the owner can answer it, because it is about what the product must do or allow, for whom, or which of two goods matters more, never about how to build it; the decision record does not already answer it; at least one of the six decisions ahead depends on it; and it is needed before the panel's blind round. Choices the agent can make are its calls, listed with reasons for the owner to overrule: how the requirements are worded and grouped, how the panel runs, technical defaults, and readings that follow from the owner's earlier decisions. A reading of the owner's words that is not settled by an earlier decision is put to the owner to confirm.

Write your report as markdown, written ${DATE}, for the agent running the pass (so it may call the owner "the owner"): a one-paragraph scope; your verdict in three to six sentences; then your findings, each with an id, a severity (high: it would lead the owner to a wrong or uninformed answer, or lead the design astray; medium: it makes an answer harder or the design weaker; low: polish), where it is (page, section and the exact words), what is wrong, why (with evidence: a file and line, the code, or the owner's words), and the exact change you propose (replacement text and the source field it goes in; for a design finding, what to change in the approach). Then a short "What is right". Prefer findings that change what the owner decides or what the design does over wording polish, and say so when a part is fine. Return a brief summary.`

const LENSES = [
  {
    key: 'asks-1',
    title: 'the conflicts between the qualities (questions A to F)',
    task: `Your lens: the first group on Decisions, "Where the qualities pull against each other": its introduction and its six questions, A to F. The owner said of the conflicts: "I would need to understand the specific conflicts and what they mean functionally in order to be able to answer optimally"; and of release day: "I'd like to understand more specifically what this question means in practice and how it impacts the actual design and build, especially long-term after initial development of the new engine is completed and in use for ALN". For the introduction: are the conflicts it calls already answered really answered, and answered well; is any real conflict between the twelve qualities missing from both the introduction and the questions? For each of A to F: is it really the owner's by the four tests; can the owner answer it in one sitting from what the page says (what it decides; what each option means at a show, for the GM at a failure, for the designer and for another production; what each costs, now and in the long term); are the options complete and distinct, with no sub-question hidden inside; is the recommendation sound and argued, or is the "What we need from you" line exactly answerable; are the facts it states about today's engine true in the code; does it meet the owner's comments above and the owner's decision "No technical failure stops a game"? Done when the introduction's every conflict and every question A to F has a verdict.`,
  },
  {
    key: 'asks-2',
    title: 'the other asks (questions G to J, the readings, the calls, the reviews) and the Decisions page as a whole',
    task: `Your lens: questions G to J on Decisions; the three readings of the owner's words to confirm; the fourteen agent's calls; the requirements offered for review; and the Decisions page as a whole as the owner meets it. For each of G to J: is it really the owner's by the four tests; is it clearly defined (what it decides, what each option means at a show and costs); are the options complete and distinct; is the recommendation sound, or the "What we need from you" line exactly answerable; are its facts true in the code; does it meet the owner's comments 4 to 7 (standalone games as a capability of the engine; hardware fixed only as far as ALN's kit, with the architecture flexible within the roadmap's bounds; the two kinds of game extension; the engine saying what is fixed and what each production sets)? For each reading: is it a fair reading of the owner's words, stated clearly, and really a reading rather than a question in disguise or something already decided? For each call: is it really the agent's to make, or a choice only the owner can make (say which test it meets); is its reason sound and its content right? For the reviews: is it clear what the owner is asked to do, and what happens if they flag nothing? For the page as a whole: can the owner tell exactly what to answer and how; is anything the owner must decide before the panel missing from the page; is any ask duplicated or split across places; could the owner work through it in one or two sittings, and if not, what would make that possible? Done when every question G to J, every reading, every call and every review item has a verdict.`,
  },
  {
    key: 'design',
    title: 'the design approach, against the program\'s own documents',
    task: `Your lens: whether the design approach on version 10 is the one most likely to give the owner a long-term optimal architecture. Read the front page, Design and Requirements, then the decision record, the panel brief, the program document and the roadmap as you need them. Judge the six decisions ahead: are they the right top-level decisions for this engine, in the right order (hardest to reverse first), and is anything missing that the design must settle before building (for example how the game's data is stored, versioned and migrated; who may do what, and how devices prove who they are; how the engine is observed and operated at a show; how the engine, packs and devices are versioned and upgraded; how an extension is kept from harming the show; how the design is tested)? Judge the decided directions and the standing rules (sound, consistent with the owner's decisions, or closing long-term options too early?); the requirements (complete for the owner's goal and decisions, testable, consistent with each other, each number sorted right); the panel's set-up (its three lenses, what it gets and what is withheld, and when it runs) as a way to get the best top-level options; and the later choices (any that should be settled earlier, or that are really the owner's). Find contradictions between pages, between the pages and the record, and between the requirements and the decisions. Done when each of the six decisions ahead, the panel's set-up, each standing rule and each of the twelve qualities has a verdict.`,
  },
  {
    key: 'outside',
    title: 'an outside architect\'s blind-spot read',
    task: `Your lens: an independent principal architect who has built live-show and event systems, real-time sync across many devices, offline-first web apps and small hardware clients. Read the front page, Decisions and Design (and Requirements as you need it) without taking the agent's framing as given, and read enough of today's code to know what the engine is. Ask: for an engine meant to run many games in many productions, open-sourced, flexible about hardware, where no technical failure stops a game, and with standalone games as a capability, which top-level decisions, requirements or owner questions would you expect to see that are missing; what is asked of the owner that an architect should settle, or settled by the agent that the owner should own; which recommendations you would reverse, and why; where the approach risks a design that is today's engine tidied up rather than the long-term optimal one; and what would most improve the chance that the design rounds land well. Prefer a few well-argued findings to many. Before you raise one, check the documents so you do not raise what the pages already cover (if they do, say where). Done when you have read every decision ahead and every owner question and said for each whether you would change it.`,
  },
]

const REVIEW_SUMMARY = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    findings: { type: 'integer' },
    high: { type: 'integer' },
    verdict: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'findings', 'high', 'verdict', 'keyPoints'],
}
const VERIFY_SUMMARY = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    confirmed: { type: 'integer' },
    changed: { type: 'integer' },
    refuted: { type: 'integer' },
    missed: { type: 'integer' },
    keyPoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'confirmed', 'changed', 'refuted', 'missed', 'keyPoints'],
}

const results = await pipeline(
  LENSES,
  (lens) => agent(`${COMMON}\n\n${lens.task}\n\nWrite your report to ${OUT}/v10-fable-${lens.key}.md.`,
    { label: `review:${lens.key}`, phase: 'Review', model: MODEL, effort: 'high', schema: REVIEW_SUMMARY }),
  (review, lens) => {
    if (!review) return null
    return agent(`${COMMON}\n\nYour task is different from the reviewers': you check one review. The reviewer of ${lens.title} wrote ${OUT}/v10-fable-${lens.key}.md. Refute by default: a finding survives only if you confirm it yourself from the pages, the sources, the record, the owner's words and the code. Give each finding one verdict: Confirmed (the problem is real and the proposed change is right), Confirmed with a better change (the problem is real; give the change), or Refuted (not a problem; already covered, saying where; or the change would make things worse, saying how). Check every stated fact against the code or the documents; check every proposed text against the owner's rules; refuse any change that turns an agent's call into an owner question, or the reverse, without meeting the four tests. Then list anything the reviewer missed that you saw while checking, marked as yours. Write ${OUT}/v10-fable-${lens.key}-verify.md: a table of every finding (id, verdict, the final change, the evidence), then the missed items. Return a brief summary.`,
      { label: `verify:${lens.key}`, phase: 'Verify', model: MODEL, effort: 'high', schema: VERIFY_SUMMARY })
  },
)

const done = LENSES.map((l, i) => ({ key: l.key, title: l.title, verified: Boolean(results[i]) }))
const missing = done.filter((d) => !d.verified)
if (missing.length) log(`Not verified: ${missing.map((m) => m.key).join(', ')}; the merge reads their reviews unverified and says so.`)

phase('Synthesize')
const files = LENSES.map((l) => `- ${l.title}: ${OUT}/v10-fable-${l.key}.md and its check ${OUT}/v10-fable-${l.key}-verify.md`).join('\n')
const synthesis = await agent(`${COMMON}\n\nYour task: merge the review into one report for the agent running the pass, to act on and to report to the owner. Read the four reviews and their checks:\n${files}\n${missing.length ? `These have no check, so mark their findings unverified: ${missing.map((m) => m.key).join(', ')}.\n` : ''}Keep only findings a check confirmed, each with its final change; where two reviews found the same thing, merge them and cite both. Read the pages yourself where findings conflict, and decide. Write ${OUT}/v10-fable-review.md with:\n1. The verdict, in two short plain paragraphs: is the design approach on version 10 the one most likely to give the owner a long-term optimal architecture, and is what the owner is asked clearly defined?\n2. Changes to make before the owner answers, ranked by severity within each group: (a) owner questions to reword, split, merge, add or remove, each with the exact new text and the source field; (b) readings and agent's calls to change, including any that should become an owner question, with the test it meets; (c) facts to correct; (d) changes to the design approach (the decisions ahead, the panel's set-up, the requirements, the standing rules), each with what to change and why; (e) smaller clarity fixes.\n3. What the owner should hear even after the fixes: any risk or open point, in plain words, short.\n4. What the review found right.\nCite the finding ids behind every item. Return a brief summary.`,
  { label: 'synthesize', phase: 'Synthesize', model: MODEL, effort: 'high', schema: {
    type: 'object',
    properties: {
      file: { type: 'string' },
      designVerdict: { type: 'string' },
      clarityVerdict: { type: 'string' },
      changes: { type: 'integer' },
      newOwnerQuestions: { type: 'integer' },
      keyPoints: { type: 'array', items: { type: 'string' } },
    },
    required: ['file', 'designVerdict', 'clarityVerdict', 'changes', 'newOwnerQuestions', 'keyPoints'],
  } })

return { model: MODEL, done, synthesis }
