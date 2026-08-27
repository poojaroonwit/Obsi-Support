CREATE TABLE IF NOT EXISTS support_organizations (
  organization_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  support_email_address VARCHAR(320),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE support_organizations ADD COLUMN IF NOT EXISTS support_email_address VARCHAR(320);
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_organizations_email ON support_organizations (lower(support_email_address)) WHERE support_email_address IS NOT NULL;

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY,
  ticket_number BIGSERIAL UNIQUE NOT NULL,
  organization_id TEXT NOT NULL REFERENCES support_organizations(organization_id) ON DELETE CASCADE,
  organization_slug TEXT NOT NULL,
  subject VARCHAR(240) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(24) NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','pending','resolved','closed')),
  priority VARCHAR(24) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  channel VARCHAR(24) NOT NULL DEFAULT 'portal' CHECK (channel IN ('portal','email','chat','api','manual')),
  requester_name VARCHAR(160) NOT NULL,
  requester_email VARCHAR(320) NOT NULL,
  assignee_id TEXT,
  assignee_name VARCHAR(160),
  assignee_email VARCHAR(320),
  first_response_due_at TIMESTAMPTZ,
  resolution_due_at TIMESTAMPTZ,
  first_responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org_status_updated ON support_tickets (organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_requester ON support_tickets (organization_id, requester_email);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_type VARCHAR(24) NOT NULL CHECK (author_type IN ('customer','agent','system')),
  author_id TEXT,
  author_name VARCHAR(160),
  author_email VARCHAR(320),
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  channel VARCHAR(24) NOT NULL DEFAULT 'portal',
  provider_email_id TEXT,
  external_message_id TEXT,
  delivery_status VARCHAR(24),
  delivery_error TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS channel VARCHAR(24) NOT NULL DEFAULT 'portal';
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS provider_email_id TEXT;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS external_message_id TEXT;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(24);
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS delivery_error TEXT;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created ON support_messages (ticket_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_messages_provider_email ON support_messages (provider_email_id) WHERE provider_email_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_messages_external_message ON support_messages (external_message_id) WHERE external_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS support_portal_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  requester_email VARCHAR(320) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_portal_tokens_ticket ON support_portal_tokens (ticket_id);
