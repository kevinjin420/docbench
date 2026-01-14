#!/usr/bin/env python3
"""
Script to configure which tests are in the public suite.

Usage:
    python scripts/configure_public_tests.py --levels 1 2 3
    python scripts/configure_public_tests.py --ids L1_entry_01 L1_vars_01
    python scripts/configure_public_tests.py --all-level 1
"""
import argparse
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import PublicTestConfigService

def load_tests():
    with open('tests.json', 'r') as f:
        return json.load(f)

def main():
    parser = argparse.ArgumentParser(description='Configure public test suite')
    parser.add_argument('--levels', type=int, nargs='+', help='Include all tests from these levels')
    parser.add_argument('--ids', nargs='+', help='Specific test IDs to include')
    parser.add_argument('--all-level', type=int, help='Include all tests up to and including this level')
    parser.add_argument('--list', action='store_true', help='List current public test configuration')
    parser.add_argument('--clear', action='store_true', help='Clear all public tests')
    args = parser.parse_args()

    if args.list:
        config = PublicTestConfigService.get_config()
        public_ids = [c['test_id'] for c in config if c['is_public']]
        print(f"Public tests ({len(public_ids)}):")
        for test_id in sorted(public_ids):
            print(f"  - {test_id}")
        return

    if args.clear:
        PublicTestConfigService.set_public_tests([])
        print("Cleared all public tests.")
        return

    tests = load_tests()
    test_ids = set()

    if args.levels:
        for test in tests:
            if test['level'] in args.levels:
                test_ids.add(test['id'])

    if args.all_level:
        for test in tests:
            if test['level'] <= args.all_level:
                test_ids.add(test['id'])

    if args.ids:
        test_ids.update(args.ids)

    if not test_ids:
        print("No tests specified. Use --levels, --ids, or --all-level")
        return

    test_ids = sorted(list(test_ids))
    PublicTestConfigService.set_public_tests(test_ids)

    print(f"Configured {len(test_ids)} public tests:")
    for test_id in test_ids[:10]:
        print(f"  - {test_id}")
    if len(test_ids) > 10:
        print(f"  ... and {len(test_ids) - 10} more")

if __name__ == '__main__':
    main()
