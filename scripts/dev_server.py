"""Serve demo, chatbox assets, and handoff API for local development."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PORT = 8765


def main(port: int = DEFAULT_PORT) -> None:
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    try:
        import uvicorn
    except ImportError:
        print(
            "uvicorn is required. Activate the project venv and run:\n"
            "  pip install -r requirements.txt",
            file=sys.stderr,
        )
        raise SystemExit(1) from None

    url = f"http://localhost:{port}/demo/index.html"
    print(f"Serving files from:\n  {ROOT}\n", flush=True)
    print(f"Demo page:\n  {url}\n", flush=True)
    print(f"Handoff API:\n  http://localhost:{port}/api/handoff\n", flush=True)
    print("Server is running. Open the URL above in your browser.", flush=True)
    print("Press Ctrl+C in this terminal to stop.\n", flush=True)

    uvicorn.run(
        "backend.app:app",
        host="127.0.0.1",
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
