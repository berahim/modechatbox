#!/usr/bin/env bash
# Install Python 3.14.6 on macOS (official python.org pkg).
set -euo pipefail

VERSION="3.14.6"
PKG_URL="https://www.python.org/ftp/python/${VERSION}/python-${VERSION}-macos11.pkg"
PKG_PATH="/tmp/python-${VERSION}-macos11.pkg"

if [[ -x "/Library/Frameworks/Python.framework/Versions/3.14/bin/python3.14" ]]; then
  echo "Python 3.14 is already installed system-wide."
  exit 0
fi

if [[ -x "$HOME/Library/Frameworks/Python.framework/Versions/3.14/bin/python3.14" ]]; then
  echo "Python 3.14 is already installed in your home directory."
  exit 0
fi

echo "Downloading Python ${VERSION}..."
curl -fL "$PKG_URL" -o "$PKG_PATH"

echo "Installing Python ${VERSION}..."
if installer -pkg "$PKG_PATH" -target / 2>/dev/null; then
  echo "Installed system-wide to /Library/Frameworks/Python.framework"
else
  echo "System install needs admin password; installing to your home directory instead..."
  installer -pkg "$PKG_PATH" -target CurrentUserHomeDirectory
  echo "Installed to ~/Library/Frameworks/Python.framework"
  echo "Note: activate the venv with 'source .venv/bin/activate' (paths are configured automatically)."
fi

echo "Done. Run ./scripts/setup_venv.sh next."
