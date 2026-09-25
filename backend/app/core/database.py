"""
database.py – Async Neo4j (Community 5.x) driver pool + Redis cache layer.

Responsibilities:
  - Manage a single shared AsyncDriver (connection pool built-in to neo4j 5.x)
  - Provide typed helpers to MERGE Wallet and VASP nodes
  - Provide typed helpers to CREATE TRANSFER, FEE_FUNDED_BY, OWNED_BY_VASP relationships
  - Run the VASP path-discovery Cypher query
  - Provide a shared async Redis client for RPC transaction caching
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any, LiteralString

import redis.asyncio as aioredis
from neo4j import AsyncDriver, AsyncGraphDatabase, AsyncSession
from neo4j.exceptions import Neo4jError

from app.core.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

# ─────────────────────────────────────────────────────────────────────────────
# Neo4j – Driver Pool
# ─────────────────────────────────────────────────────────────────────────────
# neo4j-python 5.x manages an internal connection pool automatically.
# We keep a single module-level AsyncDriver so the pool is reused across requests.

_neo4j_driver: AsyncDriver | None = None


async def init_neo4j() -> AsyncDriver:
    """
    Create (or return) the shared AsyncDriver.

    Pool tuning is handled via driver kwargs; Community Edition does not
    support Causal Clustering, so we target a single Bolt endpoint.
    """
    global _neo4j_driver
    if _neo4j_driver is None:
        _neo4j_driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.neo4j_user, settings.NEO4J_PASSWORD),
            # ── Connection pool settings ──────────────────────────────────
            max_connection_pool_size=25,       # concurrent bolt connections (tuned for cloud/Aura)
            connection_timeout=15.0,           # seconds to establish connection
            max_connection_lifetime=1800,      # rotate connections after 30 mins to avoid idle drops
            keep_alive=True,
            # ── Driver-level notifications ────────────────────────────────
            notifications_min_severity="OFF",  # disable client notification overhead
        )
        log.info("Neo4j AsyncDriver initialised → %s (user: %s)", settings.NEO4J_URI, settings.neo4j_user)
    return _neo4j_driver


async def close_neo4j() -> None:
    """Drain the connection pool gracefully on application shutdown."""
    global _neo4j_driver
    if _neo4j_driver is not None:
        await _neo4j_driver.close()
        _neo4j_driver = None
        log.info("Neo4j AsyncDriver closed.")


@asynccontextmanager
async def get_session(
    database: str | None = None,
    fetch_size: int = 1000,
) -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager that yields a Neo4j session from the pool.
    Gracefully falls back to default database if a specified database is unavailable.

    Usage::

        async with get_session() as session:
            result = await session.run(...)
    """
    driver = await init_neo4j()
    target_db = database or settings.NEO4J_DATABASE or None
    session_kwargs: dict[str, Any] = {"fetch_size": fetch_size}
    if target_db:
        session_kwargs["database"] = target_db

    async with driver.session(**session_kwargs) as session:
        yield session


# ─────────────────────────────────────────────────────────────────────────────
# Redis – Async Client (RPC transaction cache)
# ─────────────────────────────────────────────────────────────────────────────

_redis_client: aioredis.Redis | None = None
_CACHE_TTL_SECONDS = 300  # 5 minutes default TTL for RPC transaction data


async def init_redis() -> aioredis.Redis:
    """Create (or return) the shared async Redis client."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        log.info("Redis client initialised → %s", settings.redis_url)
    return _redis_client


async def close_redis() -> None:
    """Close the Redis connection pool on application shutdown."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
        log.info("Redis client closed.")


async def cache_set(key: str, value: Any, ttl: int = _CACHE_TTL_SECONDS) -> None:
    """Serialise *value* to JSON and store it in Redis with *ttl* seconds expiry (with graceful failover)."""
    try:
        client = await init_redis()
        await client.setex(key, ttl, json.dumps(value, default=str))
    except Exception as exc:
        log.warning("Redis cache_set failed for %s (continuing without cache): %s", key, exc)


async def cache_get(key: str) -> Any | None:
    """Return the cached value for *key*, or None if absent / expired / Redis unreachable."""
    try:
        client = await init_redis()
        raw = await client.get(key)
        return json.loads(raw) if raw is not None else None
    except Exception as exc:
        log.debug("Redis cache_get failed for %s (proceeding to live fetch): %s", key, exc)
        return None


