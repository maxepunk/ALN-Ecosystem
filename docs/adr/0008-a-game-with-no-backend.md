# A game with no backend: the installation says so, and each device works alone

Status: accepted (owner, 2026-11-13)

Whether an installation has a backend is said once, in the
installation's settings. Every device gets that when it is added to the
kit. The GM no longer chooses networked or standalone when the GM
scanner starts. The pack says whether its game can be played without a
backend. ALN's can.

In a game with no backend, every device works alone while the session
runs. Phones and scanners cannot reach each other without a computer
between them. A GM scanner keeps its own part of the session and
applies the same rules as a backend, from the same code. With several
GM scanners, each shows only its own part, and the parts are put
together afterwards (`0007`). A production that wants shared scores
during play brings a backend. Player scanners show memories and send
nothing.

The GM scanner keeps the session's record, and the GM can save it off
the device at the end. The record holds what the GMs scanned. It does
not hold what players looked at, because nothing carries that from a
player scanner to a GM scanner without a backend.

The GM scanner runs the game clock and can show the scoreboard, exposed
evidence included, on its own screen. A video token on a player scanner
shows its picture and a line saying that the video cannot be played
here.

Why. Standalone games are a capability of the engine "to enable design
and set-up of games that can run in environments where a network
connection is simply not feasible, or other logistics making it more
preferable to use only gm and/or player scanners" (owner, 2026-11-02).
A game declares it, and no game mixes standalone and networked devices
(owner, 2026-10-31).

Before this, nothing declared a game standalone. Each GM scanner went
by a button its GM tapped, the phone page by the web address it was
opened from, and the hardware scanner had no such setting and showed
the missing backend as a fault. Two standalone GM scanners were two
separate games, and the last standalone session was wiped when the next
one started.

Two alternatives were set aside. If the GM keeps choosing at start-up,
each device decides for itself and nothing can stop a mix. Devices
sharing one game during play with no backend is not possible between
web pages and scanners.
