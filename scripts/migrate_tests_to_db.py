#!/usr/bin/env python3
"""
Migration script to import tests.json into the database.

Usage:
    python scripts/migrate_tests_to_db.py           # Migrate tests.json
    python scripts/migrate_tests_to_db.py --dry-run # Preview only
    python scripts/migrate_tests_to_db.py --force   # Overwrite existing
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import TestDefinitionService, init_public_db


def load_tests_json(filepath: str) -> list:
    """Load tests from JSON file."""
    with open(filepath, 'r') as f:
        return json.load(f)


def migrate(tests_file: str, dry_run: bool = False, force: bool = False):
    """Migrate tests from JSON file to database."""
    print(f"Loading tests from {tests_file}...")
    tests = load_tests_json(tests_file)
    print(f"Found {len(tests)} tests in file")

    if dry_run:
        print("\n[DRY RUN] Would migrate the following tests:")
        for level in sorted(set(t['level'] for t in tests)):
            level_tests = [t for t in tests if t['level'] == level]
            print(f"  Level {level}: {len(level_tests)} tests")

        categories = sorted(set(t['category'] for t in tests))
        print(f"\nCategories: {', '.join(categories)}")

        types = sorted(set(t.get('type', 'generate') for t in tests))
        print(f"Test types: {', '.join(types)}")

        total_points = sum(t.get('points', 10) for t in tests)
        print(f"\nTotal points: {total_points}")
        return

    print("\nInitializing database...")
    init_public_db()

    if force:
        print("Force mode: checking for existing tests...")
        existing = TestDefinitionService.get_all(include_inactive=True)
        if existing:
            print(f"Found {len(existing)} existing tests. Deleting...")
            from database import get_public_db, TestDefinition
            with get_public_db() as session:
                session.query(TestDefinition).delete()
            print("Existing tests deleted.")

    print("\nMigrating tests to database...")
    result = TestDefinitionService.bulk_create(tests)

    print(f"\nMigration complete:")
    print(f"  Created: {result['created']}")
    print(f"  Skipped (already exist): {result['skipped']}")
    if result['errors']:
        print(f"  Errors: {len(result['errors'])}")
        for error in result['errors'][:5]:
            print(f"    - {error}")
        if len(result['errors']) > 5:
            print(f"    ... and {len(result['errors']) - 5} more errors")

    stats = TestDefinitionService.get_stats()
    print(f"\nDatabase now contains:")
    print(f"  Total tests: {stats['total_tests']}")
    print(f"  Total points: {stats['total_points']}")
    level_strs = [f"L{k}({v['count']})" for k, v in sorted(stats['by_level'].items())]
    print(f"  Levels: {', '.join(level_strs)}")


def main():
    parser = argparse.ArgumentParser(description='Migrate tests.json to database')
    parser.add_argument('--tests-file', default='tests.json',
                        help='Path to tests.json file (default: tests.json)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview migration without making changes')
    parser.add_argument('--force', action='store_true',
                        help='Delete existing tests and reimport')
    args = parser.parse_args()

    if not os.path.exists(args.tests_file):
        print(f"Error: Tests file not found: {args.tests_file}")
        sys.exit(1)

    migrate(args.tests_file, dry_run=args.dry_run, force=args.force)


if __name__ == '__main__':
    main()
