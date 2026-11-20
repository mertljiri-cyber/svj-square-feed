#!/usr/bin/env python3
"""Synthetic-only regression tests; no real vault, network or backend needed."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

SCRIPT = Path(__file__).with_name('wiki-batch-preview.py')
SPEC = importlib.util.spec_from_file_location('wiki_batch_preview', SCRIPT)
assert SPEC is not None and SPEC.loader is not None
preview_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(preview_module)
SCRATCH = Path(os.environ.get('TMPDIR', Path.home() / '.hermes/cache/scratch'))


class PreviewTests(unittest.TestCase):
    def setUp(self):
        SCRATCH.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='wiki-preview-test-', dir=SCRATCH)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'wiki').mkdir()

    def note(self, name, text):
        path = self.root / 'wiki' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8')
        return path

    def run_preview(self, selections=None):
        return preview_module.preview(self.root, selections)

    def test_default_batch_counts_metadata_only_and_no_writes(self):
        self.note('allowed.md', '---\nexport: true\ntitle: Synthetic\ntags: [public, wiki]\n---\nBODY_SENTINEL_7621')
        self.note('plain.md', 'Another synthetic body')
        self.note('blocked.md', '---\nexport: false\n---\nPRIVATE_SENTINEL_9681')
        self.note('local.md', '---\nvisibility: local-only\n---\nLOCAL_SENTINEL_1865')
        self.note('jednotky-a-podily.md', 'PERSONAL_SENTINEL_8456')
        before = {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        # No write-mode opens are allowed while preview runs; all its I/O goes
        # through os.open, including fdopen's already-open descriptor.
        original = os.open

        def read_only(path, flags, *args, **kwargs):
            self.assertFalse(flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND))
            return original(path, flags, *args, **kwargs)

        with mock.patch.object(preview_module.os, 'open', side_effect=read_only), mock.patch('socket.socket', side_effect=AssertionError('network forbidden')):
            result = self.run_preview()
        self.assertEqual(result['counts'], {'candidates': 2, 'excluded': 3})
        self.assertEqual(result['mode'], 'dry-run')
        self.assertFalse(result['backend_writes'])
        self.assertEqual({e['reason'] for e in result['excluded']}, {'export_false', 'local_only', 'personal_list'})
        self.assertNotIn('SENTINEL', json.dumps(result))
        self.assertNotIn('title', json.dumps(result))
        after = {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        self.assertEqual(before, after)

    def test_explicit_selection_cannot_override_exclusions(self):
        self.note('ok.md', 'safe synthetic')
        self.note('blocked.md', '---\nexport: false\n---\nnot public')
        self.note('local.md', '---\ntags:\n  - local-only\n---\nnot public')
        self.note('jednotky-a-podily.md', 'not public')
        names = ['wiki/' + name for name in ('ok.md', 'blocked.md', 'local.md', 'jednotky-a-podily.md')]
        result = self.run_preview(names + [names[0]])
        self.assertEqual(result['counts'], {'candidates': 1, 'excluded': 3})
        self.assertEqual(result['candidates'][0]['path'], 'wiki/ok.md')

    def test_personal_list_never_read_even_explicit_or_nested(self):
        names = ['wiki/jednotky-a-podily.md', 'wiki/nested/JEDNOTKY-A-PODILY.md']
        with mock.patch.object(preview_module, 'read_note', side_effect=AssertionError('personal list read')):
            result = self.run_preview(names)
        self.assertEqual([e['reason'] for e in result['excluded']], ['personal_list', 'personal_list'])

    def test_frontmatter_variants_fail_closed(self):
        fixtures = [
            '\ufeff---\nexport: false\n---\nbody',
            '---\nexport: "false" # comment\n---\nbody',
            '---\nexport: False\n---\nbody',
            '---\nexport: true\nexport: false\n---\nbody',
            '---\n"export": false\n---\nbody',
            '---\nexport: &setting false\n---\nbody',
            '---\n<<: *defaults\n---\nbody',
            '---\nexport: no\n---\nbody',
            '---\nexport:\n  - false\n---\nbody',
            '---\nexport: true\n',
            '---\nexport: true\nunknown: {export: false}\n---\nbody',
            '---\nexport: true\ndescription: |\n  synthetic\n---\nbody',
            '---\nlocal_only: true\n---\nbody',
            '---\nvisibility: "local-only"\n---\nbody',
            '  ---\nexport: false\n---\nbody',
            '--- # ambiguous opening\nexport: false\n---\nbody',
            '\n---\nexport: false\n---\nbody',
        ]
        for i, fixture in enumerate(fixtures):
            with self.subTest(i=i):
                self.note('variant.md', fixture)
                result = self.run_preview(['wiki/variant.md'])
                self.assertEqual(result['counts'], {'candidates': 0, 'excluded': 1})

    def test_supported_metadata_without_content_echo(self):
        self.note('ok.md', '---\ntitle: "Synthetic title"\nexport: true # approved for preview only\ntags:\n  - public\n  - wiki\n---\nBODY')
        result = self.run_preview()
        self.assertEqual(result['counts']['candidates'], 1)
        self.assertNotIn('Synthetic title', json.dumps(result))
        self.assertEqual(len(result['candidates'][0]['sha256']), 64)

    def test_paths_escapes_and_sensitive_invalid_input_are_redacted(self):
        inputs = ['../outside.md', '/etc/passwd', 'wiki/../outside.md', 'wiki//ok.md',
                  'wiki/./ok.md', 'wiki\\ok.md', 'wiki/SECRET\nBODY.md', 'raw/ok.md']
        result = self.run_preview(inputs)
        self.assertEqual(result['counts'], {'candidates': 0, 'excluded': len(inputs)})
        self.assertTrue(all(e == {'path': '[invalid selection]', 'reason': 'invalid_path'} for e in result['excluded']))
        self.assertNotIn('SECRET', json.dumps(result))

    def test_symlink_file_directory_and_root_ancestors_rejected(self):
        self.note('ok.md', 'synthetic')
        (self.root / 'wiki/link.md').symlink_to(self.root / 'wiki/ok.md')
        (self.root / 'wiki/linked').symlink_to(self.root / 'wiki', target_is_directory=True)
        result = self.run_preview(['wiki/link.md', 'wiki/linked/ok.md'])
        self.assertEqual(result['counts'], {'candidates': 0, 'excluded': 2})
        self.assertTrue(all(e['reason'] == 'unsafe_or_unreadable_path' for e in result['excluded']))
        default = self.run_preview()
        self.assertEqual(default['counts']['candidates'], 1)
        alias = self.root / 'alias'
        alias.symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(OSError):
            preview_module.preview(alias)
        with self.assertRaises(OSError):
            preview_module.preview(alias / 'wiki')

    def test_symlink_wiki_rejected(self):
        (self.root / 'wiki').rmdir()
        (self.root / 'elsewhere').mkdir()
        (self.root / 'wiki').symlink_to(self.root / 'elsewhere', target_is_directory=True)
        with self.assertRaises(OSError):
            self.run_preview()

    def test_hardlink_fifo_size_utf8_missing(self):
        original = self.note('ok.md', 'synthetic')
        os.link(original, self.root / 'wiki/alias.md')
        os.mkfifo(self.root / 'wiki/pipe.md')
        self.note('large.md', 'x' * (preview_module.MAX_BYTES + 1))
        (self.root / 'wiki/bad.md').write_bytes(b'\xff\xfe')
        names = ['wiki/' + n for n in ('alias.md', 'pipe.md', 'large.md', 'bad.md', 'missing.md')]
        result = self.run_preview(names)
        self.assertEqual(result['counts'], {'candidates': 0, 'excluded': 5})
        self.assertEqual({e['reason'] for e in result['excluded']}, {'not_single_regular_file', 'note_too_large', 'invalid_utf8', 'unsafe_or_unreadable_path'})

    def test_cli_default_and_explicit_dry_run(self):
        self.note('ok.md', '---\nexport: true\n---\nSYNTHETIC_BODY_DO_NOT_ECHO')
        self.note('blocked.md', '---\nexport: false\n---\nPRIVATE_BODY_DO_NOT_ECHO')
        for arguments in ([], ['--dry-run', '--select', 'wiki/ok.md', 'wiki/blocked.md']):
            with self.subTest(arguments=arguments):
                process = subprocess.run([sys.executable, str(SCRIPT), str(self.root), *arguments], text=True, capture_output=True, timeout=10)
                self.assertEqual(process.returncode, 0, process.stderr)
                self.assertEqual(json.loads(process.stdout)['counts'], {'candidates': 1, 'excluded': 1})
                self.assertNotIn('DO_NOT_ECHO', process.stdout + process.stderr)

    def test_cli_errors_are_sanitized(self):
        process = subprocess.run([sys.executable, str(SCRIPT), str(self.root / 'SENSITIVE_MISSING')], text=True, capture_output=True, timeout=10)
        self.assertEqual(process.returncode, 2)
        self.assertEqual(json.loads(process.stdout)['error'], 'unsafe_or_unreadable_vault')
        self.assertNotIn('SENSITIVE', process.stdout + process.stderr)
        self.assertNotIn('Traceback', process.stdout + process.stderr)


if __name__ == '__main__':
    unittest.main()
