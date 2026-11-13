"""Theme the diagrams render_diagrams.js draws, so they follow the page's light and dark tokens.

render_diagrams.js draws every diagram with stand-in colours. theme_svg() swaps each stand-in, and each
colour the diagram sources write themselves, for a CSS variable, and raises if any colour is left that
nothing maps. DIAGRAM_TOKENS and DIAGRAM_CSS go into every page's stylesheet.
"""
import re

# Stand-ins (render_diagrams.js) and source colours -> theme tokens.
COLOURS = {
    '#010103': 'var(--dia-text)',     # every text colour
    '#000': 'var(--dia-text)',        # Mermaid's fixed math-label fill
    '#010104': 'var(--dia-border)',   # every border
    '#010109': 'var(--dia-border)',   # note borders
    '#010105': 'var(--dia-line)',     # lines and arrows
    '#01010e': 'var(--dia-line)',     # arrowheads (Mermaid darkens the line colour)
    '#fefef1': 'var(--dia-bg)',       # background, edge labels
    '#fefef2': 'var(--dia-node)',     # node and actor fill
    '#fefef6': 'var(--dia-node)',     # second node fill
    '#fefef7': 'var(--dia-cluster)',  # groups, activations
    '#fefef8': 'var(--dia-note)',     # notes
    'rgba(254, 254, 241, 0.5)': 'var(--dia-label-bg)',
    '#0f766e': 'var(--accent)',       # "the one place that would own the fact"
    '#dc2626': 'var(--fault)',        # "where it goes wrong"
    '#b45309': 'var(--warm)',         # reaches the show from outside
    '#6b7280': 'var(--muted)',
}
# Shadows Mermaid writes for menus no page uses; they read the same in both themes.
ALLOWED = {'rgb(0 0 0 / 0.4)', 'rgba(0,0,0,0.2)'}
# Mermaid lightens the background stand-ins for some fills (hue 60, our stand-ins' hue).
HSL_STANDIN = re.compile(r'hsla?\(\s*60(?:\.0+)?\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(?:,\s*[\d.]+\s*)?\)')
COLOUR = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)')

DIAGRAM_TOKENS_LIGHT = ('--dia-bg: #ffffff; --dia-node: #f1f6f5; --dia-cluster: #e9f0ee; --dia-note: #fbf5e4; '
                        '--dia-text: #17201e; --dia-border: #8a9c97; --dia-line: #5b6965; '
                        '--dia-label-bg: rgba(255, 255, 255, 0.85); --warm: #b45309;')
DIAGRAM_TOKENS_DARK = ('--dia-bg: #17201e; --dia-node: #1f2b28; --dia-cluster: #1a2421; --dia-note: #2f2a1b; '
                       '--dia-text: #e6ecea; --dia-border: #5f736e; --dia-line: #9babA6; '
                       '--dia-label-bg: rgba(23, 32, 30, 0.85); --warm: #f0a04b;')
# Sequence diagrams carry a few fixed presentation attributes; page CSS outranks them.
DIAGRAM_CSS = '''
.dia-svg svg { max-width: none; }
.dia-svg [stroke="#000000"], .dia-svg [stroke="#666"], .dia-svg [stroke="#999"] { stroke: var(--dia-line); }
.dia-svg [fill="#eaeaea"] { fill: var(--dia-node); }
.dia-svg [fill="#EDF2AE"] { fill: var(--dia-note); }
'''
ATTR_OK = {('stroke', '#000000'), ('stroke', '#666'), ('stroke', '#999'), ('fill', '#eaeaea'), ('fill', '#EDF2AE')}


def _swap(text, where, key):
    def one(m):
        c = m.group(0)
        if c in COLOURS:
            return COLOURS[c]
        if c in ALLOWED:
            return c
        if HSL_STANDIN.fullmatch(c):
            return 'var(--dia-cluster)'
        raise ValueError(f'diagram {key}: colour {c} in {where} has no theme token (diagram_theme.COLOURS)')
    return COLOUR.sub(one, text)


def theme_svg(svg, key):
    """Return the SVG with every colour in its style block and style attributes swapped for a token."""
    svg = re.sub(r'(<style>)(.*?)(</style>)', lambda m: m.group(1) + _swap(m.group(2), 'its style block', key) + m.group(3),
                 svg, count=1, flags=re.S)
    svg = re.sub(r'style="([^"]*)"', lambda m: 'style="' + _swap(m.group(1), 'a style attribute', key) + '"', svg)
    for attr, c in re.findall(r'\b(fill|stroke|stop-color|color)="(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))"', svg):
        if (attr, c) not in ATTR_OK:
            raise ValueError(f'diagram {key}: attribute {attr}="{c}" has no CSS override (diagram_theme.DIAGRAM_CSS)')
    return svg
