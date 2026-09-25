"""
custom_db.py – Custom VASP Attribution Database & Continuous Enrichment Pipeline.

Allows law enforcement investigators and analysts to:
1. Store and query internal custom labeled addresses (exchange KYC deposit accounts,
   seized wallets, mule networks, syndicate cash-out points).
2. Bulk-ingest threat intelligence from court orders, FIU-IND communications,
   and CSV/JSON seizure manifests.
3. Automatically enrich trace graphs with custom agency intelligence.
"""
from __future__ import annotations

import csv
import io
import json
import logging
import sqlite3
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from app.core.supabase import (
    is_supabase_enabled,
    supabase_count_labels,
    supabase_get_label,
    supabase_search_labels,
    supabase_upsert_label,
)

log = logging.getLogger(__name__)

# Default persistent database path
_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "custom_vasp_labels.sqlite"



@dataclass
class CustomWalletLabel:
    """Investigator-annotated label for a specific cryptocurrency wallet."""
    address: str
    entity_name: str
    entity_type: str  # "exchange", "mule", "scam", "mixer", "darknet", "gambling", "seized"
    chain: str = "ethereum"
    confidence: float = 1.0  # 0.0 to 1.0
    source: str = "LE_Investigation"  # "LE_Subpoena", "FIU_IND", "Court_Order", "Manual_Tag"
    case_reference: str | None = None
    notes: str | None = None
    tags: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class CustomVASPDatabase:
    """SQLite-backed persistent store for investigator custom wallet attributions."""

    def __init__(self, db_path: Path = _DB_PATH) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Create custom labels table if it does not already exist."""
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS custom_wallet_labels (
                    address TEXT PRIMARY KEY,
                    entity_name TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    chain TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    source TEXT NOT NULL,
                    case_reference TEXT,
                    notes TEXT,
                    tags TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_custom_entity_name ON custom_wallet_labels(entity_name);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_custom_chain ON custom_wallet_labels(chain);")
            conn.commit()

    def upsert_label(self, label: CustomWalletLabel) -> CustomWalletLabel:
        """Insert or update a custom wallet attribution label in local DB and Supabase."""
        clean_addr = label.address.strip()
        tags_json = json.dumps(label.tags)
        now_str = datetime.now(UTC).isoformat()

        # 1. Always persist to local SQLite
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO custom_wallet_labels (
                    address, entity_name, entity_type, chain, confidence,
                    source, case_reference, notes, tags, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(address) DO UPDATE SET
                    entity_name = excluded.entity_name,
                    entity_type = excluded.entity_type,
                    chain = excluded.chain,
                    confidence = excluded.confidence,
                    source = excluded.source,
                    case_reference = excluded.case_reference,
                    notes = excluded.notes,
                    tags = excluded.tags,
                    updated_at = excluded.updated_at
                """,
                (
                    clean_addr,
                    label.entity_name,
                    label.entity_type,
                    label.chain.lower(),
                    label.confidence,
                    label.source,
                    label.case_reference,
                    label.notes,
                    tags_json,
                    label.created_at,
                    now_str,
                ),
            )
            conn.commit()

        # 2. Sync to Supabase Cloud PostgreSQL if enabled
        if is_supabase_enabled():
            supabase_upsert_label(label.to_dict())

        return label

    def get_label(self, address: str) -> CustomWalletLabel | None:
        """Retrieve a custom attribution label from Supabase (or local fallback)."""
        clean_addr = address.strip()

        # Try Supabase first
        if is_supabase_enabled():
            sb_data = supabase_get_label(clean_addr)
            if sb_data:
                return self._dict_to_model(sb_data)

        # Fallback to local SQLite
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM custom_wallet_labels WHERE address = ? COLLATE NOCASE",
                (clean_addr,),
            ).fetchone()
            if row:
                return self._row_to_model(row)
        return None

    def search_labels(
        self,
        query: str = "",
        chain: str | None = None,
        entity_type: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[CustomWalletLabel]:
        """Search custom labels from Supabase (or local fallback)."""
        # Try Supabase first
        if is_supabase_enabled():
            sb_results = supabase_search_labels(
                query=query, chain=chain, entity_type=entity_type, skip=skip, limit=limit
            )
            if sb_results is not None:
                return [self._dict_to_model(r) for r in sb_results]

        # Fallback to local SQLite
        sql = "SELECT * FROM custom_wallet_labels WHERE 1=1"
        params: list[Any] = []

        if query:
            sql += " AND (address LIKE ? OR entity_name LIKE ? OR notes LIKE ? OR case_reference LIKE ?)"
            q_like = f"%{query}%"
            params.extend([q_like, q_like, q_like, q_like])

        if chain:
            sql += " AND chain = ?"
            params.append(chain.lower())

        if entity_type:
            sql += " AND entity_type = ?"
            params.append(entity_type.lower())

        sql += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, skip])

        with self._get_connection() as conn:
            rows = conn.execute(sql, params).fetchall()
            return [self._row_to_model(r) for r in rows]

    def count_labels(self) -> int:
        """Return total count of custom labeled addresses from Supabase (or local fallback)."""
        if is_supabase_enabled():
            cnt = supabase_count_labels()
            if cnt is not None:
                return cnt

        with self._get_connection() as conn:
            row = conn.execute("SELECT COUNT(*) as cnt FROM custom_wallet_labels").fetchone()
            return row["cnt"] if row else 0


    def bulk_import_csv(self, csv_content: str) -> int:
        """
        Bulk import custom labels from a CSV string.
        Expected CSV columns: address, entity_name, entity_type, chain, source, case_reference, notes
        """
        reader = csv.DictReader(io.StringIO(csv_content))
        count = 0
        for row in reader:
            addr = row.get("address", "").strip()
            name = row.get("entity_name", "").strip()
            if not addr or not name:
                continue

            label = CustomWalletLabel(
                address=addr,
                entity_name=name,
                entity_type=row.get("entity_type", "exchange").strip().lower(),
                chain=row.get("chain", "ethereum").strip().lower(),
                confidence=float(row.get("confidence", 1.0)),
                source=row.get("source", "CSV_Batch_Import").strip(),
                case_reference=row.get("case_reference"),
                notes=row.get("notes"),
                tags=[t.strip() for t in row.get("tags", "").split(",") if t.strip()],
            )
            self.upsert_label(label)
            count += 1
        return count

    def bulk_import_json(self, records: list[dict[str, Any]]) -> int:
        """Bulk import custom labels from a list of JSON records."""
        count = 0
        for item in records:
            addr = item.get("address", "").strip()
            name = item.get("entity_name", "").strip()
            if not addr or not name:
                continue

            label = CustomWalletLabel(
                address=addr,
                entity_name=name,
                entity_type=item.get("entity_type", "exchange").strip().lower(),
                chain=item.get("chain", "ethereum").strip().lower(),
                confidence=float(item.get("confidence", 1.0)),
                source=item.get("source", "JSON_Batch_Import").strip(),
                case_reference=item.get("case_reference"),
                notes=item.get("notes"),
                tags=item.get("tags", []),
            )
            self.upsert_label(label)
            count += 1
        return count

    @staticmethod
    def _row_to_model(row: sqlite3.Row) -> CustomWalletLabel:
        tags_raw = row["tags"]
        try:
            tags = json.loads(tags_raw) if tags_raw else []
        except Exception:
            tags = []

        return CustomWalletLabel(
            address=row["address"],
            entity_name=row["entity_name"],
            entity_type=row["entity_type"],
            chain=row["chain"],
            confidence=float(row["confidence"]),
            source=row["source"],
            case_reference=row["case_reference"],
            notes=row["notes"],
            tags=tags,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    @staticmethod
    def _dict_to_model(data: dict[str, Any]) -> CustomWalletLabel:
        tags = data.get("tags") or []
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except Exception:
                tags = [t.strip() for t in tags.split(",") if t.strip()]

        return CustomWalletLabel(
            address=data.get("address", ""),
            entity_name=data.get("entity_name", ""),
            entity_type=data.get("entity_type", "exchange"),
            chain=data.get("chain", "ethereum"),
            confidence=float(data.get("confidence", 1.0)),
            source=data.get("source", "Supabase_Cloud"),
            case_reference=data.get("case_reference"),
            notes=data.get("notes"),
            tags=tags,
            created_at=data.get("created_at") or datetime.now(UTC).isoformat(),
            updated_at=data.get("updated_at") or datetime.now(UTC).isoformat(),
        )



# Global singleton instance
_custom_db = CustomVASPDatabase()


def get_custom_vasp_db() -> CustomVASPDatabase:
    """Return singleton CustomVASPDatabase instance."""
    return _custom_db
