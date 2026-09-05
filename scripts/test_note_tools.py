"""Regression tests use temporary fixtures, never the repository's real images."""

import importlib.util
import tempfile
import unittest
from pathlib import Path

import check_notes

ROOT = Path(__file__).resolve().parents[1]


def load_reconfigure(subject):
    spec = importlib.util.spec_from_file_location(subject, ROOT / subject / "reconfigure.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


MODULES = [load_reconfigure(name) for name in ("DB", "Django", "Javascript", "Vue")]


class ImagePlanTests(unittest.TestCase):
    def test_reserved_path_without_file_gets_new_name(self):
        for module in MODULES:
            with self.subTest(module=module.__name__), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp).resolve()
                source = root / "source.png"
                source.write_bytes(b"image")
                target = root / "target.png"
                reserved = {target, root / "target_1.png"}
                self.assertEqual(module.choose_final_dest(source, target, reserved), root / "target_2.png")

    def test_existing_collision_is_not_overwritten(self):
        for module in MODULES:
            with self.subTest(module=module.__name__), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp).resolve()
                source, target = root / "source.png", root / "target.png"
                source.write_bytes(b"new")
                target.write_bytes(b"old")
                reserved = {root / "target_1.png"}
                self.assertEqual(module.choose_final_dest(source, target, reserved), root / "target_2.png")
                self.assertEqual(target.read_bytes(), b"old")

    def test_same_source_destination_is_noop(self):
        for module in MODULES:
            with self.subTest(module=module.__name__), tempfile.TemporaryDirectory() as tmp:
                source = Path(tmp).resolve() / "same.png"
                source.write_bytes(b"image")
                self.assertEqual(module.choose_final_dest(source, source, {source}), source)

    def test_root_readme_does_not_collect_child_notes_or_assets(self):
        for module in MODULES:
            with self.subTest(module=module.__name__), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp).resolve()
                store = root / "assets" / "images"
                store.mkdir(parents=True)
                (store / "stored.png").write_bytes(b"stored")
                (root / "lesson").mkdir()
                (root / "lesson" / "note.md").write_text("# Lesson", encoding="utf-8")
                (root / "lesson" / "source.png").write_bytes(b"source")
                readme = root / "README.md"
                readme.write_text("![image](assets/images/stored.png)", encoding="utf-8")
                docs, plan = module.collect_plan_for_lecture(root, root, store, set())
                self.assertEqual(docs, [readme])
                self.assertEqual(plan, {})

    def test_second_plan_after_move_is_empty(self):
        for module in MODULES:
            with self.subTest(module=module.__name__), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp).resolve()
                lesson = root / "lesson"
                lesson.mkdir()
                store = root / "assets" / "images"
                note = lesson / "note.md"
                note.write_text("![image](source.png)", encoding="utf-8")
                (lesson / "source.png").write_bytes(b"image")
                docs, plan = module.collect_plan_for_lecture(lesson, root, store, set())
                updated, replaced = module.rewrite_markdown(note.read_text(encoding="utf-8"), note, plan)
                self.assertEqual(replaced, 1)
                note.write_text(updated, encoding="utf-8")
                self.assertEqual(module.move_planned_images(plan), 1)
                _, second = module.collect_plan_for_lecture(lesson, root, store, set(plan.values()))
                self.assertEqual(second, {})
                self.assertEqual(check_notes.inspect(note)[1], [])


class MarkdownCheckTests(unittest.TestCase):
    def test_links_in_samples_are_ignored(self):
        lines = list(check_notes.visible_lines('```md\n[x](missing.md)\n```\n`[x](missing.md)`'))
        self.assertEqual(lines, [(4, "")])

    def test_unclosed_fence_is_reported(self):
        self.assertEqual(list(check_notes.visible_lines('text\n```java\nint n;'))[-1], (2, None))

    def test_short_fence_does_not_close_long_fence(self):
        self.assertEqual(list(check_notes.visible_lines('````md\n```\n````')), [])

    def test_parentheses_spaces_reference_and_html(self):
        self.assertEqual(list(check_notes.destinations('[a](img(1).png)')), ['img(1).png'])
        self.assertEqual(list(check_notes.destinations('[a](<img one.png>)')), ['img one.png'])
        self.assertEqual(list(check_notes.destinations('[ref]: other.md "title"')), ['other.md'])
        self.assertEqual(list(check_notes.destinations('<img src="a.png">')), ['a.png'])

    def test_missing_and_machine_local_link(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "note.md"
            path.write_text('[x](missing.md)\n[x](C:/outside.md)\n[x](https://example.com)', encoding="utf-8")
            checked, issues = check_notes.inspect(path)
            self.assertEqual(checked, 1)
            self.assertEqual([item[1] for item in issues], ['missing-local-link', 'machine-local-link'])


if __name__ == "__main__":
    unittest.main()
