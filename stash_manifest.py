#!/usr/bin/env python3
"""
Stash manifest generator - creates metadata files for stashed results
"""

import json
from pathlib import Path
from typing import Dict, List, Set, Any, Optional
from datetime import datetime


MANIFEST_FILENAME = "_stash_metadata.json"


def extract_file_metadata(file_path: Path) -> Optional[Dict[str, Any]]:
    """Extract metadata from a benchmark result file"""
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
            return data.get('metadata', {})
    except Exception as e:
        print(f"Warning: Could not extract metadata from {file_path}: {e}")
        return None


def generate_stash_manifest(stash_dir: Path) -> Dict[str, Any]:
    """
    Generate manifest file for a stash directory.
    Aggregates metadata from all test files.
    """
    test_files = list(stash_dir.glob('*.txt'))

    if not test_files:
        return {
            'error': 'No test files found',
            'file_count': 0
        }

    # Parse timestamp from directory name (format: YYYYMMDD_HHMMSS)
    stash_timestamp = None
    dir_name = stash_dir.name
    if len(dir_name) == 15 and '_' in dir_name:
        try:
            stash_timestamp = datetime.strptime(dir_name, '%Y%m%d_%H%M%S').timestamp()
        except ValueError:
            pass

    # Collect all metadata
    models: Set[str] = set()
    model_aliases: Set[str] = set()
    variants: Set[str] = set()
    test_suites: Set[str] = set()
    total_tests_values: Set[int] = set()

    file_metadata_list = []

    for test_file in test_files:
        metadata = extract_file_metadata(test_file)
        if metadata:
            models.add(metadata.get('model', 'unknown'))
            model_aliases.add(metadata.get('model_alias', 'unknown'))
            variants.add(metadata.get('variant', 'unknown'))
            test_suites.add(metadata.get('test_suite', 'unknown'))
            total_tests_values.add(metadata.get('total_tests', 0))

            file_metadata_list.append({
                'filename': test_file.name,
                'model': metadata.get('model'),
                'model_alias': metadata.get('model_alias'),
                'variant': metadata.get('variant'),
                'test_suite': metadata.get('test_suite'),
                'total_tests': metadata.get('total_tests'),
                'temperature': metadata.get('temperature'),
                'max_tokens': metadata.get('max_tokens')
            })

    # Determine display values
    def get_display_value(values: Set[str], label: str) -> str:
        """Return single value or 'Multi-X' if multiple"""
        values_clean = {v for v in values if v != 'unknown'}
        if len(values_clean) == 0:
            return 'Unknown'
        elif len(values_clean) == 1:
            return list(values_clean)[0]
        else:
            return f'Multi-{label}'

    def get_display_int_value(values: Set[int], label: str) -> str:
        """Return single value or 'Multi-X' if multiple"""
        values_clean = {v for v in values if v > 0}
        if len(values_clean) == 0:
            return 'Unknown'
        elif len(values_clean) == 1:
            return str(list(values_clean)[0])
        else:
            return f'Multi-{label}'

    manifest = {
        'stash_name': stash_dir.name,
        'stash_timestamp': stash_timestamp,
        'file_count': len(test_files),
        'display': {
            'model': get_display_value(model_aliases, 'Model'),
            'model_full': get_display_value(models, 'Model'),
            'variant': get_display_value(variants, 'Variant'),
            'test_suite': get_display_value(test_suites, 'Suite'),
            'total_tests': get_display_int_value(total_tests_values, 'Tests')
        },
        'all_values': {
            'models': sorted(list(models)),
            'model_aliases': sorted(list(model_aliases)),
            'variants': sorted(list(variants)),
            'test_suites': sorted(list(test_suites)),
            'total_tests': sorted(list(total_tests_values))
        },
        'files': file_metadata_list
    }

    # Save manifest
    manifest_path = stash_dir / MANIFEST_FILENAME
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"Generated manifest for {stash_dir.name}: {manifest['display']}")
    return manifest


def read_stash_manifest(stash_dir: Path) -> Optional[Dict[str, Any]]:
    """Read existing manifest or generate if missing"""
    manifest_path = stash_dir / MANIFEST_FILENAME

    if manifest_path.exists():
        try:
            with open(manifest_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Could not read manifest from {manifest_path}: {e}")

    # Generate if missing
    return generate_stash_manifest(stash_dir)


def regenerate_all_manifests(tests_dir: Path = Path('tests')):
    """Regenerate manifests for all existing stashes"""
    excluded_dirs = {'reports', '__pycache__', '.git', '.vscode', 'failed_responses'}
    stash_dirs = [d for d in tests_dir.iterdir() if d.is_dir() and d.name not in excluded_dirs]

    print(f"Found {len(stash_dirs)} stash directories")

    for stash_dir in stash_dirs:
        generate_stash_manifest(stash_dir)

    print(f"✓ Regenerated {len(stash_dirs)} manifests")


if __name__ == '__main__':
    regenerate_all_manifests()
