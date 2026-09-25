-- ==============================================================================
-- ChainSleuth – Supabase Cloud PostgreSQL Schema
-- ==============================================================================
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ==============================================================================

-- 1. Custom Law Enforcement Wallet Labels & VASP Attribution Table
CREATE TABLE IF NOT EXISTS public.custom_wallet_labels (
    address TEXT PRIMARY KEY,
    entity_name TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'exchange', -- 'exchange', 'mule', 'scam', 'mixer', 'darknet', 'seized'
    chain TEXT NOT NULL DEFAULT 'ethereum',        -- 'ethereum', 'tron', 'solana', 'bitcoin'
    confidence REAL NOT NULL DEFAULT 1.0,
    source TEXT NOT NULL DEFAULT 'LE_Investigation',
    case_reference TEXT,
    notes TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_labels_entity_name ON public.custom_wallet_labels(entity_name);
CREATE INDEX IF NOT EXISTS idx_labels_chain ON public.custom_wallet_labels(chain);
CREATE INDEX IF NOT EXISTS idx_labels_entity_type ON public.custom_wallet_labels(entity_type);

-- 2. Investigation Cases & Forensic Metadata Table
CREATE TABLE IF NOT EXISTS public.cases (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',          -- 'active', 'closed', 'flagged'
    chain TEXT NOT NULL,
    root_address TEXT NOT NULL,
    fir_number TEXT,
    police_station TEXT,
    state TEXT,
    officer_name TEXT,
    officer_designation TEXT,
    total_stolen_inr NUMERIC DEFAULT 0,
    node_count INTEGER DEFAULT 0,
    edge_count INTEGER DEFAULT 0,
    attribution JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_cases_root_address ON public.cases(root_address);
CREATE INDEX IF NOT EXISTS idx_cases_fir_number ON public.cases(fir_number);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);

-- 3. Cryptographic Evidence Certificates (Section 65B BNSS / IEA)
CREATE TABLE IF NOT EXISTS public.evidence_certificates (
    certificate_id TEXT PRIMARY KEY,
    case_id TEXT REFERENCES public.cases(id) ON DELETE SET NULL,
    root_address TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    signature TEXT NOT NULL,
    certified_by TEXT NOT NULL,
    system_dossier JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_cert_case_id ON public.evidence_certificates(case_id);
CREATE INDEX IF NOT EXISTS idx_cert_hash ON public.evidence_certificates(sha256_hash);

-- 4. Enable Row Level Security (RLS) & Public API Access for Backend Service
ALTER TABLE public.custom_wallet_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_certificates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated backend access (or public read/write if using anon key in dev)
DROP POLICY IF EXISTS "Allow service and anon access to custom_wallet_labels" ON public.custom_wallet_labels;
CREATE POLICY "Allow service and anon access to custom_wallet_labels" ON public.custom_wallet_labels
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service and anon access to cases" ON public.cases;
CREATE POLICY "Allow service and anon access to cases" ON public.cases
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service and anon access to evidence_certificates" ON public.evidence_certificates;
CREATE POLICY "Allow service and anon access to evidence_certificates" ON public.evidence_certificates
    FOR ALL USING (true) WITH CHECK (true);

