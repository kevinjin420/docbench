import io;
import matplotlib;
matplotlib.use("Agg");
import matplotlib.pyplot as plt;
import numpy as np;

plt.rcParams.update({
    "font.size": 10,
    "font.family": "sans-serif",
    "figure.figsize": (10, 6),
    "figure.dpi": 150,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.facecolor": "#ffffff",
    "figure.facecolor": "#ffffff",
    "text.color": "#333333",
    "axes.labelcolor": "#333333",
    "axes.edgecolor": "#cccccc",
    "xtick.color": "#333333",
    "ytick.color": "#333333",
    "grid.color": "#e0e0e0",
    "grid.alpha": 0.5
});

def fig_to_bytes(fig: any, fmt: str = "svg") -> bytes {
    buf: any = io.BytesIO();
    fig.savefig(buf, format=fmt, bbox_inches="tight", facecolor=fig.get_facecolor(), dpi=300);
    plt.close(fig);
    buf.seek(0);
    return buf.getvalue();
}

def collections_bar_chart(collections_data: list, fmt: str = "svg") -> bytes {
    if not collections_data {
        return b"";
    }

    sorted_data: list = sorted(collections_data, key=lambda x: (
        x.get("model", ""),
        x.get("variant", ""),
        -x.get("average_score", 0)
    ));

    labels: list = [];
    scores: list = [];
    std_devs: list = [];
    colors: list = [];
    color_map: dict = {};
    color_palette: list = ["#4ade80", "#60a5fa", "#f472b6", "#facc15", "#a78bfa", "#fb923c", "#22d3d8"];
    color_idx: int = 0;

    for item in sorted_data {
        model: str = item.get("model", "Unknown");
        variant: str = item.get("variant", "");
        short_label: str = f"{model[:15]}\n{variant[:10]}" if variant else model[:15];
        labels.append(short_label);
        scores.append(item.get("average_score", 0));
        std_devs.append(item.get("std_dev", 0));

        if model not in color_map {
            color_map[model] = color_palette[color_idx % len(color_palette)];
            color_idx += 1;
        }
        colors.append(color_map[model]);
    }

    (fig, ax) = plt.subplots(figsize=(max(10, len(labels) * 0.8), 6));
    x: any = np.arange(len(labels));
    bars: any = ax.bar(x, scores, yerr=std_devs, capsize=3, color=colors, edgecolor="white", linewidth=0.5, alpha=0.9);

    ax.set_ylabel("Score (%)", fontsize=11, fontweight="bold");
    ax.set_xlabel("Model / Variant", fontsize=11, fontweight="bold");
    ax.set_title("Benchmark Results by Model", fontsize=14, fontweight="bold", pad=20);
    ax.set_xticks(x);
    ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=8);
    ax.set_ylim(0, 100);
    ax.yaxis.grid(True, linestyle="--", alpha=0.7);

    for (bar, score_val, std) in zip(bars, scores, std_devs) {
        ax.annotate(f"{score_val:.1f}",
                   xy=(bar.get_x() + bar.get_width() / 2, bar.get_height() + std),
                   xytext=(0, 3), textcoords="offset points",
                   ha="center", va="bottom", fontsize=8, color="#333333");
    }

    plt.tight_layout();
    return fig_to_bytes(fig, fmt);
}

