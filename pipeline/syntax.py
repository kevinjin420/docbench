"""Jac syntax validation utilities."""

import re
from typing import Tuple


def patch_missing_braces(code: str) -> Tuple[str, bool]:
    """Patch missing closing braces/brackets/parens. LLMs often truncate them."""
    patched = False
    for open_ch, close_ch in [('{', '}'), ('[', ']'), ('(', ')')]:
        diff = code.count(open_ch) - code.count(close_ch)
        if diff > 0:
            code = code + ('\n' if open_ch == '{' else '') + close_ch * diff
            patched = True
    return code, patched


STRICT_PATTERNS = {
    'walker': r'\bwalker\s+\w+\s*\{',
    'node': r'\bnode\s+\w+\s*\{',
    'edge': r'\bedge\s+\w+\s*\{',
    'obj': r'\bobj\s+\w+\s*\{',
    'enum': r'\benum\s+\w+\s*\{',
    'has': r'\bhas\s+\w+\s*:\s*\w+',
    'can': r'\bcan\s+\w+\s+with\s+',
    'with entry': r'\bwith\s+entry\s*\{',
    'with exit': r'\bwith\s+exit\s*\{',
    'visit': r'\bvisit\s+[^\s;]+',
    'spawn': r'\bspawn\s+\w+\s*\(',
    'by llm': r'\bby\s+llm\b',
    'by llm(': r'\bby\s+llm\s*\(',
    'import': r'\bimport\s+',
    'from': r'\bfrom\s+\w+\s*\{',
    'return': r'\breturn\s+',
    'report': r'\breport\s+',
    'def': r'\bdef\s+\w+\s*\(',
    'async': r'\basync\s+(walker|def)',
    '__specs__': r'\bobj\s+__specs__\s*\{',
    'socket.notify': r'socket\.notify(_channels)?\s*\(',
    'here': r'\bhere\s*\.',
    'self': r'\bself\s*\.',
    '-[': r'-\[\w+\]->',
    '-->': r'-->',
    '<--': r'<--',
    'sv {': r'\bsv\s*\{',
    'cl {': r'\bcl\s*\{',
    'props': r'\bprops\b',
    ':protect': r':protect\b',
    'lambda': r'lambda\s+\w+',
    'import from': r'\bimport\s+from\b',
}


def validate_element(code: str, element: str) -> bool:
    """Check if a required element appears in proper syntactic context."""
    if element in STRICT_PATTERNS:
        return bool(re.search(STRICT_PATTERNS[element], code))

    if ':' in element and 'has' not in code:
        return False

    if element.startswith('def ') and 'def' in code:
        parts = element.split()
        if len(parts) > 1:
            return bool(re.search(rf'\bdef\s+{re.escape(parts[1])}\s*\([^)]*\)', code))

    for keyword in ['walker', 'node', 'edge', 'obj', 'enum']:
        if element.startswith(keyword + ' '):
            parts = element.split()
            if len(parts) > 1:
                return bool(re.search(rf'\b{keyword}\s+{re.escape(parts[1])}\s*\{{', code))

    if '.' in element and '(' not in element:
        if re.search(re.escape(element) + r'\s*\(', code):
            return True
        return False

    if element.startswith('"') or element.startswith("'"):
        return element in code

    if element in ['==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '**', '//',
                   '<<', '>>', '&', '|', '^', '~', 'and', 'or', 'not', 'in', 'is']:
        return element in code

    if element.replace('_', '').isalnum():
        return bool(re.search(rf'\b{re.escape(element)}\b', code))

    return element in code
