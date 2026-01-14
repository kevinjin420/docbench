# Jaseci-Docbench Benchmark Improvements

## Overview

This document summarizes identified gaps in the current benchmark and proposed improvements to better capture realistic Jac language usage.

---

## 1. Outdated Syntax Patterns

Several tests require syntax that no longer matches the current Jac language specification. These should be updated to prevent false negatives.

| Test ID | Current Required Elements | Correct Modern Syntax |
|---------|---------------------------|----------------------|
| L2_func_03 | `with`, `\|>` | `\|params\| -> type { body }` |
| L3_obj_04 | `:ChildClass:ParentClass:` | `obj Child(Parent)` |
| L4_edge_04 | `+[EdgeType]+>` | `+>:EdgeType:+>` |
| L4_graph_02 | `:> root` | `` `root `` |
| L5_visit_02 | `--[EdgeType]-->` | `[-->:EdgeType:]` |
| L6_filter_03 | `--[Type]?` | `[-->:Type:](?cond)` |

### Action Items

- [ ] Update L2_func_03 required_elements to `["|", "->", "{", "}"]`
- [ ] Update L3_obj_04 required_elements to `["obj", "("]` for inheritance
- [ ] Update L4_edge_04 required_elements to `["+>:", ":+>"]`
- [ ] Update L4_graph_02 required_elements to `["\`root"]`
- [ ] Update L5_visit_02 required_elements to `["visit", "[-->:", ":]"]`
- [ ] Audit all tests for v0.8+ syntax changes

---

## 2. Missing Topic Coverage

The following topics from the Jac language reference have zero or minimal test coverage.

### No Coverage (0 tests)

| Topic | Description | Suggested Tests |
|-------|-------------|-----------------|
| Access Modifiers | `:pub`, `:priv`, `:prot` on has/def | L3: Define private attribute, protected method |
| Standard Library | print, range, len, enumerate, type conversions | L1-L2: Use range in loop, len on collection |
| Deployment | Docker, environment variables, jac serve | L8-L9: Read env var, configure for production |
| `skip` keyword | Skip current node in walker | L5-L6: Use skip to bypass nodes |
| `check` keyword | Soft assertion in tests | L3: Test with check vs assert |
| `glob` nodes | Global persistent nodes | L9: Create and access glob node |

### Minimal Coverage (1-2 tests)

| Topic | Current Tests | Suggested Additions |
|-------|---------------|---------------------|
| Persistence | L9_persist_01, L9_persist_02 | Add: commit(), commit(Type), auto-persist via root |
| Permissions | L8_cloud_perm_01, L10_access_01 | Add: NoPerm/ReadPerm/WritePerm levels, grant/revoke |
| References | L6_ref_01 | Add: `&"n::id"` syntax for node lookup |

### Action Items

- [ ] Add 5 new tests for access modifiers (L3 level)
- [ ] Add 3 new tests for standard library usage (L1-L2 level)
- [ ] Add 2 new tests for deployment patterns (L8-L9 level)
- [ ] Add 2 new tests for skip keyword (L5-L6 level)
- [ ] Add 1 new test for check keyword (L3 level)
- [ ] Expand persistence tests with commit patterns
- [ ] Expand permissions tests with explicit levels

---

## 3. Missing Task Types

Current tests are exclusively "generate from scratch" tasks. Real development involves multiple task types.

### Proposed New Task Types

#### 3.1 Fix-This-Code Tasks

```json
{
  "id": "L5_debug_01",
  "level": 5,
  "category": "Debugging",
  "task": "The following walker never visits child nodes. Fix the bug:\n\nwalker Traverse {\n  can walk with `root entry {\n    print(here);\n  }\n}",
  "required_elements": ["visit", "-->"],
  "forbidden_elements": [],
  "points": 25,
  "hints": ["Walker needs visit statement to continue traversal"]
}
```

#### 3.2 Code Understanding Tasks

```json
{
  "id": "L6_understand_01",
  "level": 6,
  "category": "Understanding",
  "task": "Explain what this walker does and what it returns:\n\nwalker Collector {\n  has data: list = [];\n  can collect with Person entry {\n    self.data.append(here.name);\n    visit [-->];\n  }\n}",
  "evaluation": "semantic",
  "expected_concepts": ["collects names", "traverses graph", "stores in list"],
  "points": 30
}
```

#### 3.3 Code Completion Tasks

```json
{
  "id": "L7_complete_01",
  "level": 7,
  "category": "Completion",
  "task": "Complete the AI function to classify sentiment:\n\nenum Sentiment { POSITIVE, NEGATIVE, NEUTRAL }\n\n\"\"\"Analyze the sentiment of the given text.\"\"\"\ndef classify(text: str) -> Sentiment ____;",
  "required_elements": ["by llm()"],
  "points": 35
}
```

#### 3.4 Refactoring Tasks

```json
{
  "id": "L9_refactor_01",
  "level": 9,
  "category": "Refactoring",
  "task": "Convert this Python class to a Jac node:\n\nclass User:\n    def __init__(self, name, email):\n        self.name = name\n        self.email = email\n    def validate(self):\n        return '@' in self.email",
  "required_elements": ["node User", "has name", "has email", "can validate"],
  "points": 45
}
```

### Action Items

- [ ] Add 10 debugging tasks (distributed across L3-L8)
- [ ] Add 5 understanding tasks (L5-L8)
- [ ] Add 10 completion tasks (L4-L9)
- [ ] Add 5 refactoring tasks (L8-L10)
- [ ] Implement semantic evaluation for understanding tasks

---

## 4. Combination/Integration Tests

Real applications combine multiple features. Current integration tests are too vague.

### Proposed Specific Integration Tests

```json
{
  "id": "L10_integration_auth_ai_01",
  "level": 10,
  "category": "Full Integration",
  "task": "Create an authenticated API endpoint that:\n1. Accepts a text input\n2. Uses AI to summarize it\n3. Stores the summary in a node connected to root\n4. Returns the summary with a timestamp",
  "required_elements": [
    "walker",
    "__specs__",
    "auth",
    "by llm()",
    "node",
    "++>",
    "report"
  ],
  "points": 60
}
```

```json
{
  "id": "L10_integration_realtime_graph_01",
  "level": 10,
  "category": "Full Integration",
  "task": "Create a real-time collaborative system that:\n1. Maintains a graph of Document nodes\n2. Allows walkers to update documents\n3. Broadcasts changes via WebSocket\n4. Includes permission checks before updates",
  "required_elements": [
    "node Document",
    "walker",
    "socket.notify",
    "__jac__",
    "++>",
    "report"
  ],
  "points": 60
}
```

### Action Items

- [ ] Replace vague L10 tests with specific multi-feature requirements
- [ ] Add 5 new integration tests combining 4+ features each
- [ ] Weight integration tests higher (increase points)

---

## 5. Evaluation Method Improvements

### Current Limitations

1. String pattern matching can pass broken code with right keywords
2. No execution validation for most tests
3. Forbidden elements not consistently used

### Proposed Improvements

#### 5.1 Expand Functional Test Harnesses

Currently optional. Make mandatory for L5+ tests.

```python
# Example test harness for L5_walker_01
def test_L5_walker_01(generated_code):
    # Inject test setup
    test_code = f"""
{generated_code}

with entry {{
    e = Explorer();
    assert e.visited_count == 0;
    print("PASS");
}}
"""
    result = run_jac(test_code)
    return "PASS" in result.stdout
