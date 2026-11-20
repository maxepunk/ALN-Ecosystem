# The hardware scanner takes its firmware over the air

Status: accepted (owner, 2026-11-13)

After the cutover, a hardware scanner fetches new firmware from the
backend when it starts up. It never updates during a session.

The cutover's flash by USB gives each scanner a layout with room for
two copies of the firmware. That is the last flash that needs a cable.
A power cut during an update leaves the old copy working, and a new
copy that starts and then fails its own checks gives way to the old
one.

Why. A scanner's firmware has to change whenever the messages between
the backend and the devices change, and at each change every scanner in
every kit had to be opened and plugged into a computer. With the old
layout a scanner whose firmware was too old could only say "update
needed". Now it can fetch the update.

The alternative was to keep flashing by USB. It costs nothing to build,
and it ties every change of the messages to a visit to every scanner.

The research: `docs/plans/2026-11-13-hardware-scanner-ota-research.md`.
It also found three things the new firmware must fix: it accepts any
certificate, it has no version number, and it asks internet time
servers for the time, which a kit's network does not have.
