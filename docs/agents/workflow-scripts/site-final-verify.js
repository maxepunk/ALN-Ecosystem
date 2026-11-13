export const meta = {
  name: 'site-final-verify',
  description: "Confirm the owner site's last hand fixes on the rebuilt pages, refute-by-default, before publishing",
  phases: [{ title: 'Verify', detail: 'one reader over the last rows and the lines they changed' }],
}
const ROOT = '/home/user/ALN-Ecosystem'
const AP = ROOT + '/docs/plans/architecture-pass'
const SITE = AP + '/report/site'
const CHECKS = SITE + '/checks'
const SCHEMA = { type: 'object', properties: { file: { type: 'string' }, resolved: { type: 'integer' }, partly: { type: 'integer' }, unresolved: { type: 'integer' }, newConflicts: { type: 'integer' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['file', 'resolved', 'partly', 'unresolved', 'newConflicts', 'keyPoints'] }
phase('Verify')
const r = await agent(`Context. The ALN show engine's architecture pass publishes a site for the owner, built into ${SITE}/ by ${AP}/report/build_site.py; its plan is ${SITE}/2026-11-01-site-plan.md (section 6: the rules). The last verification (${CHECKS}/verify-2a.md and ${CHECKS}/verify-2b.md) left rows marked partly and new conflicts; they were fixed by hand in the last commit: git -C ${ROOT} show HEAD -- docs/plans/architecture-pass/ (ignore the built HTML in that diff; read the pages instead). One extra change, not asked by a row: the per-question "This question replaces question 17/18 of round 8" sentences and "folded in from question 23" were replaced by one orientation line in the Decisions intro.

Rules in short: promises by exact titles, never by number; the venue technician; "job" and "installer" only on changes.html; decision 28 everywhere; the shape a candidate, never decided; edit history only on the change log; plain short active sentences, no metaphors, no em dashes; links read naturally; facts match their sources.

Read a page as text, diagrams' labels kept: python3 -I -c "import html,re,sys; t=open(sys.argv[1]).read(); t=re.sub(r'<style>.*?</style>','',t,flags=re.S); print(html.unescape(re.sub(r'<[^>]+>',' ',t)))" <file>.

Your task: refute by default. For every partly row and every new-conflict row in verify-2a.md and verify-2b.md, read the rebuilt page(s) it names and say resolved, partly or unresolved. Then read every line the last commit changed, as it renders on its page, and list any new conflict with where, what it says, what it should say and the exact place to change it. Do not sweep the pages beyond those lines.

Where you work: only under ${ROOT}; read nothing in the top-level /home/user/ALNScanner, /home/user/ALN-TokenData, /home/user/ALNPlayerScan or /home/user/arduino-cyd-player-scanner; never open backend/.env; do not commit; write only your report.

Write ${CHECKS}/verify-3.md: a short header, the verdict table, the new conflicts table, then what you found right. Return the file, the counts and five key points.

Done when: every partly and new row of both files has a verdict and every changed line has been read on its page.`, { label: 'verify:final', phase: 'Verify', model: 'opus', effort: 'high', schema: SCHEMA })
log(r ? `final verify: ${r.resolved} resolved, ${r.partly} partly, ${r.unresolved} unresolved, ${r.newConflicts} new` : 'final verify: no result')
return r