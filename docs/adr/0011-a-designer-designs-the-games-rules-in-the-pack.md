# A designer designs the game's rules in the pack

Status: accepted (owner, 2026-11-13)

A designer designs a game's rules in the pack, in the config tool, with
no developer. That includes how things are scored and the verbs players
use with tokens.

A designer sets:

- what a token carries: the values on each token that the rules use,
  under the designer's own names;
- what an account is (a team, a player, a faction) and what it holds
  (money, points, or more than one thing);
- the verbs: each thing a player or a GM can do with a token, with its
  name, who may do it, on which kind of device, and when it is allowed;
- what each verb does: how many points it gives or takes and from which
  account, written as a formula over the token's values, tables and
  what the account has done so far; whether the token is used up; what
  is shown, and where; what the room does;
- what the game does by itself, such as a bonus when a set is complete
  or a change when a phase starts.

The engine's code holds the capabilities these rules are built from:
the things that can happen, the facts a rule can read, the operations
of a formula, and the effects a rule can have. The same code works the
rules out in the backend and inside the GM scanner (`0007`).

A developer comes in only when a rule needs a capability the engine
does not have yet: a score read off a graph, state that spreads between
players, a new kind of screen, audio in several rooms. The capability
is added once, in the engine (`0009`), and every designer can then use
it.

ALN's own rules (selling, exposing, value times type, the group bonus)
are rules in ALN's pack. They are not the engine's built-in model.

Two things stay. Starting and ending a session, running the show by
hand and changing a score by hand always belong to staff. And a pack
holds rules and formulas, never program code. A formula is built from
a fixed set of operations, it always finishes, and it is checked when
the pack is published.

Why. The engine exists so that new games can be designed. The owner,
2026-11-13: "designing an engine that allows NEW games to be designed
which MUST INCLUDE how things are scored / the verbs a designer can
allow players to engage in using tokens." The roadmap's final outcome
(2026-08-29) already has a designer building a complete game as a
pack, mechanics and economy included, inside the design tool, without
touching code.

Before this, the formulas were in the engine's code. A pack named them
and set their numbers, and a mode picked from ALN's choices. A game
scored another way needed a developer.

The alternative, which the agent first recommended: a designer's rules
only run the room and never change points, and each new way of scoring
is added by a developer. The owner rejected it as a bias toward ALN's
existing ruleset. It had read the rule about staff-only actions as a
limit on the game's own rules, and today's code as the model.

What this asks of the rest:

- The session's record notes each verb done and each effect it had,
  with the rule that caused it (`0001`, `0002`).
- An effect is a change to the game or a request to the room. Requests
  to the room go to show control, and are skipped in a game with no
  backend (`0008`).
- Show control keeps its own cues for the room. A cue never changes the
  game.
- ALN's rules written the new way must give the same scores as today's
  code on recorded sessions. The toy game is scored another way, to
  prove the rules are not ALN's.
- The config tool needs screens for verbs and formulas (the roadmap's
  mechanics editor).
