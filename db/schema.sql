CREATE TABLE IF NOT EXISTS vehicles (
  id text PRIMARY KEY,
  status text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inventory_meta (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  captured_at timestamptz NOT NULL,
  is_preview boolean NOT NULL DEFAULT false
);
