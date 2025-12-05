# Jac LLM Documentation Pipeline - System Summary

## Architecture Overview

The pipeline implements a **MapReduce-style architecture** tailored for processing large documentation sets into a token-efficient "reference manual" for LLM context windows. It overcomes context window limits by distributing extraction (Map) and hierarchically condensing (Reduce) content.

### 1. Map Phase (Extraction)
*   **Goal:** Isolate relevant content for specific topics from heterogeneous source files.
*   **Component:** `TopicExtractor` (`topic_extractor.py`)
*   **Input:** Raw Markdown files (`docs-new/**/*.md`).
*   **Configuration:** `config/topics.yaml` defines ~40 topics (e.g., `walkers`, `file_io`, `ai_integration`) with keywords.
*   **Process:**
    *   Iterates through all source files.
    *   Uses a **single LLM call per file** to extract relevant snippets for *all* matching topics simultaneously (optimization to reduce API calls).
    *   **Implicit Shuffle:** Appends extracted content to topic-specific "buckets" (e.g., `output/1_extracted/walkers.md`). Thread-safe locking ensures data integrity.

### 2. Local Reduce Phase (Topic Merging)
*   **Goal:** Synthesize scattered snippets into a coherent, single-topic guide.
*   **Component:** `TopicMerger` (`topic_merger.py`)
*   **Input:** `output/1_extracted/{topic}.md` (Raw extracted snippets).
*   **Process:**
    *   **Recursive Merge:** If a topic file is too large (>12k chars), it chunks the content and recursively merges (Map-Reduce within a Reduce step) until it fits the context window.
    *   **Stagnation Detection:** Prevents infinite recursion if the model fails to compress content sufficiently.
    *   **Prompt Strategy:** "Concise Technical Reference". explicitly protects critical APIs (StdLib) and syntax variants (`import:py`, `spawn`).
*   **Output:** `output/2_merged/{topic}.txt` (One refined guide per topic).

### 3. Tree Reduce Phase (Hierarchical Merge)
*   **Goal:** Combine disjoint topic guides into a single unified document without losing context.
*   **Component:** `HierarchicalMerger` (`hierarchical_merger.py`)
*   **Input:** All `output/2_merged/*.txt` files.
*   **Process:**
    *   Groups files (Ratio 4:1 default) and merges them in passes ($N \to N/4 \to \dots \to 1$).
    *   Uses the same "Concise Technical Reference" prompt to ensure consistent style and preservation of protected content.
*   **Output:** `output/3_hierarchical/unified_doc.txt`.

### 4. Finalize Phase (Formatting & Compression)
*   **Goal:** Maximize token density for the final artifact.
*   **Component:** `UltraCompressor` (`ultra_compressor.py`)
*   **Input:** `unified_doc.txt`.
*   **Process:**
    *   **LLM Formatting:** Rewrites text into an ultra-dense format (removing "fluff", combining lines).
    *   **Regex Minification:** Aggressively strips newlines and whitespace (single-line style) while preserving code block boundaries and protected keywords (`file.open`, `&`, `.edges`).
*   **Output:** `output/4_final/jac_docs_final.txt`.

### 5. Release Phase
*   **Goal:** Version control and publication.
*   **Process:**
    *   Copies the final artifact to `release/0.4/`.
    *   Auto-increments version number (`jac_docs_finalN.txt`).

## Key Optimizations

1.  **Content Protection:** Explicitly "protects" Standard Library APIs (`file`, `os`, `json`, `logging`) and specific syntax (`import:py`, `spawn`, `&`) in prompts to prevent over-condensation.
2.  **Recursive Chunking:** Handles massive topics ("Types and Variables", "AI Integration") that exceed context windows.
3.  **Parallel Execution:** Uses `ThreadPoolExecutor` in Stages 1, 2, and 3 for high throughput.
4.  **Single-Pass Extraction:** 1 LLM call per source file vs 1 call per topic per file (10x-30x reduction in API calls).

## Configuration

*   **`config/config.yaml`**: Pipeline settings (directories, merge ratios, LLM model).
*   **`config/topics.yaml`**: Topic definitions and keywords.
*   **`config/merge_prompt.txt`**: Instructions for Stage 2 & 3 (Reference style, protected content).
*   **`config/format_prompt.txt`**: Instructions for Stage 4 (Ultra-compact formatting).
