# The owner's comments of 2026-11-02, word for word

After version 9 of the owner site went live, the owner asked: "I want to
think carefully through the decisions you're presenting, are all of them
real decisions for me to make? You know what I mean? And have we
captured the actual questions based on the proactive, top-down
architectural design paradigm we've been shifting our approach to
adopt. You know what I mean?"

The agent answered that four of version 9's eighteen questions were
really the owner's (the three on standalone games, and what the panel's
blind round gets), plus the business half of the quality targets'
numbers; that the rest were the agent's own calls or reviews; and that
most of the eighteen came from the bottom-up period. It proposed seven
questions it saw still open:

1. When qualities conflict, which win?
2. When a GM tablet loses the show machine mid-show, does play continue
   on the tablet and get sorted out afterwards, or pause until the
   machine is back?
3. On release day, must everything update together (tablets, phone
   pages, hardware scanners, packs), or must older ones keep working
   with a newer engine, and for how long?
4. How central are standalone games: an occasional fallback for small
   events, or a line of shows the owner plans to run?
5. Which hardware is fixed?
6. When a future game needs a new kind of mechanic, who adds it: only
   the engine's developers, as a general ability any game can use, or
   also the game's own maker, inside that game?
7. The show-size and timing numbers that are business calls (devices
   and phones per kit, power-on to a running show, kit set-up time,
   publish to playing, how long records are kept, a scanner's first
   sync).

The owner's reply, word for word:

> yes, go ahead and rework the page. but first, I'd like to comment on
> the things you see still open to make sure you're thinking in the
> right direction:
>
> 1 - This is a great question and I would need to understand the
> specific conflicts and what they mean functionally in order to be
> able to answer optimally.
>
> 2 - For more or less all use cases, having to pause a game because a
> connection was lost or a device goes down mid-game is the worst
> possible scenario. During a game situation, the GMs need to know their
> available fallbacks to keep a game running with as minimal impact on
> the player experience as possible if at all possible if ever there's
> a technical failure mid-game.
>
> 3 - Generally speaking, yes, but I'd like to understand more
> specifically what this question means in practice and how it impacts
> the actual design and build, especially long-term after initial
> development of the new engine is completed and in use for ALN.
>
> 4 - I don't understand the distinction between the two scenarios you
> presented. Standalone games are a capability of the "engine" to enable
> design and set-up of games that can run in environments where a
> network connection is simply not feasible, or other logistics making
> it more preferable to use only gm and/or player scanners (phone or
> hardware) for a game.
>
> 5 - The hardware is fixed only insofar as I have the hardware I have
> on which I am running ALN, but the point of the engine in its mature
> form is that it is flexible meaning that we should build the
> fundamental architecture to allow flexibility with the hardware down
> the line. Meanwhile, we need to set realistic boundaries about what
> our current roadmap should incorporate in terms of that flexibility
> vs. where it should establish specific hardware requirements.
>
> 6 - This is a good question, but I got very confused by your phrasing
> of your explanation of the question. I think the way to think about
> this may be more nuanced than you're looking at it or like, you may be
> conflating a couple of different framings for this question. Game
> mechanics could be different ways to combine existing in-engine
> capabilities to create different gameplay verbs for the players to
> engage with or different ways the game might actually respond to
> existing game triggers within the engine. This should probably be able
> to be done by the game's own maker inside that game. (though possibly,
> in the long term, with a way to share with other game makers for their
> games too) Game mechanics could also be for an existing gameplay
> action triggering a response that the game engine is not currently
> capable of. This probably requires a developer to extend the code of
> the engine in a way that any game can use. (though there are questions
> of how those extensions then interact with the main release of the
> engine when this happens, which I think is the other question you were
> conflating with the question of that piece of the engine a game
> mechanic extensions might change (packs, engine code, adding other
> outside services, etc.) Some examples come to mind. for a game
> mechanic extension that might be done 'within a game', perhaps it's
> something like players being able to change the lighting in the room
> by scanning different tokens on a player scanner. something that could
> be an example of extending the engine for all games might be adding a
> service like snapcast to allow multi-room audio where different areas
> get different soundtracks or the gms get the ability to play a sound
> cue across all speakers or specific cues over specific speakers
> (areas/rooms of the game space).
>
> 7 - these seem relevant, but also many are stuff that the engine
> itself should be relatively agnostic about if it's going to be open
> sourced to support many different games in many different production
> scenarios. Like, right now I am running one game/production: About
> Last Night, and I have one venue that I am running it in with the
> specific hardware that I have purchased for it. And the next game I
> build and develop as a production may be in the same venue, using the
> same hardware, but the next person to try the engine might have a
> totally different scenario they are building for, and what they need
> to know is what is a fixes requirement vs what affordances the engine
> allows in order for them to fit its use into their needs and venue
> realities.
>
> Do these pieces of feedback make sense and help refine how you're
> thinking about the project?

Recorded in `../DECISIONS.md` the same day: "No technical failure stops
a game", the purpose added to "Standalone games: declared, never mixed",
"The engine is hardware-flexible; the roadmap sets the bounds", "Two
kinds of game extension", "The engine says what is fixed and what each
production sets", and "The Decisions page holds only your decisions".
