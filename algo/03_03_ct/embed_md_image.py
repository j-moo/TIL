import re
import sys
import base64
import mimetypes
from pathlib import Path
from urllib.parse import urlparse


def is_remote_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme in ("http", "https")


def is_data_url(url: str) -> bool:
    return url.strip().startswith("data:")


def file_to_data_url(image_path: Path) -> str:
    mime_type, _ = mimetypes.guess_type(str(image_path))
    if mime_type is None:
        # MIME 타입을 못 찾으면 기본값 사용
        mime_type = "application/octet-stream"

    data = image_path.read_bytes()
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def resolve_image_path(md_file: Path, image_ref: str) -> Path:
    # URL/anchor/query는 제외
    if is_remote_url(image_ref):
        raise ValueError(f"원격 URL은 변환하지 않습니다: {image_ref}")

    # query, fragment 제거
    clean_ref = image_ref.split("?", 1)[0].split("#", 1)[0].strip()

    image_path = (md_file.parent / clean_ref).resolve()
    if not image_path.exists():
        raise FileNotFoundError(f"이미지 파일을 찾을 수 없습니다: {image_ref}")
    if not image_path.is_file():
        raise FileNotFoundError(f"이미지 경로가 파일이 아닙니다: {image_ref}")
    return image_path


def replace_markdown_images(content: str, md_file: Path):
    """
    ![alt](path)
    ![alt](<path with spaces>)
    형태를 처리
    """
    pattern = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')

    replaced_count = 0
    skipped_count = 0
    errors = []

    def repl(match):
        nonlocal replaced_count, skipped_count, errors

        alt_text = match.group(1)
        raw_path = match.group(2).strip()

        # <...> 로 감싼 경로 처리
        if raw_path.startswith("<") and raw_path.endswith(">"):
            raw_path = raw_path[1:-1].strip()

        if is_data_url(raw_path):
            skipped_count += 1
            return match.group(0)

        if is_remote_url(raw_path):
            skipped_count += 1
            return match.group(0)

        try:
            image_path = resolve_image_path(md_file, raw_path)
            data_url = file_to_data_url(image_path)
            replaced_count += 1
            return f"![{alt_text}]({data_url})"
        except Exception as e:
            errors.append(str(e))
            skipped_count += 1
            return match.group(0)

    new_content = pattern.sub(repl, content)
    return new_content, replaced_count, skipped_count, errors


def replace_html_img_tags(content: str, md_file: Path):
    """
    <img ... src="path" ...>
    <img ... src='path' ...>
    형태 처리
    """
    pattern = re.compile(
        r'(<img\b[^>]*\bsrc\s*=\s*)(["\'])(.+?)(\2)([^>]*>)',
        flags=re.IGNORECASE | re.DOTALL
    )

    replaced_count = 0
    skipped_count = 0
    errors = []

    def repl(match):
        nonlocal replaced_count, skipped_count, errors

        prefix = match.group(1)
        quote = match.group(2)
        src = match.group(3).strip()
        suffix = match.group(5)

        if is_data_url(src):
            skipped_count += 1
            return match.group(0)

        if is_remote_url(src):
            skipped_count += 1
            return match.group(0)

        try:
            image_path = resolve_image_path(md_file, src)
            data_url = file_to_data_url(image_path)
            replaced_count += 1
            return f"{prefix}{quote}{data_url}{quote}{suffix}"
        except Exception as e:
            errors.append(str(e))
            skipped_count += 1
            return match.group(0)

    new_content = pattern.sub(repl, content)
    return new_content, replaced_count, skipped_count, errors


def convert_markdown_images(md_path: Path, output_path: Path = None, inplace: bool = False):
    if not md_path.exists():
        raise FileNotFoundError(f"마크다운 파일이 존재하지 않습니다: {md_path}")
    if not md_path.is_file():
        raise ValueError(f"마크다운 경로가 파일이 아닙니다: {md_path}")

    content = md_path.read_text(encoding="utf-8")

    content, md_replaced, md_skipped, md_errors = replace_markdown_images(content, md_path)
    content, html_replaced, html_skipped, html_errors = replace_html_img_tags(content, md_path)

    total_replaced = md_replaced + html_replaced
    total_skipped = md_skipped + html_skipped
    total_errors = md_errors + html_errors

    if inplace:
        save_path = md_path
    else:
        if output_path is None:
            save_path = md_path.with_name(md_path.stem + "_embedded" + md_path.suffix)
        else:
            save_path = output_path

    save_path.write_text(content, encoding="utf-8")

    print(f"입력 파일 : {md_path}")
    print(f"출력 파일 : {save_path}")
    print(f"치환 개수 : {total_replaced}")
    print(f"건너뜀   : {total_skipped}")

    if total_errors:
        print("\n[경고] 일부 이미지는 치환하지 못했습니다.")
        for err in total_errors:
            print(f"- {err}")


def main():
    if len(sys.argv) < 2:
        print("사용법:")
        print("  python embed_md_images.py <markdown_file>")
        print("  python embed_md_images.py <markdown_file> <output_file>")
        print("  python embed_md_images.py <markdown_file> --inplace")
        sys.exit(1)

    md_path = Path(sys.argv[1])

    inplace = "--inplace" in sys.argv
    output_path = None

    # 두 번째 인자가 output 파일인 경우 처리
    extra_args = [arg for arg in sys.argv[2:] if arg != "--inplace"]
    if extra_args:
        output_path = Path(extra_args[0])

    convert_markdown_images(md_path, output_path=output_path, inplace=inplace)


if __name__ == "__main__":
    main()