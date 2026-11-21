#!/usr/bin/env python3
"""Check that the synthetic artifact does not contain the real backend client.
Prints only checks/counts, never artifact contents or configuration values.
"""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
artifact = root / 'dist-fixtures'
files = sorted(artifact.rglob('*.js'))
assert files, 'Build local-fixtures first'
for path in files:
    content = path.read_bytes()
    for forbidden in (b'.supabase.co', b'ai.gateway.lovable.dev', b'SupabaseClient', b'supabase.auth.token', b'publishableKey'):
        assert forbidden not in content, 'Real backend marker detected in synthetic artifact'
assert not list(artifact.rglob('*.map')), 'Unexpected source map in synthetic artifact'
assert not any(path.name.startswith('App-') for path in files), 'Unexpected real application entry chunk'
assert any(path.name.startswith('LocalFixtureApp-') for path in files), 'Fixture entry missing'
print(json.dumps({'artifact': 'dist-fixtures', 'javascript_files_checked': len(files), 'backend_marker_check': 'passed', 'source_maps': False}))
