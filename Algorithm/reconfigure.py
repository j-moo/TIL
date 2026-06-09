from __future__ import annotations

import re
import os
import sys
import shutil
import argparse
import filecmp
from pathlib import Path
from urllib.parse import urlparse, unquote

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"}

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

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
    ref = unquote(ref.strip())
    if ref.startswith("<") and ref.endswith(">"):
        ref = ref[1:-1].strip()
    ref = ref.split("#", 1)[0].split("?", 1)[0].strip()
    return ref

def resolve_local_image(md_file: Path, ref: str) -> Path | None:
    """
    md 파일 기준 상대경로를 실제 로컬 이미지 파일 경로로 변환
    원격 URL / data URL 이면 None 반환
    """
    if is_remote_url(ref) or is_data_url(ref):
        return None

    ref = clean_ref(ref)
    if not ref:
        return None

    candidate = (md_file.parent / ref).resolve()
    return candidate if is_image_file(candidate) else None


def make_unique_path(path: Path) -> Path:
    """
    같은 이름의 파일이 이미 있으면 _1, _2 ... 를 붙여 고유 경로 생성
    """
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
    """
    md 파일 기준 상대경로를 POSIX 스타일(/)로 반환
    """
    return Path(os.path.relpath(to_file, start=from_file.parent)).as_posix()


def backup_file(path: Path):
    """
    원본 백업 파일 생성: xxx.md -> xxx.md.bak
    """
    backup_path = path.with_suffix(path.suffix + ".bak")
    if not backup_path.exists():
        shutil.copy2(path, backup_path)


def find_lecture_dirs(root_dir: Path, image_store_dir: Path):
    """
    root_dir = 과목 폴더 하나
    그 바로 아래의 하위 폴더들을 '강의 폴더 후보'로 보고,
    그 안에 md 파일이 하나라도 있으면 강의 폴더로 처리

    또한 root_dir 바로 아래에 md가 있는 경우 root_dir 자체도 처리
    """
    lecture_dirs = []

    for child in sorted(root_dir.iterdir()):
        if not child.is_dir():
            continue

        # 이미지 저장 폴더는 탐색 제외
        if child.resolve() == image_store_dir.resolve():
            continue
        if in_dir(child, image_store_dir):
            continue

        md_files = [
            p for p in child.rglob("*.md")
            if p.is_file() and not p.name.endswith(".md.bak")
        ]
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
    """
    강의 폴더 이름 결정
    - root_dir 자체면 _root
    - 아니면 폴더명 사용
    """
    return "_root" if lecture_dir.resolve() == root_dir.resolve() else lecture_dir.name


def destination_base_for(src: Path, lecture_dir: Path, image_store_dir: Path, lecture_name_str: str) -> Path:
    """
    이미지 최종 저장 경로 계산

    예:
    root_dir = Python
    lecture_dir = Python/01_기초문법
    src = Python/01_기초문법/captures/img1.png

    -> Python/images/01_기초문법/captures/img1.png
    """
    src = src.resolve()
    try:
        rel = src.relative_to(lecture_dir.resolve())
    except ValueError:
        rel = Path(src.name)

    return (image_store_dir / lecture_name_str / rel).resolve()


def choose_final_dest(src: Path, preferred: Path, reserved: set[Path]) -> Path:
    """
    중복 파일명 충돌 방지
    - 이미 예약된 경로면 다른 이름 생성
    - 같은 내용의 파일이 이미 있으면 기존 경로 재사용
    """
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
    """
    한 강의 폴더에 대해:
    1) md 파일 목록 수집
    2) md 안에서 참조된 이미지 수집
    3) 아직 참조되지 않은 이미지도 lecture_dir 내부면 전부 수집
    4) 이미지별 최종 이동 경로(move_plan) 생성
    """
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

    # 1) md에서 참조한 이미지 먼저 수집
    for md_file in md_files:
        content = md_file.read_text(encoding="utf-8")

        # Markdown 이미지: ![alt](path)
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

        # HTML 이미지: <img src="...">
        for m in html_pattern.finditer(content):
            src = resolve_local_image(md_file, m.group(3).strip())
            if src is not None and in_dir(src, lecture_dir):
                reserve(src)

        # Obsidian 형식: ![[image.png]]
        for m in obs_pattern.finditer(content):
            src = resolve_local_image(md_file, m.group(1).strip())
            if src is not None and in_dir(src, lecture_dir):
                reserve(src)

    # 2) md에서 안 쓰였더라도 lecture_dir 내부 이미지는 전부 수집
    for p in lecture_dir.rglob("*"):
        if not is_image_file(p):
            continue
        reserve(p)

    return md_files, move_plan


def rewrite_markdown(content: str, md_file: Path, move_plan: dict[Path, Path]):
    """
    md 내용에서 이미지 링크를 새 경로로 치환
    지원:
    - Markdown 이미지
    - HTML img 태그
    - Obsidian 이미지 문법
    """
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


