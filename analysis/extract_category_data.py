#!/usr/bin/env python3
"""
Extract category-by-category data for all collections to analyze batch size effects
"""

import csv
import json
import os
import sys
from collections import defaultdict
import statistics

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ['AUTO_INIT_DB'] = 'false'
os.environ['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5432/jaseci_benchmark'

from database import BenchmarkResultService


def extract_category_data():
    csv_path = os.path.expanduser('~/Downloads/collections-export-2025-11-24.csv')

    collections = set()
    collection_batch_sizes = {}

    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            coll_name = row['collection']
            collections.add(coll_name)
            collection_batch_sizes[coll_name] = int(row['batch_size'])

    print(f"Found {len(collections)} unique collections")
    print(f"Batch sizes: {sorted(set(collection_batch_sizes.values()))}")
    print()

    all_data = {}

    for coll_name in sorted(collections):
        batch_size = collection_batch_sizes[coll_name]
        results = BenchmarkResultService.get_collection_results(coll_name)

        if not results:
            print(f"No results found for {coll_name}")
            continue

        category_scores = defaultdict(list)
        overall_scores = []

        for result in results:
            eval_results = result.get('evaluation_results', {})
            if not eval_results:
                continue

            overall_scores.append(result.get('percentage', 0))

            breakdown = eval_results.get('category_breakdown', {})
            for category, cat_data in breakdown.items():
                category_scores[category].append(cat_data.get('percentage', 0))

        if not overall_scores:
            continue

        coll_data = {
            'collection': coll_name,
            'batch_size': batch_size,
            'num_runs': len(overall_scores),
            'overall_mean': statistics.mean(overall_scores),
            'overall_std': statistics.stdev(overall_scores) if len(overall_scores) > 1 else 0,
            'categories': {}
        }

        for category, scores in category_scores.items():
            coll_data['categories'][category] = {
                'mean': statistics.mean(scores),
                'std': statistics.stdev(scores) if len(scores) > 1 else 0,
                'min': min(scores),
                'max': max(scores),
                'count': len(scores)
            }

        all_data[coll_name] = coll_data
        print(f"Collection: {coll_name} (batch_size={batch_size}, n={len(overall_scores)})")
        print(f"  Overall: {coll_data['overall_mean']:.2f}% (SD: {coll_data['overall_std']:.2f})")

    print("\n" + "="*80)
    print("CATEGORY ANALYSIS BY BATCH SIZE")
    print("="*80)

    batch_category_data = defaultdict(lambda: defaultdict(list))
    batch_overall = defaultdict(list)

    for coll_name, data in all_data.items():
        batch_size = data['batch_size']
        batch_overall[batch_size].append(data['overall_mean'])

        for category, cat_data in data['categories'].items():
            batch_category_data[batch_size][category].append(cat_data['mean'])

    all_categories = set()
    for batch_data in batch_category_data.values():
        all_categories.update(batch_data.keys())
    all_categories = sorted(all_categories)

    print("\nOverall Performance by Batch Size:")
    print("-" * 50)
    batch_sizes = sorted(batch_overall.keys())
    for bs in batch_sizes:
        scores = batch_overall[bs]
        mean = statistics.mean(scores)
        std = statistics.stdev(scores) if len(scores) > 1 else 0
        print(f"  Batch {bs:3d}: {mean:5.2f}% (SD: {std:4.2f}, n={len(scores)})")

    print("\n\nCategory Performance by Batch Size:")
    print("-" * 80)

    category_variance = {}
    for category in all_categories:
        means_by_batch = []
        for bs in batch_sizes:
            if category in batch_category_data[bs]:
                means_by_batch.append(statistics.mean(batch_category_data[bs][category]))
        if len(means_by_batch) > 1:
            category_variance[category] = statistics.stdev(means_by_batch)
        else:
            category_variance[category] = 0

    sorted_categories = sorted(all_categories, key=lambda c: category_variance.get(c, 0), reverse=True)

    header = f"{'Category':<30} | " + " | ".join([f"B={bs:2d}" for bs in batch_sizes]) + " | Variance"
    print(header)
    print("-" * len(header))

    for category in sorted_categories:
        row = f"{category:<30} | "
        means = []
        for bs in batch_sizes:
            if category in batch_category_data[bs]:
                scores = batch_category_data[bs][category]
                mean = statistics.mean(scores)
                means.append(mean)
                row += f"{mean:5.1f} | "
            else:
                row += "  N/A | "

        variance = category_variance.get(category, 0)
        row += f"{variance:5.2f}"
        print(row)

    output_data = {
        'batch_sizes': batch_sizes,
        'overall_by_batch': {bs: {
            'mean': statistics.mean(scores),
            'std': statistics.stdev(scores) if len(scores) > 1 else 0,
            'n': len(scores)
        } for bs, scores in batch_overall.items()},
        'categories_by_batch': {
            bs: {
                cat: {
                    'mean': statistics.mean(scores),
                    'std': statistics.stdev(scores) if len(scores) > 1 else 0,
                    'n': len(scores)
                }
                for cat, scores in cat_data.items()
            }
            for bs, cat_data in batch_category_data.items()
        },
        'category_variance': category_variance
    }

    output_path = os.path.join(os.path.dirname(__file__), 'category_batch_analysis.json')
    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2)
    print(f"\nData saved to {output_path}")

    csv_output_path = os.path.join(os.path.dirname(__file__), 'category_batch_analysis.csv')
    with open(csv_output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        header = ['category'] + [f'batch_{bs}_mean' for bs in batch_sizes] + [f'batch_{bs}_std' for bs in batch_sizes] + ['variance_across_batches']
        writer.writerow(header)

        for category in sorted_categories:
            row = [category]
            for bs in batch_sizes:
                if category in batch_category_data[bs]:
                    row.append(round(statistics.mean(batch_category_data[bs][category]), 2))
                else:
                    row.append('')
            for bs in batch_sizes:
                if category in batch_category_data[bs]:
                    scores = batch_category_data[bs][category]
                    row.append(round(statistics.stdev(scores), 2) if len(scores) > 1 else 0)
                else:
                    row.append('')
            row.append(round(category_variance.get(category, 0), 2))
            writer.writerow(row)
    print(f"CSV saved to {csv_output_path}")


if __name__ == '__main__':
    extract_category_data()