```

#### 5.2 Add Forbidden Elements

Prevent common LLM mistakes:

```json
{
  "id": "L4_edge_02",
  "required_elements": ["++>"],
  "forbidden_elements": [
    "->",
    "connect(",
    ".add_edge("
  ]
}
```

#### 5.3 Syntax Strictness Levels

```python
VALIDATION_LEVELS = {
    "pattern": "Current - keyword matching only",
    "syntax": "Jac parser validates structure",
    "compile": "jac check passes",
    "functional": "Test harness executes successfully"
}
```

### Action Items

- [ ] Write test harnesses for all L5+ tests
- [ ] Add forbidden_elements to all tests (common Python/JS mistakes)
- [ ] Make compilation check mandatory (currently 15% penalty)
- [ ] Make functional tests mandatory for L7+ tests

---

## 6. Scoring Rebalance

### Current Distribution

| Level | Tests | Points Each | Total |
|-------|-------|-------------|-------|
| L1 | 10 | 5 | 50 |
| L2 | 10 | 10 | 100 |
| L3 | 10 | 15 | 150 |
| L4 | 10 | 20 | 200 |
| L5 | 10 | 25 | 250 |
| L6 | 10 | 30 | 300 |
| L7 | 10 | 35 | 350 |
| L8 | 10 | 40 | 400 |
| L9 | 10 | 45 | 450 |
| L10 | 40 | 50-60 | 2200 |
| **Total** | 140 | - | ~4450 |

### Issues

- L1-L4 (basic syntax) contributes only 11% of score
- An LLM could score 89% while failing all basic tests
- Integration tests are underweighted relative to difficulty

### Proposed Rebalance

1. Require minimum 70% on L1-L4 to count higher levels
2. Increase L10 integration test weights to 80-100 points
3. Add category minimums (must pass 50% of each category)

---

## 7. New Test Categories

### Suggested Additions

| Category | Level | Count | Description |
|----------|-------|-------|-------------|
| Debugging | L3-L8 | 10 | Fix broken code |
| Understanding | L5-L8 | 5 | Explain code behavior |
| Completion | L4-L9 | 10 | Fill in blanks |
| Refactoring | L8-L10 | 5 | Python to Jac conversion |
| Error Interpretation | L4-L7 | 5 | Given error, identify fix |
| Multi-file | L9-L10 | 5 | Import/include patterns |

### Total New Tests: 40

---

## Summary

| Category | Current | After Changes |
|----------|---------|---------------|
| Total Tests | 140 | ~180 |
| Task Types | 1 (generate) | 6 (generate, debug, understand, complete, refactor, error) |
| Syntax Accuracy | ~85% | 100% |
| Topic Coverage | 17/20 | 20/20 |
| Functional Tests | Optional | Mandatory L7+ |
| Integration Tests | Vague | Specific multi-feature |

---

## Implementation Priority

1. **High**: Fix outdated syntax patterns (blocks correct code)
2. **High**: Add missing topic tests (access modifiers, stdlib)
3. **Medium**: Add debugging/fix-this-code tasks
4. **Medium**: Expand functional test harnesses
5. **Low**: Add understanding/explanation tasks
6. **Low**: Scoring rebalance
