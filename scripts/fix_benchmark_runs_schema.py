#!/usr/bin/env python3
"""Fix benchmark_runs schema by dropping and recreating the table."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['AUTO_INIT_DB'] = 'false'

from database.models import (
    LocalBase, local_engine, BenchmarkRun, _get_local_db_url
)


def main():
    db_url = _get_local_db_url()
    print(f"Database URL: {db_url}")

    if '--dry-run' in sys.argv:
        print("\n[DRY RUN] Would drop and recreate benchmark_runs table")
        print("\nCurrent model columns:")
        for col in BenchmarkRun.__table__.columns:
            print(f"  - {col.name}: {col.type} (nullable={col.nullable})")
        return

    confirm = input("\nThis will DROP the benchmark_runs table and lose all data. Continue? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Aborted.")
        return

    print("\nDropping benchmark_runs table...")
    BenchmarkRun.__table__.drop(local_engine, checkfirst=True)

    print("Recreating benchmark_runs table with new schema...")
    BenchmarkRun.__table__.create(local_engine, checkfirst=True)

    print("\nDone! New schema:")
    for col in BenchmarkRun.__table__.columns:
        print(f"  - {col.name}: {col.type} (nullable={col.nullable})")


if __name__ == '__main__':
    main()