def remove_empty_dirs(lecture_dir: Path, protected_dir: Path | None = None):
    """
    이미지 이동 후 lecture_dir 내부의 빈 폴더 제거
    protected_dir 는 삭제하지 않음
    """
    removed = 0

    dirs = sorted(
        [p for p in lecture_dir.rglob("*") if p.is_dir()],
        key=lambda p: len(p.parts),
        reverse=True
    )

    for d in dirs:
        try:
            if protected_dir and d.resolve() == protected_dir.resolve():
                continue
            if not any(d.iterdir()):
                d.rmdir()
                removed += 1
        except Exception:
            pass

    return removed


def main():
    parser = argparse.ArgumentParser(
        description="과목 폴더 하나를 기준으로, 강의 폴더의 이미지를 assets/images 폴더로 정리하고 md 경로를 수정합니다."
    )

    # root_dir를 선택 인자로 바꿔서, 안 쓰면 현재 폴더(.)를 사용
    parser.add_argument(
        "root_dir",
        nargs="?",
        default=".",
        help="과목 폴더 경로 (기본값: 현재 폴더 .)"
    )

    # 기본 이미지 저장 경로를 assets/images로 변경
    parser.add_argument(
        "--imgdir",
        default="assets/images",
        help="과목 폴더 내부 이미지 저장 폴더 (기본값: assets/images)"
    )

    parser.add_argument(
        "--no-backup",
        action="store_true",
        help=".bak 백업 파일을 만들지 않음"
    )

    args = parser.parse_args()

    root_dir = Path(args.root_dir).resolve()
    if not root_dir.is_dir():
        print(f"[오류] 폴더를 찾을 수 없습니다: {root_dir}")
        sys.exit(1)

    image_store_dir = (root_dir / args.imgdir).resolve()
    image_store_dir.mkdir(parents=True, exist_ok=True)

    lecture_dirs = find_lecture_dirs(root_dir, image_store_dir)
    if not lecture_dirs:
        print("[안내] 처리할 강의 폴더를 찾지 못했습니다.")
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

    print(f"과목 폴더: {root_dir}")
    print(f"이미지 저장 폴더: {image_store_dir}")
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

        protected = image_store_dir if lecture_dir.resolve() == root_dir.resolve() else None
        cleaned = remove_empty_dirs(lecture_dir, protected_dir=protected)

        total_changed += changed
        total_replaced += replaced
        total_moved += moved
        total_cleaned += cleaned

        print(
            f"수정 md: {changed}, 링크 치환: {replaced}, "
            f"이동 이미지: {moved}, 정리 폴더: {cleaned}"
        )
        print()

    print("=== 완료 ===")
    print(f"수정된 md 파일 수   : {total_changed}")
    print(f"이미지 링크 치환 수 : {total_replaced}")
    print(f"이동한 이미지 수   : {total_moved}")
    print(f"정리된 빈 폴더 수  : {total_cleaned}")

def verify_markdown_images(md_files: list[Path]):
    md_pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
    html_pattern = re.compile(
        r'(<img\b[^>]*\bsrc\s*=\s*)(["\'])(.+?)(\2)([^>]*>)',
        flags=re.IGNORECASE | re.DOTALL
    )
    obs_pattern = re.compile(r'!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]')

    broken = []

    for md_file in md_files:
        content = md_file.read_text(encoding="utf-8")

        # Markdown 이미지
        for m in md_pattern.finditer(content):
            raw = m.group(2).strip()

            if raw.startswith("<") and ">" in raw:
                end = raw.find(">")
                ref = raw[1:end].strip()
            else:
                mm = re.match(r"(\S+)(.*)", raw, flags=re.DOTALL)
                ref = mm.group(1) if mm else raw

            if is_remote_url(ref) or is_data_url(ref):
                continue

            ref = clean_ref(ref)
            candidate = (md_file.parent / ref).resolve()
            if not candidate.exists():
                broken.append((md_file, ref))

        # HTML 이미지
        for m in html_pattern.finditer(content):
            ref = clean_ref(m.group(3).strip())
            if is_remote_url(ref) or is_data_url(ref):
                continue

            candidate = (md_file.parent / ref).resolve()
            if not candidate.exists():
                broken.append((md_file, ref))

        # Obsidian 이미지
        for m in obs_pattern.finditer(content):
            ref = clean_ref(m.group(1).strip())
            if is_remote_url(ref) or is_data_url(ref):
                continue

            candidate = (md_file.parent / ref).resolve()
            if not candidate.exists():
                broken.append((md_file, ref))

    if broken:
        print("\n[깨진 이미지 링크]")
        for md_file, ref in broken:
            print(f"- {md_file} -> {ref}")
    else:
        print("\n[검증 완료] 모든 이미지 링크가 정상입니다.")
    
if __name__ == "__main__":
    main()