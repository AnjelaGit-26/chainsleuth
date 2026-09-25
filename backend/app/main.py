"""
main.py – ChainSleuth FastAPI application entry point.

Uvicorn entry point::

    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Or run directly::

    python -m app.main
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import (
    routes_audit,
    routes_auth,
    routes_cases,
    routes_fir,
    routes_ncrp,
    routes_notice,
    routes_report,
    routes_trace,
    routes_vasp,
)
from app.core.config import get_settings
from app.core.database import (
    close_neo4j,
    close_redis,
    ensure_schema,
    init_neo4j,
    init_redis,
)
from app.engine.tron_tracer import close_http_client

log      = logging.getLogger(__name__)
settings = get_settings()

# Configure root logger
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

# ── Static files directory (for generated PDFs) ───────────────────────────────
_STATIC_ROOT = Path("static")
_STATIC_NOTICES = _STATIC_ROOT / "notices"
_STATIC_NOTICES.mkdir(parents=True, exist_ok=True)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup / shutdown lifecycle manager.

    Startup:
      - Initialise Neo4j async connection pool
      - Initialise Redis async client
      - Bootstrap Neo4j graph schema (constraints + indexes)

    Shutdown:
      - Drain Neo4j connection pool
      - Close Redis connection pool
      - Close shared httpx client pool
    """
    log.info("━━ ChainSleuth starting up ━━")

    try:
        await init_neo4j()
        log.info("✓ Neo4j driver pool ready")
    except Exception as exc:
        log.error("Could not initialize Neo4j driver on startup: %s", exc)

    try:
        await init_redis()
        log.info("✓ Redis client ready")
    except Exception as exc:
        log.error("Could not initialize Redis client on startup: %s", exc)

    try:
        await ensure_schema()
        log.info("✓ Neo4j schema constraints/indexes verified")
    except Exception as exc:
        log.warning("Neo4j schema verification deferred or skipped: %s", exc)

    log.info("━━ ChainSleuth is ready ━━  docs → http://localhost:8000/docs")
    yield

    log.info("━━ ChainSleuth shutting down ━━")
    await close_neo4j()
    await close_redis()
    await close_http_client()
    log.info("━━ All connections closed. Goodbye. ━━")


# ── Application factory ───────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "## ChainSleuth — Blockchain Forensics Platform\n\n"
        "A law-enforcement-grade tool for tracing cryptocurrency transactions, "
        "detecting money-laundering typologies, attributing suspect addresses to "
        "VASPs/exchanges, and generating court-ready legal documents.\n\n"
        "### Key capabilities\n"
        "- **Trace** — Multi-hop BFS over TRON/ETH/Solana with value-weighted pruning\n"
        "- **Typology** — Peeling-chain detector, first-funder tracer, fan-out analysis\n"
        "- **VASP Attribution** — Hot-wallet step-back to isolate KYC deposit addresses\n"
        "- **Legal Docs** — Section 94 BNSS notice PDFs with Section 63 BSA SHA-256 stamp\n"
        "- **AI Parser** — Gemini-powered complaint text → structured TraceRequest\n"
    ),
    contact={
        "name":  "ChainSleuth Team",
        "email": "support@chainsleuth.in",
    },
    license_info={
        "name": "Proprietary — Law Enforcement Use Only",
    },
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


# ── Middleware ─────────────────────────────────────────────────────────────────

# CORS — allow the ChainSleuth frontend + localhost dev
_CORS_ORIGINS = [
    "http://localhost:3000",    # React / Next.js dev
    "http://localhost:5173",    # Vite dev
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "https://chainsleuth.in",   # Production frontend
    "https://app.chainsleuth.in",
]

if settings.CORS_ORIGINS:
    for origin in settings.CORS_ORIGINS.split(","):
        cleaned = origin.strip()
        if cleaned and cleaned not in _CORS_ORIGINS:
            _CORS_ORIGINS.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = _CORS_ORIGINS,
    allow_origin_regex = r"^https?://.*",
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
    expose_headers    = ["X-Request-ID", "X-Trace-ID"],
    max_age           = 600,    # preflight cache: 10 minutes
)

# GZip — compress responses > 1 KB
app.add_middleware(GZipMiddleware, minimum_size=1024)


# ── Static files ───────────────────────────────────────────────────────────────
# Serve generated PDFs at /static/notices/{filename}.pdf
app.mount(
    "/static",
    StaticFiles(directory=str(_STATIC_ROOT)),
    name="static",
)


# ── API Routers ────────────────────────────────────────────────────────────────

_API_PREFIX = "/api/v1"

app.include_router(routes_auth.router,   prefix=_API_PREFIX)
app.include_router(routes_trace.router,  prefix=_API_PREFIX)
app.include_router(routes_cases.router,  prefix=_API_PREFIX)
app.include_router(routes_fir.router,    prefix=_API_PREFIX)
app.include_router(routes_notice.router, prefix=_API_PREFIX)
app.include_router(routes_ncrp.router,   prefix=_API_PREFIX)
app.include_router(routes_vasp.router,   prefix=_API_PREFIX)
app.include_router(routes_audit.router,  prefix=_API_PREFIX)
app.include_router(routes_report.router, prefix=_API_PREFIX)



# ── Health & Info endpoints ────────────────────────────────────────────────────

@app.get("/health", tags=["Health"], summary="Liveness probe")
async def health_check() -> dict:
    """Simple liveness probe for load balancers and Docker health checks."""
    return {
        "status":  "ok",
        "app":     settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/ready", tags=["Health"], summary="Readiness probe")
async def readiness_check() -> dict:
    """
    Readiness probe — verifies Neo4j and Redis connectivity.
    Returns 200 only when all dependencies are reachable.
    """
    from fastapi import HTTPException as _HTTPException

    from app.core.database import init_neo4j as _neo4j
    from app.core.database import init_redis as _redis

    errors: list[str] = []

    try:
        driver = await _neo4j()
        await driver.verify_connectivity()
    except Exception as exc:
        errors.append(f"neo4j: {exc}")

    try:
        redis = await _redis()
        await redis.ping()
    except Exception as exc:
        errors.append(f"redis: {exc}")

    if errors:
        raise _HTTPException(
            status_code=503,
            detail={"status": "not_ready", "errors": errors},
        )

    return {"status": "ready", "dependencies": {"neo4j": "ok", "redis": "ok"}}


@app.get("/", tags=["Info"], include_in_schema=False)
async def root() -> dict:
    """Redirect hint for the API root."""
    return {
        "message": f"Welcome to {settings.APP_NAME} v{settings.APP_VERSION}",
        "docs":    "/docs",
        "health":  "/health",
    }


# ── Dev server entry point ─────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="debug" if settings.DEBUG else "info",
        access_log=True,
    )
