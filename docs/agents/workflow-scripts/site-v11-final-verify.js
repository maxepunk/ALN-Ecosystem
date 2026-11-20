export const meta = {
  name: 'site-v11-final-verify',
  description: 'One refute-by-default reader confirms the lead agent\'s second hand fixes to version 11 and reads only the lines they changed',
  phases: [
    { title: 'Verify', detail: 'the second hand fixes' },
  ],
}

// args: { base: the commit before the second hand fixes, text: the folder of the pages as text, model: optional model }
const A = args || {}
const BASE = A.base || '7ea951dd'
const TEXT = A.text
const MODEL = A.model
const ROOT = '/home/user/ALN-Ecosystem'
const AP = `${ROOT}/docs/plans/architecture-pass`
const OUT = `${AP}/report/site/checks`

const PROMPT = `
You are checking the owner site "What the Engine Promises" (the architecture pass of the ALN engine) one last time before version 11 is published. Version 11 applies an independent review of version 10 that the owner asked for. After the version 11 workflow, the agent running the pass made hand fixes, two readers checked them, and the agent made a second, smaller round of fixes from their reports. Your job is that second round only. Refute by default: a fix counts as resolved only when you have read it where it lands and found nothing wrong. Read only; write nothing but your report.

What the second round was meant to fix: the "New conflicts" tables of ${AP}/report/site/checks/v11-hand-verify-pages.md (four rows) and ${AP}/report/site/checks/v11-hand-verify-record.md (twelve rows), and, from the record report's section "Stale against the site", the bullet "The brief's agenda says less than Design's" and the bullet on the change log's sentence on the brief. Where the two reports proposed different words for the same place (the tablet's tangle: "a second judge of the game" or "a second body of rules"), the agent chose one; say whether the choice reads right.

The second round's changes are the git diff from ${BASE} to HEAD: run \`git -C ${ROOT} diff ${BASE} HEAD -- docs/plans/architecture-pass ':!*.html' ':!*/checks/*'\`. The built pages are current (rebuilt after the fixes; the build's checks passed with 1,778 links resolving, and the smoke test passed). The pages as text are in ${TEXT}; use them to search and the .html under ${AP}/report/site/ to confirm.

For each row: read the changed words where they land (on the page, for data the builder shows; in the file, for the record, the brief and the twins), give a verdict, and check the sentence around it still reads whole. Then:
1. The brief (${AP}/panel/2026-11-01-panel-brief.md): unwrap each changed paragraph and confirm only the intended words differ; no line over 72 characters; typographic quotes around titles; the new sub-bullet under the agenda agrees with Design's first decision (${AP}/report/site/v9/design.json, ahead[0].decides).
2. The sentence "Each promise also names which of the nine questions the pass answers it bears on. That line waits with the test situations." now stands in the brief, on Design and in the record. Check it is true against what Requirements shows under each promise (${AP}/report/build_site.py, the function that draws a promise, and the field "questions" in ${AP}/report/2026-10-31-engine-jobs.json), and that the three places say the same.
3. Design's two new phrases "as “The blind round” lists it": the section they point to must exist on Design under that exact title and must list what is withheld.
4. The record (${AP}/DECISIONS.md): the new dated line under "One published protocol and an outside test bench" (true, wrapped at 72, straight quotes); the line on what the blind folder holds (its pronoun now names its subject; it says the same as the brief and Design).
5. The two markdown twins' notes: true, and the note of 2026-11-10 in 2026-11-01-engine-shape.md now names every old wording its body keeps (search the twin's body for "engine absent", "no engine", "tablet-local engine", "second engine", "own engine", "engine equipment").
6. The earlier candidate on Design: no "engine of its own", "engine of the tablet's own" or "second engine" left for a tablet; the quality "Generic" reads as two sentences with the bound on the kit, the pack and the production only.
7. Decisions, question A: the new reason for not putting the refusal forward is true and does not also describe the answer the agent leans to.

The site's standing rules: plain, short, active sentences; no figures of speech; no em dashes; no internal codes or code names; no model name, model id or vendor name; on the site a title in a sentence takes typographic quotes and is exact, while the record uses straight quotes; the overlays say "you", the shared data says "the owner"; the owner's words are quoted exactly. Do not read the top-level clones /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner, and never open ${ROOT}/backend/.env.

Write your report to ${OUT}/v11-final-verify.md: a one-paragraph scope; a verdict table (row, Resolved / Partly / Unresolved, where it lands now with the words); a table of every slip the second round made (place, exact words, why, exact replacement, exact place to change); and a short "what I found right" list. Then return a brief summary.`

const SUMMARY = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    resolved: { type: 'integer' },
    partly: { type: 'integer' },
    unresolved: { type: 'integer' },
    slips: { type: 'integer' },
    keyPoints: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'resolved', 'partly', 'unresolved', 'slips', 'keyPoints'],
}

phase('Verify')
const result = await agent(PROMPT, { label: 'verify:second-fixes', phase: 'Verify', schema: SUMMARY, effort: 'high', ...(MODEL ? { model: MODEL } : {}) })
return result
