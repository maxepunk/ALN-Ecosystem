# Every device shows a credential

Status: accepted (owner, 2026-11-13)

Every device shows the backend a credential before it can read or send
anything. A device with none can read nothing and send nothing.

There is one kind of credential, in three strengths.

Staff log in.

The kit's own scanners and screens get theirs when they are added to
the kit. Nobody types anything on them, and the credential stays with
the installation.

A player's own phone gets one on its first visit, with nothing for the
player to do. It lasts for one session and names no person.

What a credential allows is worked out when the backend issues it:
what the pack gives that kind of device, capped by the credential's
strength. Three things always stay with staff: starting and ending a
session, running the show, and changing a score. The backend sends each
device only what the pack says its kind may show. For ALN a player
scanner gets each token's picture, sound and video name, and nothing
about its value.

Why. Before this, a GM scanner logged in and every player scanner was
anonymous: the backend took a scan for any token from any device, and
sent the whole token table to anything that asked. Players' own phones
need the backend to know which device is asking, so that a game can say
what a phone may do and see.

The alternative was to leave player devices anonymous and add a
separate scheme for phones. That keeps two ways in, and the split
between them is the hardcoded rule ("players view, GMs transact") that
the pack is meant to decide.

Earlier records this rests on: `docs/plans/2026-07-09-phase3-1-one-auth.md`,
`docs/plans/ROADMAP.md` section 2.1 and row 8.11, `CONTEXT.md` section 6.
