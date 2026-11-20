# What comes back by itself after a restart

Status: accepted (owner, 2026-11-13)

This holds for a backend that restarts in the middle of a session, and
for a video or music player that crashes and is restarted.

These come back by themselves: the session, the clock, the GMs' logins,
the music where it stopped, what the TV was showing, the lights and the
volumes.

These do not replay by themselves: a video that was cut off, a cue that
was part-way through, and a cue that came due while the backend was
down. They appear in one list on the GM scanner, and the GM runs or
drops each one.

Why. What plays in the background can return without anyone deciding.
A video or a cue belongs to a moment of the game, and after a gap only
the GM knows whether that moment has passed. The owner ruled on
2026-06-10 (decision E1) that a clock cue that came due during a
restart is marked as fired and not run. This keeps that rule and adds
the list, so the GM can see what was skipped.

Before this, after a backend restart the music stayed stopped, the TV
went back to the idle loop, a cue part-way through its timeline
stopped, held items were lost and every GM was logged out.

The alternative was to replay what was cut off. A video that starts by
itself minutes late can land on the wrong moment.
