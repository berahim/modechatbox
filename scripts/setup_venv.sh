#!/usr/bin/env bash
# Create venv outside iCloud Drive (avoids sync breaking site-packages).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VENV_DIR="${MODECHAT_VENV:-$HOME/.venvs/modechat}"
LINK_PATH="$ROOT/.venv"

# shellcheck source=python_env.sh
source "$ROOT/scripts/python_env.sh"

PYTHON=""
for candidate in \
  "/Library/Frameworks/Python.framework/Versions/3.14/bin/python3.14" \
  "/usr/local/bin/python3.14" \
  python3.14 python3.13 python3.12 python3 \
  "$HOME/Library/Frameworks/Python.framework/Versions/3.14/bin/python3.14"; do
  if [[ -x "$candidate" ]] || command -v "$candidate" >/dev/null 2>&1; then
    if "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)' 2>/dev/null; then
      PYTHON="$candidate"
      break
    fi
  fi
done

if [[ -z "$PYTHON" ]]; then
  echo "Python 3.12+ not found." >&2
  echo "Run: ./scripts/install_python.sh" >&2
  exit 1
fi

echo "Using $($PYTHON --version) at $PYTHON"
echo "Virtual environment: $VENV_DIR"

mkdir -p "$(dirname "$VENV_DIR")"
if [[ ! -d "$VENV_DIR/bin" ]]; then
  "$PYTHON" -m venv "$VENV_DIR"
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

if [[ "$PYTHON" == "$HOME/Library/Frameworks/Python.framework/Versions/3.14/bin/python3.14" ]]; then
  if ! grep -q "scripts/python_env.sh" "$VENV_DIR/bin/activate" 2>/dev/null; then
    cat >> "$VENV_DIR/bin/activate" <<EOF

# User-local Python.framework paths (see scripts/python_env.sh)
if [[ -f "$ROOT/scripts/python_env.sh" ]]; then
  # shellcheck source=python_env.sh
  source "$ROOT/scripts/python_env.sh"
fi
EOF
  fi
fi

python -m pip install --upgrade pip
python -m pip install -r "$ROOT/requirements.txt"

SITE_PACKAGES="$VENV_DIR/lib/python3.14/site-packages"
if [[ ! -d "$SITE_PACKAGES" ]]; then
  echo "ERROR: $SITE_PACKAGES is missing." >&2
  exit 1
fi

python -c "import fastapi" || {
  echo "ERROR: Dependencies did not install correctly." >&2
  exit 1
}

rm -rf "$LINK_PATH"
ln -sf "$VENV_DIR" "$LINK_PATH"

echo ""
echo "Virtual environment ready at $VENV_DIR"
echo "Project link: .venv -> $VENV_DIR"
echo "Activate:  source scripts/activate.sh"
echo "           source .venv/bin/activate"
echo "Dev server: python scripts/dev_server.py"
