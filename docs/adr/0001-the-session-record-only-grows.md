# The session record only grows

Status: accepted (owner, 2026-11-13)

The backend used to keep a game session as data that is edited in
place. Deleting a transaction cut it out of the list, and resetting
the scores emptied the list, so the session's data could not show that
either had happened. The owner decided that the session record only
grows: every scan, every correction and every reset is added as a new
line, in order, and the scores and everything a screen shows are worked
out from the record. Nothing changes or removes a line once it is
written. A correction is a new line.

Why. Scans taken while a GM scanner had no connection can be added in
order. After a restart, the backend reads the record through and is
back where it was. And the record is already the full account of the
session that the report afterwards needs.

The alternative was to keep editing the session's data in place. The
three independent reviewers of the architecture proposal
(`docs/plans/architecture-pass/proposal/challenge/`) all recommended
the growing record.
