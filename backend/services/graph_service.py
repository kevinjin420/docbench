"""Graph generation service using matplotlib"""
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from typing import Dict, List, Any, Optional


plt.rcParams.update({
    'font.size': 10,
    'font.family': 'sans-serif',
    'figure.figsize': (10, 6),
    'figure.dpi': 150,
    'axes.spines.top': False,
    'axes.spines.right': False,
    'axes.facecolor': '#ffffff',
    'figure.facecolor': '#ffffff',
    'text.color': '#333333',
    'axes.labelcolor': '#333333',
    'axes.edgecolor': '#cccccc',
    'xtick.color': '#333333',
    'ytick.color': '#333333',
    'grid.color': '#e0e0e0',
    'grid.alpha': 0.5
})


class GraphService:
    """Service for generating publication-quality graphs"""

    @staticmethod
    def _fig_to_bytes(fig, fmt: str = 'svg') -> bytes:
        buf = io.BytesIO()
        fig.savefig(buf, format=fmt, bbox_inches='tight', facecolor=fig.get_facecolor(), dpi=300)
        plt.close(fig)
        buf.seek(0)
        return buf.getvalue()

    @staticmethod
    def _fig_to_svg(fig) -> str:
        return GraphService._fig_to_bytes(fig, 'svg').decode('utf-8')

    @staticmethod
    def collections_bar_chart(collections_data: List[Dict[str, Any]], fmt: str = 'svg') -> bytes:
        """Generate bar chart of all collections sorted by model + variant"""
        if not collections_data:
            return b""

        sorted_data = sorted(collections_data, key=lambda x: (
            x.get('model', ''),
            x.get('variant', ''),
            -x.get('average_score', 0)
        ))

        labels = []
        scores = []
        std_devs = []
        colors = []

        color_map = {}
        color_palette = ['#4ade80', '#60a5fa', '#f472b6', '#facc15', '#a78bfa', '#fb923c', '#22d3d8']
        color_idx = 0

        for item in sorted_data:
            model = item.get('model', 'Unknown')
            variant = item.get('variant', '')
            name = item.get('name', '')

            short_label = f"{model[:15]}\n{variant[:10]}" if variant else model[:15]
            labels.append(short_label)
            scores.append(item.get('average_score', 0))
            std_devs.append(item.get('std_dev', 0))

            if model not in color_map:
                color_map[model] = color_palette[color_idx % len(color_palette)]
                color_idx += 1
            colors.append(color_map[model])

        fig, ax = plt.subplots(figsize=(max(10, len(labels) * 0.8), 6))

        x = np.arange(len(labels))
        bars = ax.bar(x, scores, yerr=std_devs, capsize=3, color=colors, edgecolor='white', linewidth=0.5, alpha=0.9)

        ax.set_ylabel('Score (%)', fontsize=11, fontweight='bold')
        ax.set_xlabel('Model / Variant', fontsize=11, fontweight='bold')
        ax.set_title('Benchmark Results by Model', fontsize=14, fontweight='bold', pad=20)
        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=45, ha='right', fontsize=8)
        ax.set_ylim(0, 100)
        ax.yaxis.grid(True, linestyle='--', alpha=0.7)

        for bar, score, std in zip(bars, scores, std_devs):
            ax.annotate(f'{score:.1f}',
                       xy=(bar.get_x() + bar.get_width() / 2, bar.get_height() + std),
                       xytext=(0, 3), textcoords='offset points',
                       ha='center', va='bottom', fontsize=8, color='#333333')

        plt.tight_layout()
        return GraphService._fig_to_bytes(fig, fmt)

    @staticmethod
    def evaluation_runs_chart(runs_data: List[Dict[str, Any]], title: str = "Evaluation Results", fmt: str = 'svg') -> bytes:
        """Generate chart showing individual test runs"""
        if not runs_data:
            return b""

        labels = [r.get('name', f'Run {i+1}') for i, r in enumerate(runs_data)]
        scores = [r.get('percentage', 0) for r in runs_data]

        avg = sum(scores) / len(scores) if scores else 0
        std_dev = (sum((s - avg) ** 2 for s in scores) / len(scores)) ** 0.5 if len(scores) > 1 else 0

        fig, ax = plt.subplots(figsize=(8, 5))

        x = np.arange(len(labels))
        colors = ['#4ade80' if s >= avg else '#f87171' for s in scores]
        bars = ax.bar(x, scores, color=colors, edgecolor='white', linewidth=0.5, alpha=0.9)

        ax.axhline(y=avg, color='#facc15', linestyle='--', linewidth=2, label=f'Mean: {avg:.1f}%')
        ax.fill_between([-0.5, len(labels) - 0.5], avg - std_dev, avg + std_dev,
                       color='#facc15', alpha=0.1, label=f'SD: {std_dev:.2f}')

        ax.set_ylabel('Score (%)', fontsize=11, fontweight='bold')
        ax.set_title(title, fontsize=14, fontweight='bold', pad=20)
        ax.set_xticks(x)
        ax.set_xticklabels([f'Run {i+1}' for i in range(len(labels))], fontsize=9)
        ax.set_ylim(0, 100)
        ax.yaxis.grid(True, linestyle='--', alpha=0.7)
        ax.legend(loc='upper right', fontsize=9)

        for bar, score in zip(bars, scores):
            ax.annotate(f'{score:.1f}%',
                       xy=(bar.get_x() + bar.get_width() / 2, bar.get_height()),
                       xytext=(0, 3), textcoords='offset points',
                       ha='center', va='bottom', fontsize=9, color='#333333', fontweight='bold')

        plt.tight_layout()
        return GraphService._fig_to_bytes(fig, fmt)

    @staticmethod
    def comparison_chart(stash1: Dict[str, Any], stash2: Dict[str, Any],
                        categories: List[str], fmt: str = 'svg') -> bytes:
        """Generate comparison chart between two stashes"""
        if not stash1 or not stash2:
            return b""

        fig, axes = plt.subplots(1, 2, figsize=(14, 6))

        # Left: Overall comparison
        ax1 = axes[0]
        names = [stash1.get('name', 'Stash 1')[:20], stash2.get('name', 'Stash 2')[:20]]
        avgs = [stash1.get('average_score', 0), stash2.get('average_score', 0)]
        stds = [stash1.get('std_dev', 0), stash2.get('std_dev', 0)]

        x = np.arange(2)
        colors = ['#60a5fa', '#4ade80']
        bars = ax1.bar(x, avgs, yerr=stds, capsize=5, color=colors, edgecolor='white', linewidth=0.5, alpha=0.9)

        ax1.set_ylabel('Score (%)', fontsize=11, fontweight='bold')
        ax1.set_title('Overall Comparison', fontsize=12, fontweight='bold', pad=15)
        ax1.set_xticks(x)
        ax1.set_xticklabels(names, fontsize=10)
        ax1.set_ylim(0, 100)
        ax1.yaxis.grid(True, linestyle='--', alpha=0.7)

        for bar, score, std in zip(bars, avgs, stds):
            label = f'{score:.1f}%\n(SD: {std:.1f})'
            ax1.annotate(label,
                       xy=(bar.get_x() + bar.get_width() / 2, bar.get_height() + std),
                       xytext=(0, 5), textcoords='offset points',
                       ha='center', va='bottom', fontsize=9, color='#333333')

        # Right: Category comparison
        ax2 = axes[1]
        if categories:
            top_cats = categories[:8]
            cat_scores1 = [stash1.get('category_averages', {}).get(c, 0) for c in top_cats]
            cat_scores2 = [stash2.get('category_averages', {}).get(c, 0) for c in top_cats]

            x = np.arange(len(top_cats))
            width = 0.35

            bars1 = ax2.bar(x - width/2, cat_scores1, width, label=names[0], color='#60a5fa', alpha=0.9)
            bars2 = ax2.bar(x + width/2, cat_scores2, width, label=names[1], color='#4ade80', alpha=0.9)

            ax2.set_ylabel('Score (%)', fontsize=11, fontweight='bold')
            ax2.set_title('Category Comparison', fontsize=12, fontweight='bold', pad=15)
            ax2.set_xticks(x)
            ax2.set_xticklabels([c[:12] for c in top_cats], rotation=45, ha='right', fontsize=8)
            ax2.set_ylim(0, 100)
            ax2.yaxis.grid(True, linestyle='--', alpha=0.7)
            ax2.legend(loc='upper right', fontsize=9)

        plt.tight_layout()
        return GraphService._fig_to_bytes(fig, fmt)
