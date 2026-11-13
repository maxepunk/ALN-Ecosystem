# Challenge 3: a different answer for the three forks (2026-11-10)

An independent reader's report on the first draft
(`2026-11-10-proposal-draft.md`, in git history at `1bae2452`). It was
asked for one alternative that differs in kind for each of the three
improvements with real forks, a comparison, and a choice. Kept as
delivered. Paths are under the repository root.

## A. The game's facts, improvement 1

My alternative is an ordered list of decided events, such as a scan accepted with its points. Three calls: append an event, replay the list into the current facts, compute one screen's view. Staff tablets get the events and keep a full copy, and other screens get only their view. Room state stays a dated snapshot.

A cut-off tablet numbers its own scans. On return the record decides them in order and appends kept or taken back, the same path as any scan. A store, as in the draft, needs an outbox beside its state for that.

On restart the engine replays the file. Its rule is write the line, then answer. A store can match that by saving first, which today's does not.

Hidden facts come out equal. Both compute views where the truth is held.

The list is the night's record, refusals, deletes and resets included. A store keeps only outcomes. Today's drops the rest at `backend/src/services/transactionService.js:721` and `backend/src/services/session/persistenceListeners.js:44`, so the validators rebuild the night from log lines.

A tablet alone keeps the same list. Two tablets merge lists, and two stores cannot.

The list hides saving, catch-up, restart, merging and the audit trail. It is cheap here, because a game has hundreds of events and the engine can replay them all. `backend/src/gameRules/scoring.js:220` already is that replay, so the second scoring path at `backend/src/services/transactionService.js:380` goes. For years, each event's meaning is published and permanent, and one rule must order scans from devices with drifting clocks. Hand edits to state get harder.

I choose the list. The owner's open questions on the cut-off tablet and the failed show machine become settings, and recorded nights become regression tests.

## B. The rules, improvement 2

My alternative has the tablet host the whole game core, record and door as well as rules, in the package the show machine runs. Two calls: handle a request and return a reply, give a screen its view. The host supplies storage, a clock and a connection.

It hides where the game is decided. The draft's shared functions fix the arithmetic but leave `ALNScanner/src/core/storage/LocalStorage.js` as a second engine. Twelve of the eighteen repeated decisions sit outside today's rule functions, such as whether a scan may happen now.

Building it means rewriting `transactionService` and `sessionService` without singletons, emitters or disk. The core must also ship to the tablet app, a separate repository with its own static build. For years the core may never call Node or the browser. Later, a public static build cannot carry secret pack data.

Rules as data with a runtime per language is today's design, and its two interpreters drifted. In C++ every new kind of rule means a USB cable to every scanner. The scanner gets lookup tables compiled by the core, as the draft says. I choose the whole core.

## C. Equipment, improvement 5

My alternative lets the operating system's service manager run the engine and every program the audience can see or hear. The engine asks it to start, stop or restart a service named for this engine copy and hears when one changes. It launches only helpers that die with it.

Keep the draft's interface per thing the room can do, over one thin driver per program, since the TV is VLC plus the kiosk browser and PipeWire sits under video, music and sound.

This hides process lifetimes, orphans, restart back-off, boot order and logs. The PID files, the machine-wide kills, PM2 and most of `backend/src/utils/processMonitor.js` go. It costs a few service files, an install check at start and drivers that adopt a running program. For years, some behaviour lives in installed files that agents can run only on the test bed. Later, a host without that service manager needs another adapter. The draft's supervisor is easier to test and runs wherever Node runs.

I choose OS supervision. Today an engine restart kills VLC and MPD, at `backend/src/utils/processMonitor.js:61` and `:92-95`, so the TV blanks and the music stops. A supervisor inside the engine keeps that coupling.

## Order

I would not start with improvement 6 as written. Most of its fixed names and both machine-wide kills exist only while the engine launches its own programs, so first spend a day on the new show machine running VLC, MPD and the kiosk as OS services and kill the engine mid-video. What is left of 6 is then one instance name. Keep the thin slice but put improvement 2 inside it, so one core decides the first scan on the show machine and on a tablet alone, with a cut-off tablet and a restart in the proof. Otherwise the record takes the show machine's shape and the tablet becomes a second engine again.
