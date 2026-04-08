import re
import os
import sys
import shutil
import argparse
import filecmp
from pathlib import Path
from urllib.parse import urlparse

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"}


def is_remote_url(text: str) -> bool:
    return urlparse(text).scheme in ("http", "https")


def is_data_url(text: str) -> bool:
    return text.strip().startswith("data:")


def is_image_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in IMAGE_EXTS


def in_dir(path: Path, directory: Path) -> bool:
    try:
        path.resolve().relative_to(directory.resolve())
        return True
    except ValueError:
        return False


def clean_ref(ref: str) -> str:
    ref = ref.strip()
    if ref.startswith("<") and ref.endswith(">"):
        ref = ref[1:-1].strip()
    ref = ref.split("#", 1)[0].split("?", 1)[0].strip()
    return ref


def resolve_local_image(md_file: Path, ref: str) -> Path | None:
    if is_remote_url(ref) or is_data_url(ref):
        return None
    ref = clean_ref(ref)
    if not ref:
        return None
    candidate = (md_file.parent / ref).resolve()
    return candidate if is_image_file(candidate) else None


def make_unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    stem = path.stem
    suffix = path.suffix
    parent = path.parent
    i = 1
    while True:
        candidate = parent / f"{stem}_{i}{suffix}"
        if not candidate.exists():
            return candidate
        i += 1


def rel_posix(from_file: Path, to_file: Path) -> str:
    return Path(os.path.relpath(to_file, start=from_file.parent)).as_posix()


def backup_file(path: Path):
    shutil.copy2(path, path.with_suffix(path.suffix + ".bak"))


def find_lecture_dirs(root_dir: Path, image_store_dir: Path):
    lecture_dirs = []

    for child in sorted(root_dir.iterdir()):
        if not child.is_dir():
            continue
        if child.name == "assets":
            continue
        if in_dir(child, image_store_dir):
            continue

        md_files = [p for p in child.rglob("*.md") if p.is_file() and not p.name.endswith(".md.bak")]
        if md_files:
            lecture_dirs.append(child)

    # root 바로 아래 md가 있는 경우도 처리
    root_md = [
        p for p in root_dir.glob("*.md")
        if p.is_file() and not p.name.endswith(".md.bak")
    ]
    if root_md:
        lecture_dirs.append(root_dir)

    return lecture_dirs


def lecture_name(lecture_dir: Path, root_dir: Path) -> str:
    return "_root" if lecture_dir.resolve() == root_dir.resolve() else lecture_dir.name


def destination_base_for(src: Path, lecture_dir: Path, image_store_dir: Path, lecture_name_str: str) -> Path:
    src = src.resolve()
    try:
        rel = src.relative_to(lecture_dir.resolve())
    except ValueError:
        rel = Path(src.name)
    return (image_store_dir / lecture_name_str / rel).resolve()


def choose_final_dest(src: Path, preferred: Path, reserved: set[Path]) -> Path:
    src = src.resolve()
    candidate = preferred.resolve()

    while True:
        if candidate in reserved:
            candidate = make_unique_path(candidate)
            continue

        if candidate.exists():
            try:
                if filecmp.cmp(src, candidate, shallow=False):
                    reserved.add(candidate)
                    return candidate
            except Exception:
                pass
            candidate = make_unique_path(candidate)
            continue

        reserved.add(candidate)
        return candidate


def collect_plan_for_lecture(lecture_dir: Path, root_dir: Path, image_store_dir: Path, reserved: set[Path]):
    lecture = lecture_name(lecture_dir, root_dir)
    move_plan: dict[Path, Path] = {}

    md_files = sorted(
        p for p in lecture_dir.rglob("*.md")
        if p.is_file() and not p.name.endswith(".md.bak")
    )

    md_pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
    html_pattern = re.compile(
        r'(<img\b[^>]*\bsrc\s*=\s*)(["\'])(.+?)(\2)([^>]*>)',
        flags=re.IGNORECASE | re.DOTALL
    )
    obs_pattern = re.compile(r'!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]')

    def reserve(src: Path):
        src = src.resolve()
        if src in move_plan:
            return move_plan[src]
        preferred = destination_base_for(src, lecture_dir, image_store_dir, lecture)
        final_dest = choose_final_dest(src, preferred, reserved)
        move_plan[src] = final_dest
        return final_dest

    # 1) md에서 참조한 이미지 수집
    for md_file in md_files:
        content = md_file.read_text(encoding="utf-8")

        for m in md_pattern.finditer(content):
            raw = m.group(2).strip()
            if raw.startswith("<") and ">" in raw:
                end = raw.find(">")
                ref = raw[1:end].strip()
            else:
                mm = re.match(r"(\S+)(.*)", raw, flags=re.DOTALL)
                ref = mm.group(1) if mm else raw

            src = resolve_local_image(md_file, ref)
            if src is not None and in_dir(src, lecture_dir):
                reserve(src)

        for m in html_pattern.finditer(content):
            src = resolve_local_image(md_file, m.group(3).strip())
            if src is not None and in_dir(src, lecture_dir):
                reserve(src)

        for m in obs_pattern.finditer(content):
            src = resolve_local_image(md_file, m.group(1).strip())
            if src is not None and in_dir(src, lecture_dir):
                reserve(src)

    # 2) 아직 참조되지 않았어도 lecture_dir 안의 이미지 전부 수집
    for p in lecture_dir.rglob("*"):
        if not is_image_file(p):
            continue
        reserve(p)

    return md_files, move_plan


