# A new capability is part of the engine, and arrives with an engine update

Status: accepted (owner, 2026-11-13)

When a developer adds something the engine could not do, such as audio
in several rooms, it becomes part of the engine. A production gets it
with an engine update. The engine loads no add-ons installed beside it.

An addition is one file in a known place. A production in a hurry runs
its own copy of the engine with that file added, and offers the file
back.

Why. The game's rules run in the backend and inside the GM scanner
(`0007`), and a hardware scanner's abilities are in its firmware. An
add-on would have to reach three kinds of program, and every device
would have to report its add-ons as well as its version. One engine
version says exactly what a kit can do, and a pack that needs more is
refused at start-up.

The alternative was add-ons a production installs beside its engine
without waiting for an update. The owner named this question on
2026-11-02 ("How an extension for all games reaches a production") and
chose the first way on 2026-11-13.
