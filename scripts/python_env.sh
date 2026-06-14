# Source before using Python when installed to ~/Library/Frameworks (user-local pkg).
# System-wide installs under /Library/Frameworks do not need these variables.

_user_python_framework="$HOME/Library/Frameworks/Python.framework/Versions/3.14"
if [[ -d "$_user_python_framework" && ! -d "/Library/Frameworks/Python.framework/Versions/3.14" ]]; then
  export DYLD_FRAMEWORK_PATH="${DYLD_FRAMEWORK_PATH:-}:$HOME/Library/Frameworks"
  export DYLD_LIBRARY_PATH="${DYLD_LIBRARY_PATH:-}:$_user_python_framework/lib"
  # Trim leading colon if vars were unset
  export DYLD_FRAMEWORK_PATH="${DYLD_FRAMEWORK_PATH#:}"
  export DYLD_LIBRARY_PATH="${DYLD_LIBRARY_PATH#:}"
fi
unset _user_python_framework
