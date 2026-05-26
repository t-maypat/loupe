from pathlib import Path

import httpx


API_BASE = "http://localhost:8000"


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    sample_dir = root / "data" / "sample"
    paths = [str(path) for path in sample_dir.glob("*.md")]

    payload = {"paths": paths, "documents": []}
    response = httpx.post(f"{API_BASE}/ingest", json=payload, timeout=60)
    response.raise_for_status()
    print(response.json())


if __name__ == "__main__":
    main()