def evaluation_runs_chart(runs_data: list, title: str = "Evaluation Results", fmt: str = "svg") -> bytes {
    if not runs_data {
        return b"";
    }

    labels: list = [r.get("name", f"Run {i+1}") for (i, r) in enumerate(runs_data)];
    scores: list = [r.get("percentage", 0) for r in runs_data];

    avg: float = sum(scores) / len(scores) if scores else 0.0;
    std_dev: float = (sum((s - avg) ** 2 for s in scores) / len(scores)) ** 0.5 if len(scores) > 1 else 0.0;

    (fig, ax) = plt.subplots(figsize=(8, 5));
    x: any = np.arange(len(labels));
    colors: list = ["#4ade80" if s >= avg else "#f87171" for s in scores];
    bars: any = ax.bar(x, scores, color=colors, edgecolor="white", linewidth=0.5, alpha=0.9);

    ax.axhline(y=avg, color="#facc15", linestyle="--", linewidth=2, label=f"Mean: {avg:.1f}%");
    ax.fill_between([-0.5, len(labels) - 0.5], avg - std_dev, avg + std_dev,
                   color="#facc15", alpha=0.1, label=f"SD: {std_dev:.2f}");

    ax.set_ylabel("Score (%)", fontsize=11, fontweight="bold");
    ax.set_title(title, fontsize=14, fontweight="bold", pad=20);
    ax.set_xticks(x);
    ax.set_xticklabels([f"Run {i+1}" for i in range(len(labels))], fontsize=9);
    ax.set_ylim(0, 100);
    ax.yaxis.grid(True, linestyle="--", alpha=0.7);
    ax.legend(loc="upper right", fontsize=9);

    for (bar, score_val) in zip(bars, scores) {
        ax.annotate(f"{score_val:.1f}%",
                   xy=(bar.get_x() + bar.get_width() / 2, bar.get_height()),
                   xytext=(0, 3), textcoords="offset points",
                   ha="center", va="bottom", fontsize=9, color="#333333", fontweight="bold");
    }

    plt.tight_layout();
    return fig_to_bytes(fig, fmt);
}

def comparison_chart(stash1: dict, stash2: dict, categories: list, fmt: str = "svg") -> bytes {
    if not stash1 or not stash2 {
        return b"";
    }

    (fig, axes) = plt.subplots(1, 2, figsize=(14, 6));

    ax1: any = axes[0];
    names: list = [stash1.get("name", "Stash 1")[:20], stash2.get("name", "Stash 2")[:20]];
    avgs: list = [stash1.get("average_score", 0), stash2.get("average_score", 0)];
    stds: list = [stash1.get("std_dev", 0), stash2.get("std_dev", 0)];

    x: any = np.arange(2);
    colors: list = ["#60a5fa", "#4ade80"];
    bars: any = ax1.bar(x, avgs, yerr=stds, capsize=5, color=colors, edgecolor="white", linewidth=0.5, alpha=0.9);

    ax1.set_ylabel("Score (%)", fontsize=11, fontweight="bold");
    ax1.set_title("Overall Comparison", fontsize=12, fontweight="bold", pad=15);
    ax1.set_xticks(x);
    ax1.set_xticklabels(names, fontsize=10);
    ax1.set_ylim(0, 100);
    ax1.yaxis.grid(True, linestyle="--", alpha=0.7);

    for (bar, score_val, std) in zip(bars, avgs, stds) {
        label: str = f"{score_val:.1f}%\n(SD: {std:.1f})";
        ax1.annotate(label,
                    xy=(bar.get_x() + bar.get_width() / 2, bar.get_height() + std),
                    xytext=(0, 5), textcoords="offset points",
                    ha="center", va="bottom", fontsize=9, color="#333333");
    }

    ax2: any = axes[1];
    if categories {
        top_cats: list = categories[:8];
        cat_scores1: list = [stash1.get("category_averages", {}).get(c, 0) for c in top_cats];
        cat_scores2: list = [stash2.get("category_averages", {}).get(c, 0) for c in top_cats];

        x = np.arange(len(top_cats));
        width: float = 0.35;

        ax2.bar(x - width/2, cat_scores1, width, label=names[0], color="#60a5fa", alpha=0.9);
        ax2.bar(x + width/2, cat_scores2, width, label=names[1], color="#4ade80", alpha=0.9);

        ax2.set_ylabel("Score (%)", fontsize=11, fontweight="bold");
        ax2.set_title("Category Comparison", fontsize=12, fontweight="bold", pad=15);
        ax2.set_xticks(x);
        ax2.set_xticklabels([c[:12] for c in top_cats], rotation=45, ha="right", fontsize=8);
        ax2.set_ylim(0, 100);
        ax2.yaxis.grid(True, linestyle="--", alpha=0.7);
        ax2.legend(loc="upper right", fontsize=9);
    }

    plt.tight_layout();
    return fig_to_bytes(fig, fmt);
}
