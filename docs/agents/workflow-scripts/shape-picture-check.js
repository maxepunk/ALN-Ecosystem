export const meta = {
  name: 'shape-picture-check',
  description: 'Check the owner page\'s new whole-engine picture and five walkthroughs against the candidate shape, refute by default',
  phases: [{ title: 'Check', detail: 'one reader for the picture, one for the walkthroughs' }],
}
const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const RP = AP + '/report'
const CONS = AP + '/consistency'
const COMMON = `Context. The ALN show engine is in its architecture pass, phase 1, step 1. The owner reads one page, ${RP}/2026-10-31-cause-report.html, built by ${RP}/build_report.py. The owner said the 17-part candidate shape was never diagrammed and the page did not show how everything comes together, so the section "How the promises fit together" now opens its candidate shape with a hand-drawn SVG of the whole engine (the function shape_svg() in the builder; it is in the page as <svg class="shape-svg">) and five Mermaid sequence walkthroughs (the WALKS list in the builder). The candidate shape they must follow is ${AP}/2026-11-01-engine-shape.md: read sections 4.1 (each part's interface and what it removes), 4.2 (one direction of dependency; the composition root; Delivery reads its authorities' change feeds and no authority calls it; the Verdict calls nothing and the lifecycle hands it the profile and the live picture), 4.3 (which parts run where) and the last section, "Corrections from the check". The page's words are the owner's decision 27 (${ROOT}/CONTEXT.md section 7): promises, parts that keep them, design flaws that break them, qualities, the venue technician; promises by exact title.

Where you work: only under /home/user/ALN-Ecosystem/, branch claude/nice-curie-hescfv; read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Write only your report file.

Refute by default: a drawn fact you cannot confirm in the shape is a conflict. For each conflict give where (the element, arrow or message), what it shows, what it should show and why (cite the shape's section), and the change in the builder. Plain words and short labels are part of the rules (docs/agents/process.md sections 4 and 5).`
const TASKS = [
  { key: 'picture', task: `Your part: the whole-engine picture. Check that every one of the 17 parts appears once with its plain name; that each box's short description matches the part's interface in 4.1; that every arrow is a real flow in the shape (who sends what to whom at a show), points the right way, and carries a label that says what passes; that the picture says nothing the shape contradicts (for example a part deciding a fact the shape gives to another, or an arrow implying a lower part calls a higher one where the shape forbids it); that the rows and groupings do not imply a layering the shape denies; that what runs on the devices and tools matches 4.3; and that the caption and figure key say only what the picture and the shape support. Also list anything important the picture leaves out that a reader would need to see how the engine comes together, as a suggestion, not a conflict.` },
  { key: 'walks', task: `Your part: the five walkthroughs (a GM taps a token; a cue plays, or cannot; the GM ends the game; doors open: the preflight; the designer publishes a change). For each: every participant is a part (or a person, device or outside program, named plainly); every message is a real step in the shape, in the right order and direction (a request is a solid arrow from the part that calls; an answer is dashed; Delivery always asks what changed, nothing pushes to it; the Verdict calls nothing; the lifecycle is the only part that moves the game and resets parts; the pack is taken up only at a moment the lifecycle allows); the moment's outcome matches what the promises say; and the promises each walkthrough says it keeps are ones it really shows being kept. Also check the sentence above the walkthroughs ("Solid arrows are requests; dashed arrows are answers. Delivery always asks what changed; nothing pushes facts to it.").` },
]
const SCHEMA = { type: 'object', properties: { file: { type: 'string' }, conflicts: { type: 'integer' }, checked: { type: 'integer' }, suggestions: { type: 'array', items: { type: 'string' } }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'conflicts', 'checked', 'suggestions', 'keyPoints'] }
phase('Check')
const results = await parallel(TASKS.map(t => () => agent(`${COMMON}

${t.task}

Write ${CONS}/2026-11-01-shape-picture-check-${t.key}.md: a short header, a conflicts table (where, shows, should show and why, builder change), a list of suggestions, and what you checked and found right. Return the file, the number of conflicts, how many items you checked, the suggestions, and five key points.

Done when: every element of your part has a verdict against the shape, and the counts match your table.`, { label: 'check:' + t.key, phase: 'Check', model: 'opus', effort: 'high', schema: SCHEMA })))
return results.filter(Boolean)