def rewrite_markdown(content: str, md_file: Path, move_plan: dict[Path, Path]):
    replaced = 0

    md_pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
    html_pattern = re.compile(
        r'(<img\b[^>]*\bsrc\s*=\s*)(["\'])(.+?)(\2)([^>]*>)',
        flags=re.IGNORECASE | re.DOTALL
    )
    obs_pattern = re.compile(r'!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]')

    def md_repl(match):
        nonlocal replaced
        alt = match.group(1)
        raw = match.group(2).strip()

        if raw.startswith("<") and ">" in raw:
            end = raw.find(">")
            ref = raw[1:end].strip()
            tail = raw[end + 1:]
        else:
            mm = re.match(r"(\S+)(.*)", raw, flags=re.DOTALL)
            if not mm:
                return match.group(0)
            ref = mm.group(1)
            tail = mm.group(2)

        src = resolve_local_image(md_file, ref)
        if src is None:
            return match.group(0)

        dest = move_plan.get(src.resolve())
        if dest is None:
            return match.group(0)

        new_ref = rel_posix(md_file, dest)
        replaced += 1

        if " " in new_ref:
            return f"![{alt}](<{new_ref}>{tail})"
        return f"![{alt}]({new_ref}{tail})"

    def html_repl(match):
        nonlocal replaced
        src = resolve_local_image(md_file, match.group(3).strip())
        if src is None:
            return match.group(0)

        dest = move_plan.get(src.resolve())
        if dest is None:
            return match.group(0)

        new_ref = rel_posix(md_file, dest)
        replaced += 1
        return f'{match.group(1)}{match.group(2)}{new_ref}{match.group(2)}{match.group(5)}'

    def obs_repl(match):
        nonlocal replaced
        ref = match.group(1).strip()
        size = match.group(2).strip() if match.group(2) else ""

        src = resolve_local_image(md_file, ref)
        if src is None:
            return match.group(0)

        dest = move_plan.get(src.resolve())
        if dest is None:
            return match.group(0)

        new_ref = rel_posix(md_file, dest)
        replaced += 1

        if size.isdigit():
            return f'<img src="{new_ref}" width="{size}" alt="">'
        return f"![]({new_ref})"

    content = md_pattern.sub(md_repl, content)
    content = html_pattern.sub(html_repl, content)
    content = obs_pattern.sub(obs_repl, content)
    return content, replaced


def apply_md_updates(md_files: list[Path], move_plan: dict[Path, Path], backup: bool):
    changed = 0
    total_replaced = 0

    for md_file in md_files:
        original = md_file.read_text(encoding="utf-8")
        updated, replaced = rewrite_markdown(original, md_file, move_plan)

        if updated != original:
            if backup:
                backup_file(md_file)
            md_file.write_text(updated, encoding="utf-8")
            changed += 1

        total_replaced += replaced
        print(f"[md] {md_file} | 치환 {replaced}")

    return changed, total_replaced


def move_planned_images(move_plan: dict[Path, Path]):
    moved = 0
    for src, dest in move_plan.items():
        src = src.resolve()
        dest = dest.resolve()

        if src == dest:
            continue
        if not src.exists():
            continue

        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dest))
        moved += 1

    return moved


def remove_empty_dirs(lecture_dir: Path):
    removed = 0
    dirs = sorted(
        [p for p in lecture_dir.rglob("*") if p.is_dir()],
        key=lambda p: len(p.parts),
        reverse=True
    )

    for d in dirs:
        try:
            if not any(d.iterdir()):
                d.rmdir()
                removed += 1
        except Exception:
            pass

    return removed


def main():
    parser = argparse.ArgumentParser(description="md가 있는 강의 폴더의 이미지를 전부 정리")
    parser.add_argument("root_dir", help="강의 폴더들의 상위 폴더")
    parser.add_argument("--imgdir", default="assets/images", help="이미지 저장 폴더")
    parser.add_argument("--no-backup", action="store_true", help=".bak 만들지 않음")
    args = parser.parse_args()

    root_dir = Path(args.root_dir).resolve()
    if not root_dir.is_dir():
        print(f"[오류] 폴더를 찾을 수 없습니다: {root_dir}")
        sys.exit(1)

    image_store_dir = (root_dir / args.imgdir).resolve()
    image_store_dir.mkdir(parents=True, exist_ok=True)

    lecture_dirs = find_lecture_dirs(root_dir, image_store_dir)
    if not lecture_dirs:
        print("[안내] md가 있는 강의 폴더가 없습니다.")
        return

    reserved = set()
    if image_store_dir.exists():
        for p in image_store_dir.rglob("*"):
            if p.is_file():
                reserved.add(p.resolve())

    total_changed = 0
    total_replaced = 0
    total_moved = 0
    total_cleaned = 0

    print(f"루트 폴더: {root_dir}")
    print(f"이미지 폴더: {image_store_dir}")
    print(f"처리 강의 폴더 수: {len(lecture_dirs)}")
    print()

    for lecture_dir in lecture_dirs:
        print(f"=== {lecture_dir} ===")
        md_files, move_plan = collect_plan_for_lecture(
            lecture_dir, root_dir, image_store_dir, reserved
        )

        changed, replaced = apply_md_updates(
            md_files, move_plan, backup=not args.no_backup
        )
        moved = move_planned_images(move_plan)
        cleaned = remove_empty_dirs(lecture_dir)

        total_changed += changed
        total_replaced += replaced
        total_moved += moved
        total_cleaned += cleaned

        print(f"수정 md: {changed}, 링크 치환: {replaced}, 이동 이미지: {moved}, 정리 폴더: {cleaned}")
        print()

    print("=== 완료 ===")
    print(f"수정된 md 파일 수   : {total_changed}")
    print(f"이미지 링크 치환 수 : {total_replaced}")
    print(f"이동한 이미지 수   : {total_moved}")
    print(f"정리된 빈 폴더 수  : {total_cleaned}")


if __name__ == "__main__":
    main()