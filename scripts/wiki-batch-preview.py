#!/usr/bin/env python3
"""Metadata-only, read-only wiki batch preview; never an importer.

Usage: wiki-batch-preview.py VAULT [--dry-run] [--select wiki/note.md ...]
Only a conservative subset of YAML frontmatter is accepted: flat scalars and
flat lists (including tags). Unsupported/ambiguous metadata fails closed.
Candidates still require human privacy review and source/archive verification.
No manifest, linked source, backend, environment credential or note body is output.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat

MAX_BYTES = 1024 * 1024
FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK
PERSONAL = 'jednotky-a-podily.md'
LOCAL = re.compile(r'(?<![\w])local[-_]only(?![\w])', re.I)
KEY_VALUE = re.compile(r'([A-Za-z_][A-Za-z0-9_-]*):(?:\s+(.*)|\s*)$')


class Rejected(Exception):
    pass


def open_root(root):
    """Open each component without following links, including root ancestors."""
    absolute = os.path.abspath(os.fspath(root))
    fd = os.open('/', FLAGS | os.O_DIRECTORY)
    try:
        for component in Path(absolute).parts[1:]:
            child = os.open(component, FLAGS | os.O_DIRECTORY, dir_fd=fd)
            os.close(fd)
            fd = child
        return fd
    except BaseException:
        os.close(fd)
        raise


def valid_path(name):
    return (isinstance(name, str) and not any(ord(c) < 32 or ord(c) == 127 for c in name)
            and '\\' not in name and name.startswith('wiki/')
            and all(p not in ('', '.', '..') for p in name.split('/'))
            and name.endswith('.md'))


def metadata_reason(text):
    # Conservatively exclude local-only markers even outside frontmatter.
    if LOCAL.search(text):
        return 'local_only'
    lines = text.lstrip('\ufeff').splitlines()
    if not lines or lines[0] != '---':
        # Noncanonical delimiters could be interpreted by another YAML reader.
        first_nonblank = next((line for line in lines if line.strip()), '')
        return 'unsupported_metadata' if first_nonblank.lstrip().startswith('---') else None
    end = next((i for i in range(1, len(lines)) if lines[i] in ('---', '...')), None)
    if end is None:
        return 'invalid_frontmatter'
    fields = {}
    list_key = None
    for line in lines[1:end]:
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if re.fullmatch(r'\s+-\s+[\w .,/\-]+', line) and list_key not in (None, 'export', 'local_only'):
            continue
        match = KEY_VALUE.fullmatch(line)
        if not match:
            return 'unsupported_metadata'
        key, value = match.group(1).lower().replace('-', '_'), (match.group(2) or '').strip()
        if key in fields:
            return 'ambiguous_metadata'
        # Comments are allowed, but YAML aliases, tags, flow maps and block
        # scalars are not. Quoted keys/complex YAML must be manually reviewed.
        value = value.split(' #', 1)[0].strip()
        if not re.fullmatch(r'''(?:[\w .,/\-]*|'[\w .,/\-]*'|"[\w .,/\-]*"|\[[\w .,/\-'\"]*\])''', value):
            return 'unsupported_metadata'
        fields[key] = value
        list_key = key if not value else None
    if 'export' in fields:
        value = fields['export'].strip('\'\"').lower()
        if value == 'false':
            return 'export_false'
        if value != 'true':
            return 'ambiguous_export'
    if 'local_only' in fields:
        value = fields['local_only'].strip('\'\"').lower()
        if value == 'true':
            return 'local_only'
        if value != 'false':
            return 'ambiguous_metadata'
    return None


def discover(root_fd):
    """Return relative names, never descend through a symlink."""
    names = []

    def walk(fd, prefix):
        for name in sorted(os.listdir(fd)):
            relative = prefix + '/' + name
            info = os.stat(name, dir_fd=fd, follow_symlinks=False)
            if stat.S_ISDIR(info.st_mode):
                try:
                    child = os.open(name, FLAGS | os.O_DIRECTORY, dir_fd=fd)
                except OSError:
                    names.append(relative + '/[unreadable].md')
                    continue
                try:
                    walk(child, relative)
                finally:
                    os.close(child)
            elif name.endswith('.md') or stat.S_ISLNK(info.st_mode):
                names.append(relative)

    wiki = os.open('wiki', FLAGS | os.O_DIRECTORY, dir_fd=root_fd)
    try:
        walk(wiki, 'wiki')
    finally:
        os.close(wiki)
    return names


def read_note(root_fd, name):
    fd = os.dup(root_fd)
    try:
        parts = name.split('/')
        for component in parts[:-1]:
            child = os.open(component, FLAGS | os.O_DIRECTORY, dir_fd=fd)
            os.close(fd)
            fd = child
        note = os.open(parts[-1], FLAGS, dir_fd=fd)
        try:
            before = os.fstat(note)
            if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
                raise Rejected('not_single_regular_file')
            if before.st_size > MAX_BYTES:
                raise Rejected('note_too_large')
            with os.fdopen(note, 'rb', closefd=False) as stream:
                data = stream.read(MAX_BYTES + 1)
            after = os.fstat(note)
            if len(data) > MAX_BYTES:
                raise Rejected('note_too_large')
            if (before.st_size, before.st_mtime_ns, before.st_ctime_ns) != (after.st_size, after.st_mtime_ns, after.st_ctime_ns):
                raise Rejected('changed_during_read')
            return data
        finally:
            os.close(note)
    finally:
        os.close(fd)


def preview(root, selections=None):
    """Only reads local files. All reported reasons are fixed, non-content codes."""
    root_fd = open_root(root)
    try:
        names = sorted(set(discover(root_fd) if selections is None else selections))
        candidates, excluded = [], []
        for name in names:
            entry = {'path': name if valid_path(name) else '[invalid selection]'}
            reason = None
            if not valid_path(name):
                reason = 'invalid_path'
            elif any(part.casefold() == PERSONAL for part in name.split('/')):
                reason = 'personal_list'
            else:
                try:
                    data = read_note(root_fd, name)
                    text = data.decode('utf-8-sig')
                    reason = metadata_reason(text)
                    if reason is None:
                        entry.update(sha256=hashlib.sha256(data).hexdigest(), bytes=len(data),
                                     state='needs_privacy_review_and_archive_mapping')
                except UnicodeError:
                    reason = 'invalid_utf8'
                except Rejected as error:
                    reason = str(error)
                except OSError:
                    reason = 'unsafe_or_unreadable_path'
            if reason:
                entry['reason'] = reason
                excluded.append(entry)
            else:
                candidates.append(entry)
        return {'mode': 'dry-run', 'backend_writes': False, 'candidates': candidates,
                'excluded': excluded, 'counts': {'candidates': len(candidates), 'excluded': len(excluded)}}
    finally:
        os.close(root_fd)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('vault', type=Path)
    cli.add_argument('--dry-run', action='store_true', help='Only mode; no writes exist')
    cli.add_argument('--select', nargs='+', help='Exact vault-relative wiki/*.md paths; exclusions still apply')
    args = cli.parse_args()
    try:
        result = preview(args.vault, args.select)
    except (OSError, ValueError):
        print(json.dumps({'mode': 'dry-run', 'backend_writes': False, 'error': 'unsafe_or_unreadable_vault'}))
        return 2
    print(json.dumps(result, ensure_ascii=True, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
