import re;


def patch_missing_braces(code: str) -> tuple {
    was_patched = False;
    open_braces = code.count("{");
    close_braces = code.count("}");
    open_brackets = code.count("[");
    close_brackets = code.count("]");
    open_parens = code.count("(");
    close_parens = code.count(")");

    if open_braces > close_braces {
        missing = open_braces - close_braces;
        code = code + "\n" + "}" * missing;
        was_patched = True;
    }
    if open_brackets > close_brackets {
        missing = open_brackets - close_brackets;
        code = code + "]" * missing;
        was_patched = True;
    }
    if open_parens > close_parens {
        missing = open_parens - close_parens;
        code = code + ")" * missing;
        was_patched = True;
    }
    return (code, was_patched);
}


obj SyntaxChecker {
    static def validate_element_strict(code: str, element: str) -> bool {
        code_normalized = " ".join(code.split());
        strict_patterns = {
            "walker": "\\bwalker\\s+\\w+\\s*\\{",
            "node": "\\bnode\\s+\\w+\\s*\\{",
            "edge": "\\bedge\\s+\\w+\\s*\\{",
            "obj": "\\bobj\\s+\\w+\\s*\\{",
            "enum": "\\benum\\s+\\w+\\s*\\{",
            "has": "\\bhas\\s+\\w+\\s*:\\s*\\w+",
            "can": "\\bcan\\s+\\w+\\s+with\\s+",
            "with entry": "\\bwith\\s+entry\\s*\\{",
            "with exit": "\\bwith\\s+exit\\s*\\{",
            "visit": "\\bvisit\\s+[^\\s;]+",
            "spawn": "\\bspawn\\s+\\w+\\s*\\(",
            "by llm": "\\bby\\s+llm\\b",
            "by llm(": "\\bby\\s+llm\\s*\\(",
            "import": "\\bimport\\s+",
            "from": "\\bfrom\\s+\\w+\\s*\\{",
            "return": "\\breturn\\s+",
            "report": "\\breport\\s+",
            "def": "\\bdef\\s+\\w+\\s*\\(",
            "async": "\\basync\\s+(walker|def)",
            "__specs__": "\\bobj\\s+__specs__\\s*\\{",
            "socket.notify": "socket\\.notify(_channels)?\\s*\\(",
            "here": "\\bhere\\s*\\.",
            "self": "\\bself\\s*\\.",
            "-[": "-\\[\\w+\\]->",
            "-->": "-->",
            "<--": "<--",
            "sv {": "\\bsv\\s*\\{",
            "cl {": "\\bcl\\s*\\{",
            "props": "\\bprops\\b",
            ":protect": ":protect\\b",
            "lambda": "lambda\\s+\\w+",
            "import from": "\\bimport\\s+from\\b"
        };

        if element in strict_patterns {
            pattern = strict_patterns[element];
            if re.search(pattern, code) {
                return True;
            }
            return False;
        }

        if ":" in element and "has" not in code {
            return False;
        }

        if element.startswith("def ") and "def" in code {
            parts = element.split();
            func_name = (parts[1]) if len(parts) > 1 else None;
            if func_name {
                pattern = "\\bdef\\s+" + re.escape(func_name) + "\\s*\\([^)]*\\)";
                return bool(re.search(pattern, code));
            }
        }

        for keyword in ["walker", "node", "edge", "obj", "enum"] {
            if element.startswith(keyword + " ") {
                parts = element.split();
                name = (parts[1]) if len(parts) > 1 else None;
                if name {
                    pattern = "\\b" + keyword + "\\s+" + re.escape(name) + "\\s*\\{";
                    return bool(re.search(pattern, code));
                }
            }
        }

        if "." in element and "(" not in element {
            method_pattern = re.escape(element) + "\\s*\\(";
            if re.search(method_pattern, code) {
                return True;
            }
            return False;
        }

        if element.startswith('"') or element.startswith("'") {
            return element in code;
        }

        if element in ["==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "**", "//",
                       "<<", ">>", "&", "|", "^", "~", "and", "or", "not", "in", "is"] {
            return element in code;
        }

        if element.replace("_", "").isalnum() {
            pattern = "\\b" + re.escape(element) + "\\b";
            return bool(re.search(pattern, code));
        } else {
            return element in code;
        }
    }

    static def check_syntax(code: str) -> list {
        checks = [];

        if re.search("\\bwith entry\\b", code) and not re.search("with entry\\s*\\{", code) {
            checks.append("[WARN] 'with entry' should be followed by a block { }");
        }
        if re.search("\\bwith exit\\b", code) and not re.search("with exit\\s*\\{", code) {
            checks.append("[WARN] 'with exit' should be followed by a block { }");
        }

        for keyword in ["walker", "node", "edge", "obj", "enum"] {
            if re.search("\\b" + keyword + "\\s+\\w+\\b", code) {
                if not re.search("\\b" + keyword + "\\s+\\w+\\s*\\{", code) {
                    checks.append(f"[WARN] '{keyword}' declaration should be followed by opening brace");
                }
            }
        }

        open_braces = code.count("{");
        close_braces = code.count("}");
        if open_braces != close_braces {
            checks.append(f"[WARN] Mismatched braces: {open_braces} opening, {close_braces} closing");
        }

        open_brackets = code.count("[");
        close_brackets = code.count("]");
        if open_brackets != close_brackets {
            checks.append(f"[WARN] Mismatched brackets: {open_brackets} opening, {close_brackets} closing");
        }

        open_parens = code.count("(");
        close_parens = code.count(")");
        if open_parens != close_parens {
            checks.append(f"[WARN] Mismatched parentheses: {open_parens} opening, {close_parens} closing");
        }

        return checks;
    }
}
