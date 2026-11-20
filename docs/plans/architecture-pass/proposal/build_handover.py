#!/usr/bin/env python3
"""Put the two handover documents on the proposal page.

The two documents are kept as Markdown in ../design/. This script turns
them into HTML and writes them into index.html between the two marker
comments. Run it again whenever either document changes:

    python3 docs/plans/architecture-pass/proposal/build_handover.py

It handles only the Markdown these two documents use: headings,
paragraphs, lists (one level of nesting), pipe tables, **bold** and
`code`.
"""
import html
import pathlib
import re

HERE = pathlib.Path(__file__).resolve().parent
DESIGN = HERE.parent / "design"
PAGE = HERE / "index.html"
ROADMAP = DESIGN / "2026-11-20-the-roadmap-revised.md"
TESTS = DESIGN / "2026-11-20-each-decision-and-its-test.md"
BEGIN = "<!-- handover:begin (made by build_handover.py from ../design/2026-11-20-*.md; do not edit by hand) -->"
END = "<!-- handover:end -->"

MARK = re.compile(r"^(\s*)(-|\d+\.)\s+(.*)$")


def inline(text):
    """Escape, then turn **bold** and `code` into tags."""
    out = []
    for i, part in enumerate(re.split(r"(`[^`]*`)", text)):
        if i % 2:
            out.append("<code>" + html.escape(part[1:-1], quote=False) + "</code>")
        else:
            part = html.escape(part, quote=False)
            part = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", part)
            out.append(part)
    return "".join(out)


def parse_list(lines, i, indent):
    """Return (items, next index). An item is [text, nested] where nested is None or (ordered, items)."""
    items = []
    ordered = None
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            break
        m = MARK.match(line)
        lead = len(line) - len(line.lstrip(" "))
        if m and len(m.group(1)) == indent:
            if ordered is None:
                ordered = m.group(2) != "-"
            items.append([m.group(3).strip(), None])
            i += 1
        elif m and len(m.group(1)) > indent and items:
            sub, i = parse_list(lines, i, len(m.group(1)))
            items[-1][1] = sub
        elif lead > indent and items:
            items[-1][0] += " " + line.strip()
            i += 1
        else:
            break
    return (bool(ordered), items), i


def parse(text):
    """Return a flat list of blocks: ('h', level, text), ('p', text), ('list', (ordered, items)), ('table', rows)."""
    lines = text.split("\n")
    blocks = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        h = re.match(r"^(#{1,6})\s+(.*)$", line)
        if h:
            blocks.append(("h", len(h.group(1)), h.group(2).strip()))
            i += 1
            continue
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                rows.append(cells)
                i += 1
            if len(rows) > 1 and all(re.fullmatch(r":?-{3,}:?", c) for c in rows[1]):
                del rows[1]
            blocks.append(("table", rows))
            continue
        m = MARK.match(line)
        if m:
            lst, i = parse_list(lines, i, len(m.group(1)))
            blocks.append(("list", lst))
            continue
        para = [line.strip()]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].startswith(("|", "#")) and not MARK.match(lines[i]):
            para.append(lines[i].strip())
            i += 1
        blocks.append(("p", " ".join(para)))
    return blocks


def render_list(lst, cls=None):
    ordered, items = lst
    tag = "ol" if ordered else "ul"
    cls = cls or ("steps" if ordered else "plain")
    out = [f'<{tag} class="{cls}">']
    for text, nested in items:
        out.append("<li>" + inline(text) + (render_list(nested) if nested else "") + "</li>")
    out.append(f"</{tag}>")
    return "".join(out)


def render_table(rows, cls):
    head, body = rows[0], rows[1:]
    out = [f'<div class="tbl-wrap"><table class="{cls}"><thead><tr>']
    out += [f"<th>{inline(c)}</th>" for c in head]
    out.append("</tr></thead><tbody>")
    for r in body:
        cells = "".join(f'<td data-label="{html.escape(h)}">{inline(c)}</td>' for h, c in zip(head, r))
        out.append("<tr>" + cells + "</tr>")
    out.append("</tbody></table></div>")
    return "".join(out)


