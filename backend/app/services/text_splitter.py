def split_text(text: str, max_chars: int, overlap: int) -> list[str]:
    compact = " ".join(text.split())
    if not compact:
        return []

    chunks: list[str] = []
    start = 0
    length = len(compact)

    while start < length:
        end = min(start + max_chars, length)
        chunk = compact[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= length:
            break
        start = max(0, end - overlap)

    return chunks
