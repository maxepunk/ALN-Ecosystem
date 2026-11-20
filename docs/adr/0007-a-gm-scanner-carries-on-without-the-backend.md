# A GM scanner carries on without the backend, and the backend confirms later

Status: accepted (owner, 2026-11-13)

In a networked game the backend decides what a scan does, and a GM sees
the result when the backend replies.

When a GM scanner cannot reach the backend, it works out the result
itself and shows it at once, marked "not confirmed". It stores the
scan. When it reaches a backend again it hands over what it stored, and
the backend decides each scan. If the backend refuses one, the GM
scanner shows the GM which scan and why.

Two rules go with that. A result the backend has confirmed is never
taken back. When two GM scanners took the same token, the scan that
reached the backend first counts.

The same holds when the backend's computer dies during a session and
does not come back. The session goes on at the GM scanners, each
showing its own part. Video, music, lights and the TV scoreboard stop,
because that computer ran them. When a backend runs again, the scanners
hand over what they stored, and the scores and the session's record are
completed. That backend can be the same computer restarted, a spare, or
the same computer after the session. Scans stored during a session
count for that session even when they arrive after it ended, and the
record shows that they arrived late.

The engine never requires a spare computer. A kit that brings one can
move the session onto it. A game that cannot be played without the
backend says so in its pack, and every GM scanner then tells its GM
that the session cannot go on.

In a networked game a GM scanner with no connection cannot pause or end
the session or run the room.

For all of this the GM scanner runs the game's rules as the same code
the backend runs, and keeps a copy of the session's record while it is
connected.

Why. "Having to pause a game because a connection was lost or a device
goes down mid-game is the worst possible scenario" (owner, 2026-11-02).
The alternative was to show the GM nothing until the backend answers,
which stops the GM at the moment the connection fails.

The cost accepted: a result a GM has told an account can be taken back.
In ALN that can hardly happen, because the GM keeps the token after a
sale and no other GM can scan it.

Before this, the GM scanner showed its own result at once in every
case, from a second copy of the rules that had already drifted from the
backend's, and nothing joined the scanners' scans if the backend never
came back.
