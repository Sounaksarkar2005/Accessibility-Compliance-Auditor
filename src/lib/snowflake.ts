import snowflake from 'snowflake-sdk';
import type { Connection } from 'snowflake-sdk';
import type { Audit, Violation, Component } from '@/types';

let connection: Connection | null = null;
let connectionPromise: Promise<Connection> | null = null;

function createConnection(): Connection {
  const account = process.env.SNOWFLAKE_ACCOUNT;
  const username = process.env.SNOWFLAKE_USER;
  const password = process.env.SNOWFLAKE_PASSWORD;

  if (!account || !username || !password) {
    throw new Error('Snowflake configuration is missing required environment variables.');
  }

  return snowflake.createConnection({
    account,
    username,
    password,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
    database: process.env.SNOWFLAKE_DATABASE || 'A11Y_AUDITOR',
    schema: process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
  });
}

export async function connect(): Promise<void> {
  if (connection?.isUp()) return;

  if (!connectionPromise) {
    connection = createConnection();
    connectionPromise = connection.connectAsync()
      .then((connected) => {
        connection = connected;
        connectionPromise = null;
        return connected;
      })
      .catch((error) => {
        connection = null;
        connectionPromise = null;
        throw error;
      });
  }

  await connectionPromise;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function execute<T = unknown>(sql: string, binds?: any[]): Promise<T[]> {
  await connect();
  const activeConnection = connection;

  if (!activeConnection) {
    throw new Error('Snowflake connection was not established.');
  }

  return new Promise((resolve, reject) => {
    activeConnection.execute({
      sqlText: sql,
      binds,
      complete: (err, _stmt, rows) => (err ? reject(err) : resolve(rows as T[])),
    });
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeStream(sql: string, binds?: any[]): Promise<AsyncIterable<unknown>> {
  await connect();
  const activeConnection = connection;

  if (!activeConnection) {
    throw new Error('Snowflake connection was not established.');
  }

  const stmt = activeConnection.execute({
    sqlText: sql,
    binds,
    streamResult: true,
  });
  return stmt.streamRows();
}

export async function createAudit(audit: Omit<Audit, 'created_at'>): Promise<void> {
  await execute(
    `INSERT INTO audits (audit_id, user_id, source_type, source_ref, status, wcag_version, cloudinary_public_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [audit.audit_id, audit.user_id, audit.source_type, audit.source_ref, audit.status, audit.wcag_version, audit.cloudinary_public_id ?? null],
  );
}

export async function updateAuditStatus(auditId: string, status: Audit['status']): Promise<void> {
  await execute(`UPDATE audits SET status = ? WHERE audit_id = ?`, [status, auditId]);
}

export async function insertViolations(violations: Omit<Violation, 'created_at'>[]): Promise<void> {
  if (violations.length === 0) return;
  const values = violations.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const binds = violations.flatMap((v) => [
    v.violation_id,
    v.audit_id,
    v.rule_id,
    v.severity,
    v.element_selector,
    JSON.stringify(v.coordinates),
    v.contrast_ratio ?? null,
    v.expected_contrast ?? null,
    v.current_hex ?? null,
    v.suggested_hex ?? null,
    v.cloudinary_asset_id ?? null,
    v.fixed_asset_id ?? null,
    v.cortex_explanation ?? null,
  ]);
  await execute(
    `INSERT INTO violations (violation_id, audit_id, rule_id, severity, element_selector, coordinates, contrast_ratio, expected_contrast, current_hex, suggested_hex, cloudinary_asset_id, fixed_asset_id, cortex_explanation)
     VALUES ${values}`,
    binds,
  );
}

export async function getAuditWithViolations(auditId: string): Promise<{ audit: Audit; violations: Violation[] } | null> {
  const audits = await execute<Audit>(`SELECT * FROM audits WHERE audit_id = ?`, [auditId]);
  if (audits.length === 0) return null;
  const violations = await execute<Violation>(`SELECT * FROM violations WHERE audit_id = ?`, [auditId]);
  return { audit: audits[0], violations };
}

export async function getComponentHealth(): Promise<Array<Component & { open_violations: number }>> {
  return execute(`
    SELECT c.*, COUNT(v.violation_id) as open_violations
    FROM components c
    LEFT JOIN audits a ON c.latest_audit_id = a.audit_id
    LEFT JOIN violations v ON a.audit_id = v.audit_id
    GROUP BY c.component_id, c.name, c.framework, c.repo_url, c.latest_audit_id, c.violation_count, c.last_scanned
  `);
}

export async function generateFixExplanation(violationId: string): Promise<string> {
  const result = await execute<{ explanation: string }>(
    `SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-70b', ?) as explanation`,
    [
      `You are an accessibility expert. Explain this violation to a frontend developer with exact code fix.
       Violation ID: ${violationId}
       Provide: 1) One-sentence summary 2) Exact CSS/JSX fix 3) Why this matters for users.`,
    ],
  );
  const explanation = result[0]?.explanation || '';
  await execute(`UPDATE violations SET cortex_explanation = ? WHERE violation_id = ?`, [explanation, violationId]);
  return explanation;
}

export async function searchViolations(query: string, limit = 10): Promise<unknown[]> {
  return execute(
    `SELECT * FROM TABLE(SNOWFLAKE.CORTEX.SEARCH_PREVIEW('violation_search_service', ?, ?))`,
    [query, limit],
  );
}
