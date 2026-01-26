#!/usr/bin/env python3
"""
CLI for managing test definitions.

Usage:
    python scripts/test_manager.py list [--level N] [--category CAT] [--type TYPE]
    python scripts/test_manager.py get <test_id>
    python scripts/test_manager.py create --file test.json
    python scripts/test_manager.py update <test_id> --task "New task" --points 20
    python scripts/test_manager.py delete <test_id>
    python scripts/test_manager.py restore <test_id>
    python scripts/test_manager.py export > backup.json
    python scripts/test_manager.py stats
    python scripts/test_manager.py search <query>
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import TestDefinitionService, init_public_db


def cmd_list(args):
    """List tests with optional filters."""
    init_public_db()

    if args.level:
        tests = TestDefinitionService.get_by_level(args.level, include_inactive=args.include_inactive)
    elif args.category:
        tests = TestDefinitionService.get_by_category(args.category, include_inactive=args.include_inactive)
    else:
        tests = TestDefinitionService.get_all_full(include_inactive=args.include_inactive)

    if args.type:
        tests = [t for t in tests if t.get('type', 'generate') == args.type]

    if not tests:
        print("No tests found matching criteria.")
        return

    print(f"Found {len(tests)} tests:\n")
    for test in tests:
        status = '' if test.get('is_active', True) else ' [INACTIVE]'
        test_type = test.get('type', 'generate')
        print(f"  {test['id']:30} L{test['level']:2} {test['category']:20} {test['points']:3}pts ({test_type}){status}")


def cmd_get(args):
    """Get a single test definition."""
    init_public_db()

    test = TestDefinitionService.get_by_test_id(args.test_id)
    if not test:
        print(f"Test not found: {args.test_id}")
        sys.exit(1)

    print(json.dumps(test, indent=2))


def cmd_create(args):
    """Create a new test from JSON file."""
    init_public_db()

    with open(args.file, 'r') as f:
        data = json.load(f)

    if isinstance(data, list):
        result = TestDefinitionService.bulk_create(data)
        print(f"Created: {result['created']}, Skipped: {result['skipped']}")
        if result['errors']:
            for error in result['errors']:
                print(f"  Error: {error}")
    else:
        try:
            test = TestDefinitionService.create(
                test_id=data['id'],
                level=data['level'],
                category=data['category'],
                task=data['task'],
                required_elements=data['required_elements'],
                points=data.get('points', 10),
                test_type=data.get('type', 'generate'),
                forbidden_elements=data.get('forbidden_elements'),
                broken_code=data.get('broken_code'),
                partial_code=data.get('partial_code'),
                python_code=data.get('python_code'),
                test_harness=data.get('test_harness'),
                error_hint=data.get('error_hint'),
                completion_hint=data.get('completion_hint')
            )
            print(f"Created test: {test['id']}")
        except ValueError as e:
            print(f"Error: {e}")
            sys.exit(1)


def cmd_update(args):
    """Update a test definition."""
    init_public_db()

    update_data = {}
    if args.task:
        update_data['task'] = args.task
    if args.points is not None:
        update_data['points'] = args.points
    if args.level is not None:
        update_data['level'] = args.level
    if args.category:
        update_data['category'] = args.category

    if not update_data:
        print("No fields to update. Use --task, --points, --level, or --category")
        sys.exit(1)

    result = TestDefinitionService.update(args.test_id, **update_data)
    if result:
        print(f"Updated test: {args.test_id}")
        print(json.dumps(result, indent=2))
    else:
        print(f"Test not found: {args.test_id}")
        sys.exit(1)


def cmd_delete(args):
    """Soft delete a test definition."""
    init_public_db()

    if args.hard:
        success = TestDefinitionService.hard_delete(args.test_id)
        action = "permanently deleted"
    else:
        success = TestDefinitionService.delete(args.test_id)
        action = "deactivated"

    if success:
        print(f"Test {action}: {args.test_id}")
    else:
        print(f"Test not found: {args.test_id}")
        sys.exit(1)


def cmd_restore(args):
    """Restore a soft-deleted test."""
    init_public_db()

    success = TestDefinitionService.restore(args.test_id)
    if success:
        print(f"Test restored: {args.test_id}")
    else:
        print(f"Test not found: {args.test_id}")
        sys.exit(1)


def cmd_export(args):
    """Export all tests to JSON."""
    init_public_db()

    tests = TestDefinitionService.export_all()
    print(json.dumps(tests, indent=2))


def cmd_stats(args):
    """Show test statistics."""
    init_public_db()

    stats = TestDefinitionService.get_stats()

    print("Test Definition Statistics")
    print("=" * 40)
    print(f"Total active tests: {stats['total_tests']}")
    print(f"Inactive tests: {stats['inactive_tests']}")
    print(f"Total points: {stats['total_points']}")

    print("\nBy Level:")
    for level, data in sorted(stats['by_level'].items()):
        print(f"  Level {level}: {data['count']} tests, {data['points']} points")

    print("\nBy Category:")
    for category, data in sorted(stats['by_category'].items()):
        print(f"  {category}: {data['count']} tests, {data['points']} points")

    print("\nBy Type:")
    for test_type, count in sorted(stats['by_type'].items()):
        print(f"  {test_type}: {count} tests")


def cmd_search(args):
    """Search tests by query."""
    init_public_db()

    tests = TestDefinitionService.search(args.query, include_inactive=args.include_inactive)

    if not tests:
        print(f"No tests found matching: {args.query}")
        return

    print(f"Found {len(tests)} tests matching '{args.query}':\n")
    for test in tests:
        status = '' if test.get('is_active', True) else ' [INACTIVE]'
        print(f"  {test['id']:30} L{test['level']:2} {test['category']:20}{status}")
        print(f"    Task: {test['task'][:60]}...")


def main():
    parser = argparse.ArgumentParser(description='Test Definition Manager')
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # list
    list_parser = subparsers.add_parser('list', help='List tests')
    list_parser.add_argument('--level', type=int, help='Filter by level')
    list_parser.add_argument('--category', help='Filter by category')
    list_parser.add_argument('--type', help='Filter by test type')
    list_parser.add_argument('--include-inactive', action='store_true', help='Include inactive tests')
    list_parser.set_defaults(func=cmd_list)

    # get
    get_parser = subparsers.add_parser('get', help='Get a test by ID')
    get_parser.add_argument('test_id', help='Test ID')
    get_parser.set_defaults(func=cmd_get)

    # create
    create_parser = subparsers.add_parser('create', help='Create test(s) from JSON file')
    create_parser.add_argument('--file', '-f', required=True, help='JSON file with test definition(s)')
    create_parser.set_defaults(func=cmd_create)

    # update
    update_parser = subparsers.add_parser('update', help='Update a test')
    update_parser.add_argument('test_id', help='Test ID to update')
    update_parser.add_argument('--task', help='New task description')
    update_parser.add_argument('--points', type=int, help='New points value')
    update_parser.add_argument('--level', type=int, help='New level')
    update_parser.add_argument('--category', help='New category')
    update_parser.set_defaults(func=cmd_update)

    # delete
    delete_parser = subparsers.add_parser('delete', help='Delete a test (soft delete by default)')
    delete_parser.add_argument('test_id', help='Test ID to delete')
    delete_parser.add_argument('--hard', action='store_true', help='Permanently delete')
    delete_parser.set_defaults(func=cmd_delete)

    # restore
    restore_parser = subparsers.add_parser('restore', help='Restore a deleted test')
    restore_parser.add_argument('test_id', help='Test ID to restore')
    restore_parser.set_defaults(func=cmd_restore)

    # export
    export_parser = subparsers.add_parser('export', help='Export all tests to JSON')
    export_parser.set_defaults(func=cmd_export)

    # stats
    stats_parser = subparsers.add_parser('stats', help='Show statistics')
    stats_parser.set_defaults(func=cmd_stats)

    # search
    search_parser = subparsers.add_parser('search', help='Search tests')
    search_parser.add_argument('query', help='Search query')
    search_parser.add_argument('--include-inactive', action='store_true', help='Include inactive tests')
    search_parser.set_defaults(func=cmd_search)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == '__main__':
    main()
