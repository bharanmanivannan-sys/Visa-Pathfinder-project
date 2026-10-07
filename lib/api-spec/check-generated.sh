#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(git -C "$script_dir" rev-parse --show-toplevel)
cd "$repo_root"

set -- \
  lib/api-client-react/src/generated \
  lib/api-zod/src/generated

if ! git diff --quiet HEAD -- "$@"; then
  echo "Generated API files differ from the committed output. Run 'pnpm --filter @workspace/api-spec run codegen' and commit the updated generated files." >&2
  git diff -- HEAD -- "$@" >&2
  exit 1
fi

untracked_files=$(git ls-files --others --exclude-standard -- "$@")
if [ -n "$untracked_files" ]; then
  echo "Orval generated files that are not tracked by Git:" >&2
  printf '%s\n' "$untracked_files" >&2
  echo "Review and commit the generated files, then rerun 'pnpm run check:api-codegen'." >&2
  exit 1
fi

echo "Generated API client and Zod schema files match the committed output."
