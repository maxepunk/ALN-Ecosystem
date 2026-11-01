export const meta = {
  name: 'page-fix-verify',
  description: 'Verify that every conflict the two page checks found is resolved on the rebuilt owner page, and that the fixes introduced no new conflict; refute by default',
  phases: [{ title: 'Verify', detail: 'one refute-by-default reader over the 57 rows and the changed text' }],
}
const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const CONS = AP + '/consistency'
const RP = AP + '/report'
phase('Verify')
const r = await agent(`Context. The ALN show engine is in its architecture pass, phase 1, step 1. The owner reads one page, ${RP}/2026-10-31-cause-report.html, built by ${RP}/build_report.py from ${RP}/2026-10-31-cause-cards.json, ${RP}/2026-10-31-engine-jobs.json, ${RP}/2026-10-31-standalone-lines.json and ${RP}/2026-11-01-engine-shape.json. Two refute-by-default checks of the page found 27 and 30 conflicts: ${CONS}/2026-11-01-page-section-and-questions.md and ${CONS}/2026-11-01-page-jobs-and-cards.md. The orchestrator then applied fixes: see git -C ${ROOT} diff 25a2d06c HEAD -- docs/plans/architecture-pass/ (the commits e1f5a89d and 8c6b58ef). The candidate shape the page follows is ${AP}/2026-11-01-engine-shape.md (read its sections 1, 2, 4 and 5 and its last section, "Corrections from the check").

Where you work: only under /home/user/ALN-Ecosystem/, branch claude/nice-curie-hescfv; read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner. Never open backend/.env. Write only the file named below.

Your job, refute by default:
1. For each of the 57 rows in the two check files, read the rebuilt page (python3 -I -c "import html,re; t=open('${RP}/2026-10-31-cause-report.html').read(); t=re.sub(r'<style>.*?</style>','',t,flags=re.S); print(html.unescape(re.sub(r'<[^>]+>',' ',t)))") and the data files, and give a verdict: resolved, partly resolved, or not resolved, with the page text you read.
2. Read every string the fixes changed (the git diff above) against the shape and against the rest of the page, and list any new conflict the fixes introduced: a fact that now disagrees with another place on the page, a count that no longer matches, an open choice now stated as decided, a part named on a card that the section does not list for that flaw, or wording that breaks the house rules (docs/agents/process.md sections 4 and 5: plain words, short sentences, no metaphors, no internal codes beyond C1 to C16, N1 and J1 to J10).
Write ${CONS}/2026-11-01-page-fix-verify.md: a header, a table of the 57 rows with verdicts, a table of new conflicts (where, what it says, what it should say, file and field), and a one-line summary.
Done when: all 57 rows have a verdict citing the page text, every changed string has been read, and the summary counts match the tables. Return the file, the counts, and the new conflicts in one line each.`, { label: 'verify', phase: 'Verify', model: 'opus', effort: 'high', schema: { type: 'object', properties: { file: { type: 'string' }, resolved: { type: 'integer' }, partly: { type: 'integer' }, notResolved: { type: 'integer' }, newConflicts: { type: 'array', items: { type: 'string' } } }, required: ['file', 'resolved', 'partly', 'notResolved', 'newConflicts'] } })
return r