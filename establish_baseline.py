#!/usr/bin/env python3
"""
Script to establish baselines for model+documentation combinations.

Usage:
    python establish_baseline.py claude-sonnet-4.5 mini_v3
    python establish_baseline.py --list
"""

import sys
import argparse

from backend.services.baseline_service import BaselineService


def main():
    parser = argparse.ArgumentParser(description='Establish documentation baselines')
    parser.add_argument('model', nargs='?', help='Model identifier (e.g., claude-sonnet-4.5)')
    parser.add_argument('documentation', nargs='?', help='Documentation variant (e.g., mini_v3)')
    parser.add_argument('--list', action='store_true', help='List all active baselines')
    parser.add_argument('--temperature', type=float, default=0.1, help='Temperature (default: 0.1)')

    args = parser.parse_args()

    if args.list:
        print("\nActive Baselines:")
        print("=" * 95)
        baselines = BaselineService.list_baselines()

        if not baselines:
            print("No baselines found")
            return

        print(f"{'ID':<5} {'Model':<25} {'Doc Variant':<20} {'Baseline %':<12} {'Created':<20}")
        print("-" * 95)

        from datetime import datetime
        for b in baselines:
            created = datetime.fromtimestamp(b['created_at']).strftime('%Y-%m-%d %H:%M')
            print(f"{b['id']:<5} {b['model']:<25} {b['documentation_variant']:<20} "
                  f"{b['baseline_percentage']:<12.1f} {created:<20}")

        print()
        return

    if not args.model or not args.documentation:
        parser.print_help()
        sys.exit(1)

    print(f"\nEstablishing baseline for {args.model} + {args.documentation}")
    print("=" * 60)
    print(f"Temperature: {args.temperature}")
    print(f"Batch size: 1 (baseline)")
    print("=" * 60)
    print()

    try:
        result = BaselineService.establish_baseline(
            model=args.model,
            doc_variant=args.documentation,
            temperature=args.temperature
        )

        print()
        print("✓ Baseline established successfully!")
        print()
        print(f"Baseline ID: {result['baseline_id']}")
        print(f"Baseline percentage: {result['baseline_percentage']:.1f}%")
        print(f"Run ID: {result['run_id']}")
        print()
        print("This baseline will be automatically used for all future evaluations")
        print(f"of {args.model} + {args.documentation}")
        print()

    except Exception as e:
        print(f"\n✗ Error: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
