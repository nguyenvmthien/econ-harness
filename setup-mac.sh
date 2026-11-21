#!/usr/bin/env bash
# macOS setup for econ-harness (used for testing; the main machine runs Windows).
#
#   ./setup-mac.sh [--skip-install] [--skip-r] [--offline] [--no-register]
#
# Export OPENALEX_EMAIL, SEMANTIC_SCHOLAR_API_KEY and ELSEVIER_API_KEY first if you have them.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

SKIP_INSTALL=0
PASS=()
for a in "$@"; do
  case "$a" in
    --skip-install) SKIP_INSTALL=1 ;;
    *) PASS+=("$a") ;;
  esac
done

if [[ $SKIP_INSTALL -eq 0 ]]; then
  command -v brew >/dev/null || { echo "Homebrew is required: https://brew.sh"; exit 1; }
  for f in node git r python; do brew list --formula "$f" >/dev/null 2>&1 || brew install "$f"; done
  command -v quarto >/dev/null || brew install --cask quarto
  [[ -d /Applications/RStudio.app ]] || brew install --cask rstudio
fi

export ECON_ROOT="$ROOT"
node "$ROOT/harness/setup/setup.mjs" "${PASS[@]+"${PASS[@]}"}"
