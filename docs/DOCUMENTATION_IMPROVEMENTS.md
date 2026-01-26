# Documentation Improvements for Jac Language

Based on benchmark analysis of Claude Sonnet 4.5 and Gemini 3 Flash across multiple documentation variants.

---

## Critical Priority (Immediate Impact)

### 1. `by llm` Syntax - Complete Guide

**Problem**: Models consistently use wrong import paths and syntax variations.

**Current Failure Patterns**:
- `import from byllm {Model}` (wrong module)
- `def foo() -> str by llm()` (extra parentheses)
- `def foo() -> str by llm;` without proper model setup

**Documentation Should Include**:

```jac
# Correct import
import from jaclang.core.llms { Model }

# Global model declaration (required pattern)
glob llm = Model(model_name="gpt-4o")

# Basic function with LLM
def summarize(text: str) -> str by llm;

# Function with explicit model reference
def translate(text: str, lang: str) -> str by llm(model=llm);

# Method inside object
obj Assistant {
    def answer(question: str) -> str by llm;
}

# Returning structured data
obj Analysis {
    has sentiment: str;
    has confidence: float;
}
def analyze(text: str) -> Analysis by llm;
```

**Add a "Common Mistakes" section**:
- Wrong: `by llm()` with empty parens
- Wrong: `import from byllm`
- Wrong: Using `by llm` without glob model declaration

---

### 2. Access Modifiers - Clear Syntax Reference

**Problem**: Models confuse colon placement and spacing.

**Current Failure Patterns**:
- `has :priv: balance` (wrong)
- `:pub def method()` (wrong)
- `has _private` (Python convention, not Jac)

**Documentation Should Include**:

```jac
obj Example {
    # Field access modifiers - modifier after 'has'
    has:pub public_field: str;
    has:priv private_field: str;
    has:prot protected_field: str;

    # Method access modifiers - modifier after 'def'
    def:pub get_data() -> str {
        return self.public_field;
    }

    def:priv internal_process() -> None {
        pass;
    }

    def:prot helper() -> int {
        return 42;
    }

    # Ability access modifiers - modifier after 'can'
    can:pub handle_request with entry {
        print("Handling request");
    }
}
```

**Key Points to Emphasize**:
- No spaces around the colon: `has:priv` not `has :priv`
- Modifier comes AFTER the keyword: `def:pub` not `:pub def`
- Three levels: `pub`, `priv`, `prot` (not `protected`, not `private`)

---

### 3. Edge Syntax - Complete Reference

**Problem**: Inconsistent edge creation and attribute assignment.

**Documentation Should Include**:

```jac
# Define edge type
edge Road {
    has distance: float;
    has toll: bool = false;
}

# Simple directional edge
a ++> b;

# Simple bidirectional edge
a <++> b;

# Typed edge (no attributes)
a +>:Road:+> b;

# Typed edge with attributes
a +>:Road:distance=100.5:+> b;

# Typed edge with multiple attributes
a +>:Road:distance=100.5:toll=true:+> b;

# Edge deletion
del a --> b;        # Delete edge from a to b
del --> b;          # Delete all incoming edges to b
del a -->;          # Delete all outgoing edges from a
```

---

## High Priority

### 4. Walker `__specs__` for Cloud/API

**Problem**: Models mix up the nested object syntax.

```jac
walker MyEndpoint {
    has data: str;

    obj __specs__ {
        static has methods: list = ["GET", "POST"];
        static has auth: bool = true;
        static has path_prefix: str = "/api/v1/custom";
        static has as_query: list = ["param1", "param2"];
    }

    can handle with `root entry {
        report {"status": "ok", "data": self.data};
    }
}
```

**Key Points**:
- `obj __specs__` not `__specs__ = {}`
- `static has` for each field
- Methods are lowercase strings: `["get", "post"]` or `["GET", "POST"]`

---

### 5. Graph Traversal and Filtering

**Problem**: Filter syntax variations cause compilation failures.

```jac
# Get all connected nodes
nodes = [-->];

# Get nodes of specific type
items = [-->(`?Item)];

# Filter by attribute
active = [-->(`?Item)](?status == "active");

# Multiple conditions
filtered = [-->(`?Product)](?price > 10.0 and in_stock == true);

# Edge type filtering
roads = [-->:Road:];

# Combined type and edge filtering
connected = [here -->:Road:-> (`?City)];
```

---

### 6. Fullstack Patterns (sv/cl blocks)

**Problem**: Models don't understand the sv/cl separation and reactive patterns.

```jac
# Server block - defines backend walkers
sv {
    walker get_data {
        obj __specs__ {
            static has methods: list = ["get"];
            static has auth: bool = false;
        }
        can fetch with `root entry {
            report {"data": "hello"};
        }
    }
}

# Client block - reactive frontend
cl {
    has count: int = 0;
    has data: str = "";

    # Mount effect (runs once on load)
    can with entry {
        response = fetch("/walker/get_data");
        data = response.get("data", "");
    }

    # Dependency effect (runs when count changes)
    can with [count] entry {
        print(f"Count changed to: {count}");
    }

    # Cleanup effect
    can with exit {
        print("Component unmounting");
    }

    def increment() {
        count += 1;
    }

    # JSX-like template
    <div>
        <p>f"Count: {count}"</p>
        <button onClick={increment}>"+"</button>
    </div>
}
```

---

## Medium Priority

### 7. Persistence Operations

```jac
# Save node to database
node = here ++> Item(name="test");
save(node);
commit();

# Reference by ID
item = &item_id;

# Delete and commit
del item;
commit();
```

### 8. Import Patterns

```jac
# Jac imports
import from module_name { Symbol1, Symbol2 }

# Python imports
import:py os
import:py from datetime { datetime }

# Aliased imports
import from module { Original as Alias }
```

### 9. Control Flow - Jac-specific

```jac
# Jac for loop (different from Python)
for i = 0 to i < 10 by i += 1 {
    print(i);
}

# Skip (like continue)
for item in items {
    if item.invalid {
        skip;
    }
    process(item);
}

# Disengage (exit walker traversal)
can process with Node entry {
    if here.is_target {
        report here;
        disengage;
    }
    visit [-->];
}
```

### 10. Match/Case Syntax

```jac
enum Status { PENDING, ACTIVE, DONE }

match status {
    case Status.PENDING {
        print("Waiting");
    }
    case Status.ACTIVE {
        print("In progress");
    }
    case Status.DONE {
        print("Complete");
    }
}
```

---

## Low Priority (Nice to Have)

### 11. Decorator Patterns

### 12. Generator Functions

### 13. Async Walkers

### 14. WebSocket Integration

### 15. Custom Access Control (`__jac_access__`)

---

## Documentation Structure Recommendations

1. **Quick Reference Card** - One-page syntax cheatsheet
2. **Common Mistakes Page** - Explicitly show wrong vs right
3. **Migration Guide** - For Python developers
4. **Runnable Examples** - Every code block should be copy-pasteable and work

---

## Metrics to Track

After documentation updates, re-run benchmarks and track:
- Jac Check pass rate (currently ~50%)
- Required elements match rate
- Per-category improvements
- Model-specific improvements (some models may benefit more from certain clarifications)
