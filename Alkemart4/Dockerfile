# DEPRECATED — Express dual-home API is archived.
#
# Live commerce API: apps/backend (Mercur + Medusa) on port 9000.
# Buyer SPA: apps/storefront (Vite) on port 5175.
# See docs/architecture/2026-07-16-clean-slate-backend.md
# and docs/architecture/2026-07-17-dead-project-cleanup.md
#
# Express source (reference only):
#   archive/express-api-server-legacy/
#   archive/express-libs-legacy/
#
# Do not build this file for production. Use a Medusa/Mercur deploy
# (e.g. apps/backend Dockerfile or platform recipe) instead.

FROM oven/bun:1.3 AS refuse
RUN echo "This Dockerfile targeted the archived Express API." && \
    echo "Use apps/backend (Mercur) for the marketplace API." && \
    exit 1
