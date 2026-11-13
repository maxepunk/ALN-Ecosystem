# What belongs to a session, an installation and the production

Status: accepted (owner, 2026-11-13)

Three lifetimes, and a rule for each.

A session. Everything a group's play produced is wiped from every
screen and scanner when the next session is created, and lives on only
in that session's record: the entities (ALN's accounts; "teams" in
older code), transactions, scores, the clock, cues fired, scans stored
on scanners, what the TV was showing.

An installation. Everything about the room stays through sessions and
restarts: which gear is installed, the GMs' logins, volumes and audio
routes, the Bluetooth speaker, the scanners that belong to the kit.

The production. The pack and its media. They change only when a new
pack is applied, never in the middle of a session.

A backend runs one session at a time. Everything is still keyed by the
session, so nothing prevents more later (`docs/plans/ROADMAP.md`
section 2.2).

After a session ends, notes, photos and the accusation can be added to
it until the next session is created. Player scans that a scanner
stored and uploads late go into the session they were made in, marked
late, and never into the next group's. Nothing else is accepted after
the end.

Why. Before this, the devices did not agree on where one session ended
and the next began, a scanner's stored scans could land in the next
group's session, and a restart logged every GM out. The alternative
was to keep one undivided pool of state and clear parts of it by hand
at each point in a session's life, as five hand-written lists of steps
did.