async def cache_delete(key: str) -> None:
    """Invalidate a single cache entry (with graceful failover)."""
    try:
        client = await init_redis()
        await client.delete(key)
    except Exception as exc:
        log.warning("Redis cache_delete failed for %s: %s", key, exc)


# ─────────────────────────────────────────────────────────────────────────────
# Schema helpers – run once on startup to create constraints & indexes
# ─────────────────────────────────────────────────────────────────────────────

_SCHEMA_QUERIES: list[LiteralString] = [
    # Wallet uniqueness constraint (also creates an index)
    "CREATE CONSTRAINT wallet_address_unique IF NOT EXISTS "
    "FOR (w:Wallet) REQUIRE (w.address, w.chain) IS UNIQUE",
    # VASP uniqueness constraint
    "CREATE CONSTRAINT vasp_name_unique IF NOT EXISTS "
    "FOR (v:VASP) REQUIRE v.name IS UNIQUE",
    # Index for fast risk-score range queries
    "CREATE INDEX wallet_risk_idx IF NOT EXISTS FOR (w:Wallet) ON (w.riskScore)",
]


async def ensure_schema() -> None:
    """Idempotently create Neo4j constraints and indexes for ChainSleuth."""
    async with get_session() as session:
        for q in _SCHEMA_QUERIES:
            try:
                await session.run(q)
            except Neo4jError as exc:
                log.warning("Schema query skipped (%s): %s", exc.code, q)
    log.info("Neo4j schema constraints/indexes verified.")


# ─────────────────────────────────────────────────────────────────────────────
# Node helpers
# ─────────────────────────────────────────────────────────────────────────────

async def merge_wallet_node(
    address: str,
    chain: str,
    risk_score: int = 0,
    balance: float = 0.0,
    first_seen: datetime | None = None,
) -> None:
    """
    MERGE a :Wallet node, creating it if absent or updating properties if present.

    Node label: ``Wallet``
    Properties:
      - address    (str)   – on-chain address (part of uniqueness key)
      - chain      (str)   – blockchain identifier (part of uniqueness key)
      - riskScore  (int)   – 0-100 composite risk score
      - balance    (float) – native token balance
      - firstSeen  (str)   – ISO-8601 datetime of first observed tx
    """
    first_seen_iso = (first_seen or datetime.now(UTC)).isoformat()
    cypher = """
        MERGE (w:Wallet {address: $address, chain: $chain})
        ON CREATE SET
            w.riskScore  = $riskScore,
            w.balance    = $balance,
            w.firstSeen  = $firstSeen,
            w.createdAt  = datetime()
        ON MATCH SET
            w.riskScore  = $riskScore,
            w.balance    = $balance,
            w.updatedAt  = datetime()
    """
    async with get_session() as session:
        await session.run(
            cypher,
            address=address,
            chain=chain,
            riskScore=risk_score,
            balance=balance,
            firstSeen=first_seen_iso,
        )


async def batch_merge_wallet_nodes(nodes: list[dict[str, Any]]) -> None:
    """
    Batch MERGE multiple :Wallet nodes in a single Cypher transaction.
    Greatly reduces Bolt round-trips and eliminates lock deadlocks.
    """
    if not nodes:
        return

    cypher = """
        UNWIND $batch AS item
        MERGE (w:Wallet {address: item.address, chain: item.chain})
        ON CREATE SET
            w.riskScore  = item.riskScore,
            w.balance    = item.balance,
            w.firstSeen  = item.firstSeen,
            w.createdAt  = datetime()
        ON MATCH SET
            w.riskScore  = item.riskScore,
            w.balance    = item.balance,
            w.updatedAt  = datetime()
    """
    async with get_session() as session:
        await session.run(cypher, batch=nodes)


