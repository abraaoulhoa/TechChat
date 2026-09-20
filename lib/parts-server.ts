import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { createPart, markPartScanned, updatePart, type Part, type PartForm } from "@/app/parts/parts-model";
import { PartsApiError, loginBucketKey, partsConfig } from "./parts-auth";

const PENDING = "NÃO BIPADO NO SITE";
const schema = [
  `CREATE TABLE IF NOT EXISTS techchat_parts (
    id uuid PRIMARY KEY, data jsonb NOT NULL,
    CONSTRAINT techchat_parts_object CHECK (jsonb_typeof(data) = 'object'),
    CONSTRAINT techchat_parts_fields CHECK (data ?& ARRAY['id','categoria','pcba','descricao','statusReparo','statusSite','origem','modelo','tecnico','observacao','createdAt','siteScannedAt','updatedAt']),
    CONSTRAINT techchat_parts_id CHECK (data->>'id' = id::text),
    CONSTRAINT techchat_parts_pcba CHECK (length(btrim(data->>'pcba')) BETWEEN 1 AND 240),
    CONSTRAINT techchat_parts_category CHECK (data->>'categoria' IN ('PEÇAS ON', 'PEÇAS OFF')),
    CONSTRAINT techchat_parts_site CHECK (
      (data->>'categoria' = 'PEÇAS OFF' AND data->>'statusSite' = '' AND data->'siteScannedAt' = 'null'::jsonb)
      OR (data->>'categoria' = 'PEÇAS ON' AND data->>'statusSite' = 'NÃO BIPADO NO SITE' AND data->'siteScannedAt' = 'null'::jsonb)
      OR (data->>'categoria' = 'PEÇAS ON' AND data->>'statusSite' = 'BIPADA' AND jsonb_typeof(data->'siteScannedAt') = 'string')
    )
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS techchat_parts_pending_pcba ON techchat_parts (upper(btrim(data->>'pcba'))) WHERE data->>'statusSite' = 'NÃO BIPADO NO SITE'`,
  `CREATE TABLE IF NOT EXISTS techchat_parts_login_attempts (bucket_key text PRIMARY KEY, window_started_at timestamptz NOT NULL, attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 11))`,
  `CREATE INDEX IF NOT EXISTS techchat_parts_login_window ON techchat_parts_login_attempts (window_started_at)`,
];

let connection: { url: string; sql: NeonQueryFunction<false, false>; ready: Promise<void> | null } | undefined;

async function database() {
  const { databaseUrl } = partsConfig();
  if (!connection || connection.url !== databaseUrl) {
    connection = { url: databaseUrl, sql: neon(databaseUrl), ready: null };
  }
  const current = connection;
  if (!current.ready) {
    current.ready = current.sql.transaction([
      current.sql`SELECT pg_advisory_xact_lock(824318710)`,
      ...schema.map(statement => current.sql.query(statement)),
    ]).then(() => undefined).catch(error => {
      current.ready = null;
      throw error;
    });
  }
  await current.ready;
  return current.sql;
}

export function validPartId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new PartsApiError("Identificador de peça inválido.", 400);
  }
  return id.toLowerCase();
}

export function partForm(body: Record<string, unknown>): PartForm {
  const lengths = { pcba: 240, descricao: 2000, statusReparo: 240, origem: 240, modelo: 240, tecnico: 240, observacao: 5000 } as const;
  if (body.categoria !== "PEÇAS ON" && body.categoria !== "PEÇAS OFF") {
    throw new PartsApiError("Selecione PEÇAS ON ou PEÇAS OFF.", 400);
  }
  for (const [key, limit] of Object.entries(lengths)) {
    if (typeof body[key] !== "string" || body[key].length > limit) {
      throw new PartsApiError(`Campo inválido ou muito longo: ${key}.`, 400);
    }
  }
  return {
    categoria: body.categoria,
    pcba: body.pcba as string,
    descricao: body.descricao as string,
    statusReparo: body.statusReparo as string,
    origem: body.origem as string,
    modelo: body.modelo as string,
    tecnico: body.tecnico as string,
    observacao: body.observacao as string,
  };
}

function modelResult(action: () => Part): Part {
  try {
    return action();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dados da peça inválidos.";
    throw new PartsApiError(message, message.includes("pendente de bipagem") ? 409 : 400);
  }
}

function nextTimestamp(previous: Part) {
  return new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1));
}

export async function listParts(): Promise<Part[]> {
  const sql = await database();
  const rows = await sql`SELECT data FROM techchat_parts ORDER BY data->>'createdAt' DESC, id`;
  return rows.map(row => row.data as Part);
}

