#!/bin/bash
# Fails when the committed orval client is stale relative to openapi.yaml.
# Run in CI after `bun install`. Regenerate with:
#   bun run --filter @alkemart/api-client generate
set -euo pipefail
cd "$(dirname "$0")/.."
bun run --filter @alkemart/api-client generate >/dev/null 2>&1
if ! git diff --quiet -- packages/api-client/src/generated/; then
  echo "check-api-client FAILED: generated client is stale. Run 'bun run --filter @alkemart/api-client generate' and commit the result."
  exit 1
fi
echo "check-api-client OK (client matches openapi.yaml)"
