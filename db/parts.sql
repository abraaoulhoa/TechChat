-- Shared parts storage. The API applies this schema idempotently on first use.
-- DATABASE_URL and PARTS_ACCESS_CODE must be set in the server environment.
CREATE TABLE IF NOT EXISTS techchat_parts (
  id uuid PRIMARY KEY,
  data jsonb NOT NULL,
  CONSTRAINT techchat_parts_object CHECK (jsonb_typeof(data) = 'object'),
  CONSTRAINT techchat_parts_fields CHECK (data ?& ARRAY[
    'id', 'categoria', 'pcba', 'descricao', 'statusReparo', 'statusSite',
    'origem', 'modelo', 'tecnico', 'observacao', 'createdAt', 'siteScannedAt', 'updatedAt'
  ]),
  CONSTRAINT techchat_parts_id CHECK (data->>'id' = id::text),
  CONSTRAINT techchat_parts_pcba CHECK (length(btrim(data->>'pcba')) BETWEEN 1 AND 240),
  CONSTRAINT techchat_parts_category CHECK (data->>'categoria' IN ('PEÇAS ON', 'PEÇAS OFF')),
  CONSTRAINT techchat_parts_site CHECK (
    (data->>'categoria' = 'PEÇAS OFF' AND data->>'statusSite' = '' AND data->'siteScannedAt' = 'null'::jsonb)
    OR (data->>'categoria' = 'PEÇAS ON' AND data->>'statusSite' = 'NÃO BIPADO NO SITE' AND data->'siteScannedAt' = 'null'::jsonb)
    OR (data->>'categoria' = 'PEÇAS ON' AND data->>'statusSite' = 'BIPADA' AND jsonb_typeof(data->'siteScannedAt') = 'string')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS techchat_parts_pending_pcba
  ON techchat_parts (upper(btrim(data->>'pcba')))
  WHERE data->>'statusSite' = 'NÃO BIPADO NO SITE';

CREATE TABLE IF NOT EXISTS techchat_parts_login_attempts (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 11)
);

CREATE INDEX IF NOT EXISTS techchat_parts_login_window
  ON techchat_parts_login_attempts (window_started_at);