async function readPart(sql: NeonQueryFunction<false, false>, id: string): Promise<Part> {
  const rows = await sql`SELECT data FROM techchat_parts WHERE id = ${id}::uuid`;
  if (!rows.length) throw new PartsApiError("Registro não encontrado.", 404);
  return rows[0].data as Part;
}

export async function insertPart(form: PartForm): Promise<Part> {
  const part = modelResult(() => createPart([], form));
  const sql = await database();
  const [, rows] = await sql.transaction([
    sql`LOCK TABLE techchat_parts IN SHARE ROW EXCLUSIVE MODE`,
    sql`INSERT INTO techchat_parts (id, data)
      SELECT ${part.id}::uuid, ${JSON.stringify(part)}::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM techchat_parts WHERE data->>'statusSite' = ${PENDING} AND upper(btrim(data->>'pcba')) = upper(${part.pcba}))
      RETURNING data`,
  ]);
  if (!rows.length) throw new PartsApiError("Essa PCBA já está pendente de bipagem no site.", 409);
  return rows[0].data as Part;
}

export async function editPart(id: string, form: PartForm): Promise<Part> {
  const sql = await database();
  const previous = await readPart(sql, id);
  const part = modelResult(() => updatePart([previous], id, form, nextTimestamp(previous)));
  const [, rows] = await sql.transaction([
    sql`LOCK TABLE techchat_parts IN SHARE ROW EXCLUSIVE MODE`,
    sql`UPDATE techchat_parts SET data = ${JSON.stringify(part)}::jsonb
      WHERE id = ${id}::uuid AND data->>'updatedAt' = ${previous.updatedAt}
      AND NOT EXISTS (SELECT 1 FROM techchat_parts other WHERE other.id <> ${id}::uuid AND other.data->>'statusSite' = ${PENDING} AND upper(btrim(other.data->>'pcba')) = upper(${part.pcba}))
      RETURNING data`,
  ]);
  if (!rows.length) {
    throw new PartsApiError("O registro mudou ou essa PCBA já está pendente de bipagem. Atualize a lista antes de tentar novamente.", 409);
  }
  return rows[0].data as Part;
}

export async function scanPart(id: string): Promise<Part> {
  const sql = await database();
  const previous = await readPart(sql, id);
  const part = modelResult(() => markPartScanned([previous], id, nextTimestamp(previous)));
  const [, , rows] = await sql.transaction([
    sql`LOCK TABLE techchat_parts IN SHARE ROW EXCLUSIVE MODE`,
    sql`UPDATE techchat_parts SET data = data || jsonb_build_object(
        'statusSite', 'BIPADA', 'siteScannedAt', ${part.siteScannedAt}::text, 'updatedAt', ${part.updatedAt}::text)
      WHERE id = ${id}::uuid AND data->>'categoria' = 'PEÇAS ON' AND data->>'statusSite' = ${PENDING}`,
    sql`SELECT data FROM techchat_parts WHERE id = ${id}::uuid`,
  ]);
  if (!rows.length) throw new PartsApiError("Registro não encontrado.", 404);
  const saved = rows[0].data as Part;
  if (saved.categoria !== "PEÇAS ON") throw new PartsApiError("Somente peças ON podem ser bipadas no site.", 400);
  return saved;
}

export async function removePart(id: string) {
  const sql = await database();
  const [, rows] = await sql.transaction([
    sql`LOCK TABLE techchat_parts IN SHARE ROW EXCLUSIVE MODE`,
    sql`DELETE FROM techchat_parts WHERE id = ${id}::uuid RETURNING id`,
  ]);
  if (!rows.length) throw new PartsApiError("Registro não encontrado.", 404);
}

export async function recordLoginAttempt(request: Request) {
  const sql = await database();
  const bucketKey = loginBucketKey(request);
  const [, rows] = await sql.transaction([
    sql`DELETE FROM techchat_parts_login_attempts WHERE window_started_at < now() - interval '1 day'`,
    sql`INSERT INTO techchat_parts_login_attempts (bucket_key, window_started_at, attempts)
      VALUES (${bucketKey}, now(), 1)
      ON CONFLICT (bucket_key) DO UPDATE SET
        window_started_at = CASE WHEN techchat_parts_login_attempts.window_started_at <= now() - interval '15 minutes' THEN now() ELSE techchat_parts_login_attempts.window_started_at END,
        attempts = CASE WHEN techchat_parts_login_attempts.window_started_at <= now() - interval '15 minutes' THEN 1 ELSE LEAST(techchat_parts_login_attempts.attempts + 1, 11) END
      RETURNING attempts, greatest(1, ceil(extract(epoch FROM (window_started_at + interval '15 minutes' - now())))) AS retry_after`,
  ]);
  if (Number(rows[0].attempts) > 10) {
    throw new PartsApiError("Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.", 429, Number(rows[0].retry_after));
  }
}
