export const meta = {
  name: 'picture-fix-verify',
  description: 'Verify the 19 picture and walkthrough fixes on the rebuilt owner page against the shape; refute by default',
  phases: [{ title: 'Verify', detail: 'one reader over the 19 rows and the changed drawing' }],
}
const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const CONS = AP + '/consistency'
const RP = AP + '/report'
phase('Verify')
const r = await agent(`Context. The owner's page ${RP}/2026-10-31-cause-report.html (built by ${RP}/build_report.py; the whole-engine picture is shape_svg(), the walkthroughs are WALKS) was checked against the candidate shape ${AP}/2026-11-01-engine-shape.md (sections 4.1, 4.2, 4.3 and the last section, "Corrections from the check"). Two checks found 11 and 8 conflicts: ${CONS}/2026-11-01-shape-picture-check-picture.md and ${CONS}/2026-11-01-shape-picture-check-walks.md. The fixes are in git -C ${ROOT} diff 857a6894 HEAD -- docs/plans/architecture-pass/report/build_report.py.

Where you work: only under /home/user/ALN-Ecosystem/, branch claude/nice-curie-hescfv; read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Write only the file named below.

Your job, refute by default: (1) for each of the 19 rows, read the builder's drawing commands and the walkthrough sources and give a verdict (resolved, partly, not resolved) quoting the new code or text; (2) read every changed arrow, label, box and message against the shape and the rest of the page, and list any new conflict (a flow the shape does not have, a direction the shape forbids, a label that says something untrue, a key or caption sentence the picture does not support, plain-words problems under docs/agents/process.md sections 4 and 5). You may render the page to check the drawing: node /tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad/shot_at.js ${RP}/2026-10-31-cause-report.html 'figure.dia.whole' /tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad/verify-whole.png 1200, then read the image.
Write ${CONS}/2026-11-01-picture-fix-verify.md: a header, a table of the 19 rows with verdicts, a table of new conflicts (where, what it shows, what it should show, the builder change), and a one-line summary. Done when all 19 rows have a verdict and every changed element has been read. Return the file, the counts and the new conflicts in one line each.`, { label: 'verify', phase: 'Verify', model: 'opus', effort: 'high', schema: { type: 'object', properties: { file: { type: 'string' }, resolved: { type: 'integer' }, partly: { type: 'integer' }, notResolved: { type: 'integer' }, newConflicts: { type: 'array', items: { type: 'string' } } }, required: ['file', 'resolved', 'partly', 'notResolved', 'newConflicts'] } })
return r