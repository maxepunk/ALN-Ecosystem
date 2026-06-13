"""Test setup for scripts/ — least-invasive import path.

scripts/ is not a package (the scripts themselves do their own sys.path
manipulation), so tests mirror that: prepend scripts/ to sys.path.

sync_notion_to_tokens.py exits at import time if NOTION_TOKEN is unset,
so a dummy token is provided BEFORE the module is imported. No test in
this directory performs network I/O.
"""
import os
import sys
from pathlib import Path

os.environ.setdefault("NOTION_TOKEN", "test-token-never-used-no-network")

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))
