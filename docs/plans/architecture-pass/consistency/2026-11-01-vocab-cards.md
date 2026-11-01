# Vocabulary pass (decision 27): the cause cards and the standalone lines

- **Date:** 2026-11-01. **Tree:** `/home/user/ALN-Ecosystem`, branch `claude/nice-curie-hescfv`, HEAD `20ec5c38` (before this edit).
- **Share:** `report/2026-10-31-cause-cards.json` (every card's `title`, `atAShow`, `whyItHappens`, `designTerms`, `shapeChange`, `seenLive`, `examples[].text`, `after.note`, and the labels in `before.mermaid` and `after.mermaid`) and `report/2026-10-31-standalone-lines.json` (every entry of `lines`).
- **Rule applied:** "job" is retired; a promise is referred to by its exact title or, inside its own entry, as "this promise"; parts keep promises, flaws break them; no J number and no "installer" in an owner-facing string. Meaning, facts, counts, part names, flaw ids and question letters are unchanged.
- **How:** both files loaded, edited and written back with `json.dumps(data, indent=2, ensure_ascii=False)` plus a trailing newline. The standalone-lines file round-tripped byte-identical. The cards file differs from the committed one on exactly the five lines below (`diff`: 5 changed lines).

## Changed strings

The retired word appeared only in one clause, the alternative at the end of five `after.note` strings: "each job sends its own [facts]", meaning no shared Delivery part, every promise's parts sending facts their own way. The sentence now says that in the new vocabulary. No other field in either file used "job", a J number or "installer", and no string in the share refers to a promise by number or title, so no title had to be substituted.

| Where | Before | After |
|---|---|---|
| C1 `after.note` (last sentence) | Or: each job sends its own. | Or: the parts keeping each promise send their own facts. |
| C2 `after.note` (last sentence) | Or: each job sends its own facts; this fault returns. | Or: the parts keeping each promise send their own facts; this fault returns. |
| C6 `after.note` (last sentence) | Or: each job sends its own facts. | Or: the parts keeping each promise send their own facts. |
| C10 `after.note` (last sentence) | Or: each job sends its own facts. | Or: the parts keeping each promise send their own facts. |
| C14 `after.note` (last sentence) | Or: each job sends its own facts. | Or: the parts keeping each promise send their own facts. |

## Check

Command and its output (empty means no finding). The script walks every owner-facing string named above, including each mermaid node and edge label with `<br/>` joined, and prints any whole word `job`/`jobs` (any case), any `J1`..`J10` token, any `installer`, and any double-quoted phrase in a sentence about a promise that is not one of the ten exact titles:

```
$ python3 -I /tmp/claude-0/-home-user/5a982c73-3a26-5297-92bd-9dd1027a1b1a/scratchpad/vocab_check.py
```

Output: none (stderr: `strings read: 708`).

Raw grep over the whole files, same words, both files: `0` and `0`. Both files parse with `json.load`; both end with a newline.

## Counts

- Strings read: 708 (16 standalone lines; 16 cards × (title, atAShow, whyItHappens, designTerms, shapeChange, seenLive, after.note) = 112; 91 example texts; 489 mermaid labels).
- Strings changed: 5 (all `after.note`).
- Strings unsettled: 0.
