# A tag holds a web link first and the token's id second

Status: accepted (owner, 2026-11-13)

After the cutover, an iPhone and an Android phone scan a token the same
way. The player holds the phone to the token, and the phone itself
opens the link on the tag. Nothing is installed and no page has to be
open first.

So a tag holds two things, in this order: a web link that opens that
token in the player scanner page, and the token's id as text. Phones
use the link. The hardware scanner and the GM scanner read the id.

The link names the production, never one kit, and has no port number.
It is inside physical objects, so no update can change it: it is kept
short, and the backend answers it for as long as the tags exist.

Why the link is first. An Android phone that reads a tag by itself
looks only at the first thing on it. An iPhone finds the link wherever
it is. With the id first, an Android player had to open the player
scanner page before scanning, and the page read the tag itself. That
works in Chrome only and gives the two phones two different ways in.

The alternative was to keep the id first for ALN and let each
production choose. The agent recommended it, to spare the hardware
scanner a firmware change. The owner kept the rule of 2026-06-11
(`docs/decisions/2026-06-11-engine-design-notes-b4-b10.md`, P7): one
way in for both phones is the better long-term choice.

What this asks of the rest:

- The hardware scanner's firmware finds the id when it comes second,
  and the link stays short enough for one read of the tag. It also
  reads a tag with the id first, so today's tags work until they are
  rewritten after the cutover.
- The GM scanner reads tags whenever it is on screen, so a token that
  touches a GM's device does not open the link. The player scanner page
  records no player scan on a device that holds a staff credential.
- The player scanner page is built for a fresh page load at every scan.

A known limit. A scan from a phone shows that the phone had the link,
not that it touched the token. The link never changes, so it can be
passed on or guessed. A pack can give each token a code that cannot be
guessed, carried in the link and checked by the backend. ALN does not.

The research: `docs/plans/2026-11-13-phone-tap-to-web-tag-research.md`.
Nothing in it was tried on a phone. One spare tag and two phones
confirm it at the start of the work on the kit's DNS and certificate.
