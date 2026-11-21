#!/usr/bin/env python3
"""Batch importer for the private file wiki of ONE SVJ: explicit allowlist in, immutable release out.

Usage:
  wiki-release-import.py --root NOTES --allowlist approved.json --organization ORG_UUID            # dry-run (default)
  wiki-release-import.py --root NOTES --allowlist approved.json --organization ORG_UUID --write OUT [--release-id UUID]

* approved.json is a JSON array of exact NOTES-relative paths, e.g. ["Rada/Zápis A.md"]. No globs, no
  directories, no discovery: nothing outside the list is ever read.
* Notes keep their original bytes and relative paths, so [[wikilinks]] and relative [links](x.md) resolve
  in ask-house exactly like in the vault. Links to files outside the allowlist simply stay unresolved.
* Fails closed (exit 2, nothing on stdout) on any invalid/duplicate path, symlink, hardlink, non-UTF-8 file,
  oversized file/batch, or private marker (export: false, local-only, personal list). Errors are fixed codes
  plus the allowlist index; paths and note content are never printed.
* Emits release format v2: up to 256 notes plus a derived term index (index/NN.json shards) whose digests
  are in manifest.json, so the index is bound to the release digest activated in the database. The index
  only selects which originals ask-house reads; it is never shown or cited.
* Dry-run prints counts and the manifest digest only. --write stages a fresh local directory laid out like
  the `svj-wiki-releases` bucket (ORG/releases/RELEASE/...). There is no network code: uploading and
  activation are separate operator steps (docs/svj/15_SOUBOROVA_WIKI_RUNBOOK.md).
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import unicodedata
import uuid

# Mirrors supabase/functions/ask-house/file-wiki.ts (release format v2); keep in sync (both test suites pin the same values).
FILE_LIMIT = 65536  # per object: note, manifest and each index shard (= bucket file_size_limit)
MAX_FILES = 256
TOTAL_LIMIT = 8 * 1024 * 1024
MAX_SHARDS = 64
FORBIDDEN = set('\\%:#?[]|<>*')
UUID = re.compile(r'^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$')
WRITE_FLAGS = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('wiki_batch_preview', Path(__file__).with_name('wiki-batch-preview.py'))
preview = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(preview)


class Rejected(Exception):
    def __init__(self, reason, index=None):
        super().__init__(reason)
        self.reason, self.index = reason, index


def valid_path(path):
    """Same rules as validPath() in file-wiki.ts, plus no glob characters."""
    if not isinstance(path, str) or unicodedata.normalize('NFC', path) != path or not path.endswith('.md'):
        return False
    if len(path.encode('utf-8')) > 360:
        return False
    if any(c in FORBIDDEN or c == '�' or unicodedata.category(c).startswith('C') for c in path):
        return False
    return all(s and not s.startswith('.') and s == s.strip() and len(s.encode('utf-8')) <= 100 for s in path.split('/'))


def object_path(path):
    """Bucket object name of a note, identical to noteObjectPath() in file-wiki.ts."""
    return 'notes/' + '/'.join(s.encode('utf-8').hex() for s in path.split('/')) + '.md'


def load_allowlist(path):
    with open(path, 'rb') as stream:
        raw = stream.read(256 * 1024 + 1)
    if len(raw) > 256 * 1024:
        raise Rejected('allowlist_too_large')
    try:
        value = json.loads(raw.decode('utf-8'))
    except (UnicodeError, ValueError):
        raise Rejected('allowlist_invalid') from None
    if not isinstance(value, list) or not value or not all(isinstance(p, str) for p in value):
        raise Rejected('allowlist_invalid')
    if len(value) > MAX_FILES:
        raise Rejected('too_many_files')
    return value


def collect(root, paths):
    """Read every allowlisted note once; the returned bytes are exactly what gets hashed and staged."""
    seen, files, total = set(), [], 0
    root_fd = preview.open_root(root)
    try:
        for index, path in enumerate(paths):
            if not valid_path(path):
                raise Rejected('invalid_path', index)
            if path in seen:
                raise Rejected('duplicate_path', index)
            seen.add(path)
            if any(part.casefold() == preview.PERSONAL for part in path.split('/')):
                raise Rejected('personal_list', index)
            try:
                data = preview.read_note(root_fd, path)
            except preview.Rejected as error:
                raise Rejected(str(error), index) from None
            except OSError:
                raise Rejected('unsafe_or_unreadable_path', index) from None
            if not 1 <= len(data) <= FILE_LIMIT:
                raise Rejected('file_size', index)
            try:
                text = data.decode('utf-8')
            except UnicodeError:
                raise Rejected('invalid_utf8', index) from None
            reason = preview.metadata_reason(text)
            if reason:
                raise Rejected(reason, index)
            total += len(data)
            if total > TOTAL_LIMIT:
                raise Rejected('batch_too_large', index)
            files.append((path, data))
    finally:
        os.close(root_fd)
    files.sort(key=lambda f: f[0])
    return files


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


# ---- Derived term index: same as fnv1a / indexWords / indexShard / indexKey in file-wiki.ts.
# It only nominates candidate notes at query time; answers and citations are read from the originals.
def fnv1a(text):
    h = 0x811c9dc5
    for b in text.encode('utf-8'):
        h = ((h ^ b) * 0x01000193) & 0xffffffff
    return h


def index_words(text):
    """Folded words (lowercase, NFD, marks removed) of >= 3 code points; a word is [L|N][L|N|-]*."""
    folded = ''.join(c for c in unicodedata.normalize('NFD', text.lower()) if not unicodedata.category(c).startswith('M'))
    words, current = set(), []
    for c in folded + ' ':
        if unicodedata.category(c)[0] in 'LN' or (c == '-' and current):
            current.append(c)
        elif current:
            words.add(''.join(current))
            current = []
    return {w for w in words if len(w) >= 3}


def shard_of(word, shards):
    return fnv1a(word[:3]) % shards


def index_key(shard):
    return f'index/{shard:02x}.json'


def build_index(files):
    """Smallest power-of-two shard count whose every shard fits FILE_LIMIT; returns the shard blobs."""
    postings = {}
    for i, (path, data) in enumerate(files):
        for word in index_words(data.decode('utf-8') + '\n' + path):
            postings.setdefault(word, []).append(i)
    shards = 1
    while shards <= MAX_SHARDS:
        rows = [[] for _ in range(shards)]
        for word in sorted(postings):
            rows[shard_of(word, shards)].append([word, postings[word]])
        blobs = [compact({'version': 2, 'shard': i, 'words': r}) for i, r in enumerate(rows)]
        if all(len(b) <= FILE_LIMIT for b in blobs):
            return blobs
        shards *= 2
    raise Rejected('index_too_large')


def build_manifest(files, shards):
    manifest = compact({'version': 2, 'files': [{'path': p, 'sha256': hashlib.sha256(d).hexdigest(), 'bytes': len(d)} for p, d in files],
                        'index': {'shards': [{'sha256': hashlib.sha256(b).hexdigest(), 'bytes': len(b)} for b in shards]}})
    if len(manifest) > FILE_LIMIT:
        raise Rejected('manifest_too_large')
    return manifest


def write_new(path, data):
    fd = os.open(path, WRITE_FLAGS, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(data)


def stage(out, root, org, release, manifest, files, shards):
    out = Path(out)
    if os.path.lexists(out):
        raise Rejected('output_exists')
    real_out = os.path.join(os.path.realpath(out.parent), out.name)
    real_root = os.path.realpath(root)
    if os.path.commonpath([real_root, real_out]) == real_root:
        raise Rejected('output_inside_root')
    os.mkdir(real_out, 0o700)
    base = os.path.join(real_out, org, 'releases', release)
    os.makedirs(base, 0o700)
    write_new(os.path.join(base, 'manifest.json'), manifest)
    for path, data in files:
        target = os.path.join(base, *object_path(path).split('/'))
        os.makedirs(os.path.dirname(target), 0o700, exist_ok=True)
        write_new(target, data)
    os.mkdir(os.path.join(base, 'index'), 0o700)
    for i, blob in enumerate(shards):
        write_new(os.path.join(base, *index_key(i).split('/')), blob)
    return real_out


def main():
    cli = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    cli.add_argument('--root', required=True, type=Path, help='Notes root; allowlist paths are relative to it')
    cli.add_argument('--allowlist', required=True, type=Path, help='JSON array of exact relative .md paths')
    cli.add_argument('--organization', required=True, help='UUID of the single SVJ this release belongs to')
    mode = cli.add_mutually_exclusive_group()
    mode.add_argument('--dry-run', action='store_true', help='Default: read-only, prints counts and digest')
    mode.add_argument('--write', type=Path, metavar='OUT', help='Stage a NEW local directory outside --root')
    cli.add_argument('--release-id', help='Fresh UUID for the release (default: random); never reuse one')
    args = cli.parse_args()
    try:
        if not UUID.match(args.organization):
            raise Rejected('invalid_organization')
        if args.release_id is not None and (args.write is None or not UUID.match(args.release_id)):
            raise Rejected('invalid_release_id')
        try:
            paths = load_allowlist(args.allowlist)
            files = collect(args.root, paths)
        except OSError:
            raise Rejected('unsafe_or_unreadable_input') from None
        shards = build_index(files)
        manifest = build_manifest(files, shards)
        result = {'mode': 'dry-run', 'files': len(files), 'bytes': sum(len(d) for _, d in files), 'index_shards': len(shards),
                  'manifest_sha256': hashlib.sha256(manifest).hexdigest()}
        if args.write is not None:
            release = args.release_id or str(uuid.uuid4())
            try:
                directory = stage(args.write, args.root, args.organization, release, manifest, files, shards)
            except OSError:
                raise Rejected('output_unwritable') from None
            result.update(mode='staged', organization_id=args.organization, release_id=release, directory=directory,
                          activate_sql=f"select public.set_house_file_release('{args.organization}','{release}','{result['manifest_sha256']}');")
    except Rejected as error:
        print(json.dumps({'error': 'rejected', 'reason': error.reason, **({'entry': error.index} if error.index is not None else {})}), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=True))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
