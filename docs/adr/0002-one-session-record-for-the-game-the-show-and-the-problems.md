# One session record for the game, the show and the problems

Status: accepted (owner, 2026-11-13)

The session record holds more than the game. Besides scans,
corrections and the capture (roster, notes, photos, the accusation), it
gets one line for each thing a person at the session would call an
event: a video started and finished, a GM paused the music, a scanner
lost its connection, a program crashed and was restarted. It never
holds things that change all the time, such as the clock ticking or a
video's position.

Why. After a restart, the backend can put the TV, the music and a
running cue back from the record. And the report and the session
validation read one place, where they used to piece a session together
from the session file and the log. Scores never depend on these lines.

The alternative was to keep only the game in the record and leave the
show's state and the problems where they were, in each show-control
part's memory and in the log file.
