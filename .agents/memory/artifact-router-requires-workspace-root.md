---
name: Artifact router requires artifacts under the workspace root
description: Why a cloned project living in a subdirectory (e.g. external/<repo>/) breaks the shared proxy on port 80 even though each service runs fine individually.
---

## The shared proxy (port 80) only routes artifacts registered under the workspace root

If a project is cloned into a subdirectory (e.g. `external/my-repo/`) instead of the workspace root, `listArtifacts()` can still auto-detect and register the `artifact.toml` files there, and each service's workflow starts fine — but the platform's built-in proxy on port 80 (run by `pid1`, using the `REPLIT_ARTIFACT_ROUTER` binary) returns 502 for every path. Individual service ports (e.g. `curl localhost:24668`) work; only the shared port-80 proxy fails.

**Why:** the artifact router expects `artifact.toml` files at `<workspace-root>/artifacts/<slug>/.replit-artifact/artifact.toml`. A subdirectory clone's `artifacts/` folder is outside that expected root, so routing silently fails even though registration and workflows appear normal.

**How to apply:** when cloning/restoring a full project into the repl, move its contents up to the workspace root (merge `.agents/`, replace root scaffold files) rather than leaving it nested — do this before spending time debugging proxy 502s. After moving, `touch` each `artifact.toml` (or otherwise trigger a filesystem event) to force the platform to re-scan and re-register artifacts at the new paths; workflows for the old nested paths will need restarting once (they'll fail, which is expected) and new ones get auto-created at the correct paths.