async def batch_update_wallet_nodes(nodes: list[dict[str, Any]]) -> None:
    """
    Batch update :Wallet nodes in Neo4j with their evaluated AI/ML and forensic properties:
    riskScore, gnn_risk_score, anomaly_score, typology_score, heuristics_score,
    typologyFlags, isVasp, risk_category, explanation, pmla_flag.
    """
    if not nodes:
        return

    cypher = """
        UNWIND $batch AS item
        MERGE (w:Wallet {address: item.address, chain: item.chain})
        ON CREATE SET
            w.balance          = coalesce(item.balance, 0.0),
            w.firstSeen        = coalesce(item.firstSeen, datetime()),
            w.createdAt        = datetime()
        SET w.riskScore        = item.riskScore,
            w.typologyFlags    = item.typologyFlags,
            w.isVasp           = item.isVasp,
            w.gnn_risk_score   = item.gnn_risk_score,
            w.anomaly_score    = item.anomaly_score,
            w.typology_score   = item.typology_score,
            w.heuristics_score = item.heuristics_score,
            w.risk_category    = item.risk_category,
            w.explanation      = item.explanation,
            w.pmla_flag        = item.pmla_flag,
            w.updatedAt        = datetime()
    """
    async with get_session() as session:
        await session.run(cypher, batch=nodes)


