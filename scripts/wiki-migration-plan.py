#!/usr/bin/env python3
"""Read-only inventory for the first SVJ wiki migration. Prints metadata, never note text."""
import argparse
import hashlib
import json
from pathlib import Path
import re

NOTES = ('casova-osa.md', 'opravy.md', 'stanovy.md')
CITE = re.compile(r'\[(S[0-9a-f]{10}), s\. (\d+)\]\(([^\s)]+)\)')


def inventory(root: Path) -> dict:
    root = root.resolve(strict=True)
    manifest = {item['id']: item for item in json.loads((root / 'manifest.json').read_text())}
    notes, sources = [], {}
    for name in NOTES:
        path = root / 'wiki' / name
        if path.resolve(strict=True) != path:
            raise ValueError(f'Unexpected link: {name}')
        data = path.read_bytes()
        citations, blocked = set(), set()
        for sid, number, _ in CITE.findall(data.decode('utf-8')):
            item = manifest.get(sid)
            page = int(number)
            if not item or item.get('private') is not False or item.get('ext') != '.pdf' or not 1 <= page <= item.get('sections', 0):
                blocked.add(sid)
                continue
            pdf = (root / 'raw' / item['name']).resolve(strict=True)
            if not pdf.is_relative_to(root / 'raw'):
                raise ValueError(f'PDF outside vault: {sid}')
            if sid not in sources:
                with pdf.open('rb') as stream:
                    digest = hashlib.file_digest(stream, 'sha256').hexdigest()
                if digest != item['sha']:
                    raise ValueError(f'PDF digest mismatch: {sid}')
                sources[sid] = digest
            citations.add((sid, page))
        notes.append({'name': name, 'sha256': hashlib.sha256(data).hexdigest(), 'citations': sorted(citations), 'blocked_ids': sorted(blocked), 'state':'needs_review_and_archive_mapping'})
    return {'mode': 'dry-run', 'notes': notes, 'verified_pdf_hashes': dict(sorted(sources.items()))}


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('vault', type=Path)
    print(json.dumps(inventory(cli.parse_args().vault), ensure_ascii=False, indent=2))