def render_blocks(blocks, table_cls="wide"):
    """Paragraphs and lists go in the reading column; tables use the full width."""
    out, prose = [], []

    def flush():
        if prose:
            out.append('<div class="prose">' + "".join(prose) + "</div>")
            prose.clear()

    for b in blocks:
        if b[0] == "p":
            prose.append("<p>" + inline(b[1]) + "</p>")
        elif b[0] == "list":
            prose.append(render_list(b[1]))
        elif b[0] == "table":
            flush()
            out.append(render_table(b[1], table_cls))
    flush()
    return "".join(out)


def render_area(n, title, blocks):
    """One area of the build as a card. Bullets that open with a bold label become labelled rows."""
    out = [f'<article class="area"><h5><span class="order">{n}</span>{inline(title)}</h5>']
    for b in blocks:
        if b[0] == "p":
            out.append("<p>" + inline(b[1]) + "</p>")
        elif b[0] == "list":
            rows = []
            for text, nested in b[1][1]:
                m = re.match(r"^\*\*(.+?)\.\*\*\s*(.*)$", text)
                label, rest = (m.group(1), m.group(2)) if m else ("", text)
                dd = inline(rest) + (render_list(nested) if nested else "")
                rows.append(f"<div><dt>{inline(label)}</dt><dd>{dd}</dd></div>")
            out.append('<dl class="gives">' + "".join(rows) + "</dl>")
    out.append("</article>")
    return "".join(out)


def split_sections(blocks):
    """Return (title, intro blocks, [(section title, blocks)])."""
    title, intro, sections = "", [], []
    for b in blocks:
        if b[0] == "h" and b[1] == 1:
            title = b[2]
        elif b[0] == "h" and b[1] == 2:
            sections.append((b[2], []))
        elif sections:
            sections[-1][1].append(b)
        else:
            intro.append(b)
    return title, intro, sections


def doc_roadmap():
    title, intro, sections = split_sections(parse(ROADMAP.read_text()))
    out = [f'<article class="doc" id="roadmap-revised"><h3>{inline(title)}</h3>', render_blocks(intro)]
    for sec_title, blocks in sections:
        folded = sec_title.split(".")[0] in ("9", "10", "12")
        subs, head, n = [], [], 0
        for b in blocks:
            if b[0] == "h" and b[1] == 3:
                subs.append((b[2], []))
            elif subs and not (b[0] == "p" and b[1].startswith("Areas that do not need each other")):
                subs[-1][1].append(b)
            elif subs:
                subs.append((None, [b]))
            else:
                head.append(b)
        body = [render_blocks(head)]
        cards, tail = [], []
        for sub_title, sub_blocks in subs:
            if sub_title is None:
                tail += sub_blocks
            else:
                n += 1
                cards.append(render_area(n, sub_title, sub_blocks))
        if cards:
            body.append('<div class="areas">' + "".join(cards) + "</div>")
        body.append(render_blocks(tail))
        if folded:
            out.append(f'<details class="sec"><summary><h4>{inline(sec_title)}</h4><span class="count">open to read</span></summary>' + "".join(body) + "</details>")
        else:
            out.append(f'<section class="sec"><h4>{inline(sec_title)}</h4>' + "".join(body) + "</section>")
    out.append("</article>")
    return "".join(out)


def doc_tests():
    title, intro, sections = split_sections(parse(TESTS.read_text()))
    out = [f'<article class="doc" id="tests"><h3>{inline(title)}</h3>', render_blocks(intro)]
    for sec_title, blocks in sections:
        rows = sum(len(b[1]) - 1 for b in blocks if b[0] == "table")
        numbered = re.match(r"^\d+\.", sec_title)
        is_tests = numbered and sec_title.split(".")[0] in ("1", "2", "3", "4", "5", "6")
        body = render_blocks(blocks, "tests" if is_tests else "wide")
        if not numbered:
            out.append(f'<section class="sec"><h4>{inline(sec_title)}</h4>{body}</section>')
            continue
        count = f"{rows} tests" if is_tests else "open to read"
        out.append(f'<details class="sec"><summary><h4>{inline(sec_title)}</h4><span class="count">{count}</span></summary>{body}</details>')
    out.append("</article>")
    return "".join(out)


def main():
    page = PAGE.read_text()
    a, b = page.index(BEGIN), page.index(END)
    made = BEGIN + "\n" + doc_roadmap() + "\n" + doc_tests() + "\n"
    PAGE.write_text(page[:a] + made + page[b:])
    print("wrote", PAGE, "generated part:", len(made), "characters")


if __name__ == "__main__":
    main()