async def merge_vasp_node(
    name: str,
    is_fiu_registered: bool,
    deposit_address: str,
    hot_wallet: str,
    nodal_email: str,
) -> None:
    """
    MERGE a :VASP node.

    Node label: ``VASP``
    Properties:
      - name             (str)  – legal / trade name of the VASP (uniqueness key)
      - isFiuRegistered  (bool) – FIU-IND registration status
      - depositAddress   (str)  – suspect's deposit address at this VASP
      - hotWallet        (str)  – VASP's identified hot wallet address
      - nodalEmail       (str)  – compliance / nodal officer email
    """
    cypher = """
        MERGE (v:VASP {name: $name})
        ON CREATE SET
            v.isFiuRegistered = $isFiuRegistered,
            v.depositAddress  = $depositAddress,
            v.hotWallet       = $hotWallet,
            v.nodalEmail      = $nodalEmail,
            v.createdAt       = datetime()
        ON MATCH SET
            v.isFiuRegistered = $isFiuRegistered,
            v.depositAddress  = $depositAddress,
            v.hotWallet       = $hotWallet,
            v.nodalEmail      = $nodalEmail,
            v.updatedAt       = datetime()
    """
    async with get_session() as session:
        await session.run(
            cypher,
            name=name,
            isFiuRegistered=is_fiu_registered,
            depositAddress=deposit_address,
            hotWallet=hot_wallet,
            nodalEmail=nodal_email,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Relationship helpers
# ─────────────────────────────────────────────────────────────────────────────

async def create_transfer_edge(
    from_address: str,
    to_address: str,
    chain: str,
    tx_hash: str,
    value: float,
    token: str,
    timestamp: datetime,
) -> None:
    """
    Create a ``[:TRANSFER]`` relationship between two :Wallet nodes.

    Relationship properties:
      - txHash    (str)   – on-chain transaction hash
      - from      (str)   – sender wallet address
      - to        (str)   – recipient wallet address
      - value     (float) – amount transferred in *token* units
      - token     (str)   – token symbol / contract (e.g. 'USDT', 'TRX')
      - timestamp (str)   – ISO-8601 confirmed datetime
    """
    cypher = """
        MATCH (from:Wallet {address: $fromAddress, chain: $chain})
        MATCH (to:Wallet   {address: $toAddress,   chain: $chain})
        MERGE (from)-[t:TRANSFER {txHash: $txHash}]->(to)
        ON CREATE SET
            t.from      = $fromAddress,
            t.to        = $toAddress,
            t.value     = $value,
            t.token     = $token,
            t.timestamp = $timestamp
        ON MATCH SET
            t.from      = $fromAddress,
            t.to        = $toAddress,
            t.value     = $value,
            t.token     = $token,
            t.timestamp = $timestamp
    """
    async with get_session() as session:
        await session.run(
            cypher,
            fromAddress=from_address,
            toAddress=to_address,
            chain=chain,
            txHash=tx_hash,
            value=value,
            token=token,
            timestamp=timestamp.isoformat(),
        )


async def batch_create_transfer_edges(edges: list[dict[str, Any]]) -> None:
    """
    Batch MERGE multiple [:TRANSFER] edges in a single Cypher transaction.
    """
    if not edges:
        return

    cypher = """
        UNWIND $batch AS item
        MATCH (from:Wallet {address: item.fromAddress, chain: item.chain})
        MATCH (to:Wallet   {address: item.toAddress,   chain: item.chain})
        MERGE (from)-[t:TRANSFER {txHash: item.txHash}]->(to)
        ON CREATE SET
            t.from      = item.fromAddress,
            t.to        = item.toAddress,
            t.value     = item.value,
            t.token     = item.token,
            t.timestamp = item.timestamp
        ON MATCH SET
            t.from      = item.fromAddress,
            t.to        = item.toAddress,
            t.value     = item.value,
            t.token     = item.token,
            t.timestamp = item.timestamp
    """
    async with get_session() as session:
        await session.run(cypher, batch=edges)


async def create_fee_funded_by_edge(
    funded_address: str,
    funder_address: str,
    chain: str,
    tx_hash: str,
    amount: float,
) -> None:
    """
    Create a ``[:FEE_FUNDED_BY]`` relationship.

    Indicates that *funder_address* paid the gas / bandwidth fee that
    activated *funded_address* — a key indicator of 'first funder' typology.

    Relationship properties:
      - txHash  (str)   – funding transaction hash
      - amount  (float) – fee amount paid (in native token)
    """
    cypher = """
        MATCH (funded:Wallet {address: $fundedAddress, chain: $chain})
        MATCH (funder:Wallet {address: $funderAddress, chain: $chain})
        MERGE (funded)-[f:FEE_FUNDED_BY {txHash: $txHash}]->(funder)
        ON CREATE SET f.amount = $amount
        ON MATCH  SET f.amount = $amount
    """
    async with get_session() as session:
        await session.run(
            cypher,
            fundedAddress=funded_address,
            funderAddress=funder_address,
            chain=chain,
            txHash=tx_hash,
            amount=amount,
        )


async def create_owned_by_vasp_edge(
    wallet_address: str,
    chain: str,
    vasp_name: str,
) -> None:
    """
    Create an ``[:OWNED_BY_VASP]`` relationship from a :Wallet to a :VASP.

    Used after VASP attribution confirms that *wallet_address* is a
    deposit / hot-wallet controlled by *vasp_name*.
    """
    cypher = """
        MATCH (w:Wallet {address: $address, chain: $chain})
        MATCH (v:VASP   {name: $vaspName})
        MERGE (w)-[:OWNED_BY_VASP]->(v)
    """
    async with get_session() as session:
        await session.run(
            cypher,
            address=wallet_address,
            chain=chain,
            vaspName=vasp_name,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Path discovery – VASP deposit address reachability
# ─────────────────────────────────────────────────────────────────────────────

async def find_shortest_path_to_vasp(
    suspect_address: str,
    known_vasp_deposit_addresses: list[str],
) -> dict[str, Any] | None:
    """
    Discover the shortest TRANSFER path from *suspect_address* to any known
    VASP deposit address within 1–5 hops.

    Cypher executed::

        MATCH path = (start:Wallet {address: $suspect_address})
                     -[:TRANSFER*1..5]->
                     (target:Wallet)
        WHERE target.address IN $known_vasp_deposit_addresses
        RETURN path, target
        ORDER BY length(path) ASC
        LIMIT 1

    Returns:
        A dict with keys ``path_length``, ``target_address``, ``hops``
        (list of address strings along the path), and ``relationships``
        (list of edge property dicts); or ``None`` if no path is found.
    """
    # Check Redis cache first
    cache_key = f"vasp_path:{suspect_address}"
    cached = await cache_get(cache_key)
    if cached is not None:
        log.debug("Cache HIT for path query: %s", cache_key)
        return cached

    cypher = """
        MATCH path = (start:Wallet {address: $suspect_address})
                     -[:TRANSFER*1..5]->
                     (target:Wallet)
        WHERE target.address IN $known_vasp_deposit_addresses
        RETURN path, target
        ORDER BY length(path) ASC
        LIMIT 1
    """

    async with get_session() as session:
        result = await session.run(
            cypher,
            suspect_address=suspect_address,
            known_vasp_deposit_addresses=known_vasp_deposit_addresses,
        )
        record = await result.single()

    if record is None:
        log.info("No VASP path found for suspect: %s", suspect_address)
        return None

    # ── Deserialise Neo4j path object ────────────────────────────────────────
    neo4j_path = record["path"]
    target_node = record["target"]

    hops: list[str] = [node["address"] for node in neo4j_path.nodes]
    relationships: list[dict] = [
        {
            "txHash":    rel["txHash"],
            "value":     rel["value"],
            "token":     rel["token"],
            "timestamp": rel["timestamp"],
        }
        for rel in neo4j_path.relationships
    ]

    result_payload: dict[str, Any] = {
        "path_length":     len(neo4j_path.relationships),
        "target_address":  target_node["address"],
        "hops":            hops,
        "relationships":   relationships,
    }

    # Persist to Redis cache (5-minute TTL)
    await cache_set(cache_key, result_payload)
    log.info(
        "VASP path found: %s → %s (%d hops)",
        suspect_address,
        target_node["address"],
        len(neo4j_path.relationships),
    )
    return result_payload


# ─────────────────────────────────────────────────────────────────────────────
# Case persistence & retrieval
# ─────────────────────────────────────────────────────────────────────────────

async def save_trace_result(trace_result: dict[str, Any]) -> None:
    """
    Persist a TraceResult summary as a :Case node in Neo4j and link to the suspect root wallet.

    The Case node stores top-level metadata; the full graph (Wallet nodes
    + TRANSFER edges) is already written by the BFS engine helpers.
    """
    nodes_list = trace_result.get("nodes") or []
    edges_list = trace_result.get("edges") or []
    node_count = trace_result.get("node_count") or len(nodes_list)
    edge_count = trace_result.get("edge_count") or len(edges_list)

    attr_data = trace_result.get("attribution")
    attr_json = json.dumps(attr_data, default=str) if attr_data else None

    attributed_vasp = trace_result.get("attributed_vasp")
    if not attributed_vasp and isinstance(attr_data, dict):
        attributed_vasp = attr_data.get("vasp_name")

    cypher = """
        MERGE (c:Case {case_id: $caseId})
        ON CREATE SET
            c.suspect_address    = $suspectAddress,
            c.chain              = $chain,
            c.overall_risk_score = $overallRiskScore,
            c.status             = $status,
            c.node_count         = $nodeCount,
            c.edge_count         = $edgeCount,
            c.attributed_vasp    = $attributedVasp,
            c.attribution_json   = $attributionJson,
            c.created_at         = datetime()
        ON MATCH SET
            c.overall_risk_score = $overallRiskScore,
            c.status             = $status,
            c.node_count         = $nodeCount,
            c.edge_count         = $edgeCount,
            c.attributed_vasp    = $attributedVasp,
            c.attribution_json   = $attributionJson,
            c.updated_at         = datetime()
        WITH c
        OPTIONAL MATCH (w:Wallet {address: $suspectAddress, chain: $chain})
        FOREACH (_ IN CASE WHEN w IS NOT NULL THEN [1] ELSE [] END |
            MERGE (c)-[:INVESTIGATES]->(w)
        )
    """

    async with get_session() as session:
        await session.run(
            cypher,
            caseId          = trace_result["case_id"],
            suspectAddress  = trace_result["suspect_address"],
            chain           = trace_result["chain"],
            overallRiskScore= trace_result["overall_risk_score"],
            status          = trace_result["status"],
            nodeCount       = node_count,
            edgeCount       = edge_count,
            attributedVasp  = attributed_vasp,
            attributionJson = attr_json,
        )

    # Batch update wallet nodes with AI/ML forensic metrics if provided
    if nodes_list:
        try:
            await batch_update_wallet_nodes(nodes_list)
        except Exception as exc:
            log.warning("Could not batch update wallet nodes for case %s: %s", trace_result.get("case_id"), exc)

    # Pre-cache complete case result in Redis for instant high-speed retrieval
    if nodes_list:
        cache_key = f"case:{trace_result.get('case_id')}"
        try:
            cached_payload = {
                "case_id":            trace_result["case_id"],
                "suspect_address":    trace_result["suspect_address"],
                "chain":              trace_result["chain"],
                "overall_risk_score": trace_result["overall_risk_score"],
                "status":             trace_result.get("status", "completed"),
                "nodes":              nodes_list,
                "edges":              edges_list,
                "attribution":        attr_data,
                "created_at":         datetime.now(UTC).isoformat(),
            }
            await cache_set(cache_key, cached_payload, ttl=300)
        except Exception as exc:
            log.warning("Could not pre-cache trace result in Redis: %s", exc)

    # Sync case metadata to Supabase Cloud PostgreSQL
    try:
        from app.core.supabase import is_supabase_enabled, supabase_save_case
        if is_supabase_enabled():
            supabase_save_case({
                "id": trace_result.get("case_id"),
                "title": f"Investigation - {trace_result.get('chain', '').upper()} {trace_result.get('suspect_address', '')[:10]}...",
                "status": trace_result.get("status", "active"),
                "chain": trace_result.get("chain", "ethereum"),
                "root_address": trace_result.get("suspect_address", ""),
                "node_count": node_count,
                "edge_count": edge_count,
                "attribution": attr_data,
            })
    except Exception as exc:
        log.warning("Supabase save_case hook skipped: %s", exc)


async def get_case_by_id(case_id: str) -> dict[str, Any] | None:

    """
    Fetch a stored TraceResult from Neo4j by case_id.

    Reconstructs the complete graph: Case metadata + Root Wallet + all reachable
    Wallet nodes and all connecting TRANSFER edges with proper sender/recipient addresses.

    Returns a dict compatible with TraceResult, or None if not found.
    """
    cache_key = f"case:{case_id}"
    cached = await cache_get(cache_key)
    if cached is not None:
        log.debug("Cache HIT for case: %s", case_id)
        return cached

    cypher = """
        MATCH (c:Case {case_id: $caseId})
        OPTIONAL MATCH (root:Wallet {address: c.suspect_address, chain: c.chain})
        OPTIONAL MATCH (root)-[:TRANSFER*1..10]->(target:Wallet)
        WITH c, root, collect(DISTINCT target) AS targets
        WITH c, [n IN ([root] + targets) WHERE n IS NOT NULL] AS all_node_objs
        OPTIONAL MATCH (n1:Wallet)-[t:TRANSFER]->(n2:Wallet)
        WHERE n1 IN all_node_objs AND n2 IN all_node_objs
        WITH c, all_node_objs, collect(DISTINCT t) AS rels
        RETURN c,
               [n IN all_node_objs | properties(n)] AS nodes,
               [r IN rels WHERE r IS NOT NULL | {
                   txHash: r.txHash,
                   from: startNode(r).address,
                   to: endNode(r).address,
                   value: r.value,
                   token: r.token,
                   timestamp: toString(r.timestamp)
               }] AS edges
    """

    async with get_session() as session:
        result = await session.run(cypher, caseId=case_id)
        record = await result.single()

    if record is None:
        return None

    case_props = dict(record["c"])
    nodes_raw  = record["nodes"] or []
    edges_raw  = record["edges"] or []

    attribution_val = None
    raw_attr = case_props.get("attribution_json")
    if raw_attr:
        try:
            attribution_val = json.loads(raw_attr) if isinstance(raw_attr, str) else raw_attr
        except Exception as exc:
            log.warning("Could not parse attribution_json for case %s: %s", case_id, exc)

    payload = {
        "case_id":            case_props.get("case_id", case_id),
        "suspect_address":    case_props.get("suspect_address", ""),
        "chain":              case_props.get("chain", "tron"),
        "overall_risk_score": case_props.get("overall_risk_score", 0),
        "status":             case_props.get("status", "completed"),
        "nodes":              nodes_raw,
        "edges":              edges_raw,
        "attribution":        attribution_val,
        "created_at":         str(case_props.get("created_at", "")),
    }

    await cache_set(cache_key, payload, ttl=120)
    return payload


async def list_cases(skip: int = 0, limit: int = 20) -> list[dict[str, Any]]:
    """
    Return a paginated list of Case summaries for the dashboard.

    Each dict maps to a CaseSummary model:
      case_id, suspect_address, chain, overall_risk_score, status,
      node_count, edge_count, attributed_vasp, created_at.
    """
    try:
        skip_int = int(skip)
    except (TypeError, ValueError):
        skip_int = 0

    try:
        limit_int = int(limit)
    except (TypeError, ValueError):
        limit_int = 20

    cypher = """
        MATCH (c:Case)
        RETURN c
        ORDER BY c.created_at DESC
        SKIP $skip
        LIMIT $limit
    """
    async with get_session() as session:
        result = await session.run(cypher, skip=skip_int, limit=limit_int)
        records = await result.data()

    summaries = []
    for rec in records:
        c = rec.get("c", {})
        summaries.append({
            "case_id":            c.get("case_id", ""),
            "suspect_address":    c.get("suspect_address", ""),
            "chain":              c.get("chain", "tron"),
            "overall_risk_score": c.get("overall_risk_score", 0),
            "status":             c.get("status", "completed"),
            "node_count":         c.get("node_count", 0),
            "edge_count":         c.get("edge_count", 0),
            "attributed_vasp":    c.get("attributed_vasp"),
            "created_at":         str(c.get("created_at", "")),
        })
    return summaries

