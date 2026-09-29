CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS businesses(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS factories(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  map_config jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS commands(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid REFERENCES commands(id),
  business_id uuid REFERENCES businesses(id),
  factory_id uuid REFERENCES factories(id),
  type text NOT NULL,
  requested_by text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  priority text NOT NULL DEFAULT 'normal',
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  factory_id uuid REFERENCES factories(id),
  slug text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'idle',
  current_job_id uuid REFERENCES jobs(id) DEFERRABLE INITIALLY DEFERRED,
  workstation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(factory_id,slug)
);

CREATE TABLE IF NOT EXISTS job_steps(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id),
  sequence integer NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  input_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count integer NOT NULL DEFAULT 0,
  worker_id text,
  started_at timestamptz,
  completed_at timestamptz,
  error_json jsonb,
  UNIQUE(job_id,sequence)
);

CREATE TABLE IF NOT EXISTS events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id),
  factory_id uuid REFERENCES factories(id),
  agent_id uuid REFERENCES agents(id),
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id),
  step_id uuid REFERENCES job_steps(id),
  action_type text NOT NULL,
  risk_level integer NOT NULL CHECK(risk_level BETWEEN 0 AND 2),
  preview_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

CREATE TABLE IF NOT EXISTS companies(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  industry text,
  city text,
  state text,
  external_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id),
  name text,
  email text,
  phone text,
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  company_id uuid REFERENCES companies(id),
  contact_id uuid REFERENCES contacts(id),
  status text NOT NULL DEFAULT 'raw',
  score numeric,
  source text,
  crm_external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS leads_crm_external_unique ON leads(crm_external_id) WHERE crm_external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS companies_name_idx ON companies(lower(name));

CREATE TABLE IF NOT EXISTS quotes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id),
  assumptions jsonb NOT NULL,
  calculation jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_number text,
  year integer,
  make text,
  model text,
  trim text,
  vin text,
  mileage integer,
  asking_price numeric,
  offer_down_payment numeric,
  status text NOT NULL DEFAULT 'available',
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  campaign_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  vehicle_id uuid REFERENCES vehicles(id),
  type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_assets(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  source_asset_id uuid REFERENCES media_assets(id),
  asset_type text NOT NULL,
  lineage text NOT NULL,
  storage_url text NOT NULL,
  mime_type text,
  width integer,
  height integer,
  checksum text,
  rights_status text NOT NULL DEFAULT 'owner_supplied',
  ai_modified boolean NOT NULL DEFAULT false,
  ai_generated boolean NOT NULL DEFAULT false,
  filename text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  blob_data bytea,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_source_idx ON media_assets(source_asset_id);

CREATE TABLE IF NOT EXISTS products(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_asset_id uuid REFERENCES media_assets(id),
  name text NOT NULL,
  product_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  qa_state text NOT NULL DEFAULT 'pending',
  approval_state text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS etsy_listings(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  external_listing_id text,
  status text NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_disclosure boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_id text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,external_id)
);

CREATE TABLE IF NOT EXISTS audit_logs(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id text,
  action text NOT NULL,
  target_type text,
  target_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_state(
  provider text PRIMARY KEY,
  status text NOT NULL DEFAULT 'disconnected',
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_job_created_idx ON events(job_id,created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_status_created_idx ON jobs(status,created_at DESC);
CREATE INDEX IF NOT EXISTS approvals_status_requested_idx ON approvals(status,requested_at DESC);
CREATE INDEX IF NOT EXISTS job_steps_claim_idx ON job_steps(status,job_id,sequence);

CREATE TABLE IF NOT EXISTS external_actions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE NOT NULL,
  provider text NOT NULL,
  job_id uuid REFERENCES jobs(id),
  step_id uuid REFERENCES job_steps(id),
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'started',
  response_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Upgrade safety for earlier Phase-2 scaffold databases.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE job_steps ADD COLUMN IF NOT EXISTS worker_id text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS external_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS filename text;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS blob_data bytea;
CREATE UNIQUE INDEX IF NOT EXISTS agents_factory_slug_unique ON agents(factory_id,slug) WHERE slug IS NOT NULL;
