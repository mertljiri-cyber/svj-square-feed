import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).with_name('wiki-release-import.py')
ORG = '00000000-0000-4000-8000-000000000001'
_spec = importlib.util.spec_from_file_location('wiki_release_import', SCRIPT)
MODULE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(MODULE)


class ImportTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name) / 'notes'
        self.root.mkdir()
        (self.root / 'Rada').mkdir()
        self.body = b'# Synthetic\nApproved synthetic line.'
        (self.root / 'Rada' / 'Zápis A.md').write_bytes(self.body)
        self.allow = self.root.parent / 'approved.json'

    def run_import(self, paths, *extra):
        self.allow.write_text(json.dumps(paths), encoding='utf-8')
        return subprocess.run([sys.executable, str(SCRIPT), '--root', str(self.root), '--allowlist', str(self.allow),
                               '--organization', ORG, *extra], capture_output=True, text=True, check=False)

    def test_staged_release_keeps_original_bytes_and_the_shared_object_layout(self):
        (self.root / 'Finance').mkdir()
        budget = '# Rozpočet\nViz [[Rada/Zápis A]].'.encode()
        (self.root / 'Finance' / 'Rozpočet.md').write_bytes(budget)
        (self.root / 'private.md').write_text('not approved')
        out = self.root.parent / 'staged'
        release = '00000000-0000-4000-8000-000000000099'
        result = self.run_import(['Rada/Zápis A.md', 'Finance/Rozpočet.md'], '--write', str(out), '--release-id', release)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        base = out / ORG / 'releases' / release
        manifest = (base / 'manifest.json').read_bytes()
        self.assertEqual(report['mode'], 'staged')
        self.assertEqual(report['manifest_sha256'], hashlib.sha256(manifest).hexdigest())
        self.assertIn(f"'{ORG}','{release}','{report['manifest_sha256']}'", report['activate_sql'])
        parsed = json.loads(manifest)
        self.assertEqual(parsed['version'], 2)
        self.assertEqual([f['path'] for f in parsed['files']], ['Finance/Rozpočet.md', 'Rada/Zápis A.md'])
        # Same literal as supabase/tests/file-wiki.test.ts (noteObjectPath).
        self.assertEqual((base / 'notes/52616461/5ac3a170697320412e6d64.md').read_bytes(), self.body)
        # The index is bound to the manifest digest and points at manifest positions.
        shards = parsed['index']['shards']
        self.assertEqual(report['index_shards'], len(shards))
        words = {}
        for i, pinned in enumerate(shards):
            blob = (base / MODULE.index_key(i)).read_bytes()
            self.assertEqual((hashlib.sha256(blob).hexdigest(), len(blob)), (pinned['sha256'], pinned['bytes']))
            shard = json.loads(blob)
            self.assertEqual((shard['version'], shard['shard']), (2, i))
            words.update(shard['words'])
        self.assertEqual(words['rozpocet'], [0])
        self.assertEqual(words['synthetic'], [1])
        staged = sorted(str(p.relative_to(base)) for p in base.rglob('*') if p.is_file())
        self.assertEqual(len(staged), 3 + len(shards))
        self.assertNotIn('not approved', ''.join(p.read_text() for p in base.rglob('*') if p.is_file()))
        # A staged directory is never overwritten, and never written into the notes root.
        self.assertNotEqual(self.run_import(['Rada/Zápis A.md'], '--write', str(out)).returncode, 0)
        inside = self.run_import(['Rada/Zápis A.md'], '--write', str(self.root / 'out'))
        self.assertNotEqual(inside.returncode, 0)
        self.assertFalse((self.root / 'out').exists())

    def test_limits_and_unicode_rules_fail_closed(self):
        (self.root / 'big.md').write_bytes(b'a' * 65537)
        (self.root / 'bad.md').write_bytes(b'\xff\xfe')
        (self.root / 'local.md').write_text('local-only poznámka')
        decomposed = 'Zápis.md'
        for paths in (['big.md'], ['bad.md'], ['local.md'], [decomposed], ['Rada'], [], ['a.md'] * 257):
            with self.subTest(paths=paths):
                result = self.run_import(paths)
                self.assertEqual(result.returncode, 2)
                self.assertEqual(result.stdout, '')
                self.assertEqual(json.loads(result.stderr)['error'], 'rejected')

    def test_dry_run_is_read_only_and_does_not_disclose_paths_or_content(self):
        (self.root / 'private.md').write_text('not approved')
        shards = MODULE.build_index([('Rada/Zápis A.md', self.body)])
        expected = MODULE.build_manifest([('Rada/Zápis A.md', self.body)], shards)
        before = set(self.root.parent.rglob('*')) | {self.allow}
        result = self.run_import(['Rada/Zápis A.md'])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {'mode': 'dry-run', 'files': 1, 'bytes': len(self.body), 'index_shards': 1,
                                                     'manifest_sha256': hashlib.sha256(expected).hexdigest()})
        self.assertEqual(before, set(self.root.parent.rglob('*')))
        self.assertEqual(json.loads(expected)['files'], [{'path': 'Rada/Zápis A.md', 'sha256': hashlib.sha256(self.body).hexdigest(), 'bytes': len(self.body)}])

    def test_index_vectors_match_file_wiki_ts(self):
        # Same vectors as supabase/tests/file-wiki.test.ts.
        self.assertEqual([MODULE.fnv1a('a'), MODULE.fnv1a('abc')], [0xe40c292c, 0x1a47e90b])
        self.assertEqual(MODULE.shard_of('abcdef', 64), 11)
        self.assertEqual(MODULE.index_key(10), 'index/0a.json')
        self.assertEqual(MODULE.index_words('Výtah-A1 čeká; ab'), {'ceka', 'vytah-a1'})

    def test_over_160_notes_stage_with_bounded_index_shards(self):
        (self.root / 'Archiv').mkdir()
        paths = []
        for i in range(230):
            name = f'Archiv/Poznámka {i:03d}.md'
            (self.root / name).write_text(f'# Poznámka {i:03d}\nÚklid schodiště proběhl podle plánu {i:03d}.', encoding='utf-8')
            paths.append(name)
        result = self.run_import(paths)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report['files'], 230)
        self.assertTrue(1 <= report['index_shards'] <= 64)

    def test_invalid_paths_symlinks_and_private_markers_fail_closed(self):
        (self.root / 'marked.md').write_text('---\nexport: false\n---\nnot approved')
        (self.root / 'link.md').symlink_to('marked.md')
        for paths in (['../marked.md'], ['*.md'], ['link.md'], ['marked.md'], ['Rada/Zápis A.md'] * 2):
            with self.subTest(paths=paths):
                result = self.run_import(paths)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, '')
                self.assertNotIn('not approved', result.stderr)


if __name__ == '__main__':
    unittest.main()
