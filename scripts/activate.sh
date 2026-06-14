#!/usr/bin/env bash
# Activate the ModeChat venv (stored outside iCloud Drive).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV_DIR="${MODECHAT_VENV:-$HOME/.venvs/modechat}"

if [[ ! -f "$VENV_DIR/bin/activate" ]]; then
  echo "Virtual environment not found at $VENV_DIR" >&2
  echo "Run: $ROOT/scripts/setup_venv.sh" >&2
  return 1 2>/dev/null || exit 1
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"
