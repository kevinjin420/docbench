#!/usr/bin/env python3
"""
Database migration to add baseline correction columns
Adds baseline_id, baseline_corrected_percentage, and learning_bonus to benchmark_results
"""
import os
from sqlalchemy import create_engine, text

def get_database_url():
    return os.getenv('DATABASE_URL', 'sqlite:///./benchmark.db')

def migrate():
    engine = create_engine(get_database_url())

    with engine.connect() as conn:
        print("Starting migration...")

        # Check if columns already exist
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='benchmark_results'
            AND column_name IN ('baseline_id', 'baseline_corrected_percentage', 'learning_bonus')
        """))
        existing_columns = [row[0] for row in result]

        if len(existing_columns) == 3:
            print("✓ All baseline columns already exist. No migration needed.")
            return

        print(f"Found {len(existing_columns)} existing columns: {existing_columns}")

        # Add baseline_id column if not exists
        if 'baseline_id' not in existing_columns:
            print("Adding baseline_id column...")
            conn.execute(text("""
                ALTER TABLE benchmark_results
                ADD COLUMN baseline_id INTEGER REFERENCES documentation_baselines(id)
            """))
            conn.execute(text("""
                CREATE INDEX idx_baseline_id ON benchmark_results(baseline_id)
            """))
            conn.commit()
            print("✓ Added baseline_id")

        # Add baseline_corrected_percentage column if not exists
        if 'baseline_corrected_percentage' not in existing_columns:
            print("Adding baseline_corrected_percentage column...")
            conn.execute(text("""
                ALTER TABLE benchmark_results
                ADD COLUMN baseline_corrected_percentage DOUBLE PRECISION
            """))
            conn.commit()
            print("✓ Added baseline_corrected_percentage")

        # Add learning_bonus column if not exists
        if 'learning_bonus' not in existing_columns:
            print("Adding learning_bonus column...")
            conn.execute(text("""
                ALTER TABLE benchmark_results
                ADD COLUMN learning_bonus DOUBLE PRECISION
            """))
            conn.commit()
            print("✓ Added learning_bonus")

        print("\n✓ Migration completed successfully!")
        print("\nNew columns added to benchmark_results:")
        print("  - baseline_id (INTEGER, FK to documentation_baselines)")
        print("  - baseline_corrected_percentage (DOUBLE PRECISION)")
        print("  - learning_bonus (DOUBLE PRECISION)")

if __name__ == '__main__':
    try:
        migrate()
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
