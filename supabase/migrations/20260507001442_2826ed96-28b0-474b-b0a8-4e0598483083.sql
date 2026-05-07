ALTER TABLE leads_revendedoras
ADD COLUMN status_updated_at timestamptz NOT NULL DEFAULT now();

UPDATE leads_revendedoras SET status_updated_at = created_at;