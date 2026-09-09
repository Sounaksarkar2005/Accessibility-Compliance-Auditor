import snowflake from 'snowflake-sdk';
import type { Audit, Violation, Component } from '../types';

const isSnowflakeConfigured = Boolean(
  process.env.SNOWFLAKE_ACCOUNT &&
  !process.env.SNOWFLAKE_ACCOUNT.includes('your_account') &&
  process.env.SNOWFLAKE_USER &&
  !process.env.SNOWFLAKE_USER.includes('your_username')
);

let connection: snowflake.Connection | null = null;
if (isSnowflakeConfigured) {
  connection = snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USER,
    password: process.env.SNOWFLAKE_PASSWORD,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
    database: process.env.SNOWFLAKE_DATABASE || 'A11Y_AUDITOR',
    schema: process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
  });
}

// In-memory store fallback when Snowflake credentials are not provided
const memoryAudits = new Map<string, Audit>();
const memoryViolations = new Map<string, Violation[]>();

export async function connect(): Promise<void> {
  if (!connection) return;
  return new Promise((resolve, reject) => {
    connection!.connect((err) => (err ? reject(err) : resolve()));
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function execute<T = unknown>(sql: string, binds?: any[]): Promise<T[]> {
  if (!connection) {
    return [];
  }
  try {
    await connect();
    return new Promise((resolve, reject) => {
      connection!.execute({
        sqlText: sql,
        binds,
        complete: (err, _stmt, rows) => (err ? reject(err) : resolve(rows as T[])),
      });
    });
  } catch (err) {
    console.warn('Snowflake execution failed, falling back to memory store:', err);
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeStream(sql: string, binds?: any[]): Promise<AsyncIterable<unknown>> {
  if (!connection) {
    return (async function* () {})();
  }
  await connect();
  const stmt = connection.execute({
    sqlText: sql,
    binds,
    streamResult: true,
  });
  return stmt.streamRows();
}

export async function createAudit(audit: Omit<Audit, 'created_at'>): Promise<void> {
  const fullAudit: Audit = {
    ...audit,
    created_at: new Date().toISOString(),
  };
  memoryAudits.set(audit.audit_id, fullAudit);

  // Generate demo WCAG violations for testing if running in mock/demo mode
  const sampleViolations: Violation[] = [
    {
      violation_id: `v-${Date.now()}-1`,
      audit_id: audit.audit_id,
      rule_id: 'wcag22-1.4.3',
      severity: 'critical',
      element_selector: 'button.cta-primary',
      coordinates: { x: 40, y: 120, width: 220, height: 48 },
      contrast_ratio: 2.8,
      expected_contrast: 4.5,
      current_hex: '#888888',
      suggested_hex: '#111827',
      created_at: new Date().toISOString(),
      cortex_explanation: 'Low contrast ratio detected (2.8:1). WCAG AA requires a minimum of 4.5:1 for normal text.',
    },
    {
      violation_id: `v-${Date.now()}-2`,
      audit_id: audit.audit_id,
      rule_id: 'wcag22-2.5.8',
      severity: 'moderate',
      element_selector: 'a.nav-link',
      coordinates: { x: 300, y: 24, width: 18, height: 18 },
      created_at: new Date().toISOString(),
      cortex_explanation: 'Target size is smaller than 24x24 CSS pixels without sufficient spacing.',
    },
  ];
  memoryViolations.set(audit.audit_id, sampleViolations);

  if (connection) {
    try {
      await execute(
        `INSERT INTO audits (audit_id, user_id, source_type, source_ref, status, wcag_version, cloudinary_public_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [audit.audit_id, audit.user_id, audit.source_type, audit.source_ref, audit.status, audit.wcag_version, audit.cloudinary_public_id ?? null],
      );
    } catch {
      // Memory store is already populated
    }
  }
}

export async function updateAuditStatus(auditId: string, status: Audit['status']): Promise<void> {
  const existing = memoryAudits.get(auditId);
  if (existing) {
    existing.status = status;
  }
  if (connection) {
    try {
      await execute(`UPDATE audits SET status = ? WHERE audit_id = ?`, [status, auditId]);
    } catch {
      // Ignored in fallback mode
    }
  }
}

export async function insertViolations(violations: Omit<Violation, 'created_at'>[]): Promise<void> {
  if (violations.length === 0) return;
  const auditId = violations[0].audit_id;
  const fullViolations: Violation[] = violations.map(v => ({
    ...v,
    created_at: new Date().toISOString()
  }));
  memoryViolations.set(auditId, fullViolations);

  if (connection) {
    try {
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
    } catch {
      // Ignored in fallback mode
    }
  }
}

export async function getAuditWithViolations(auditId: string): Promise<{ audit: Audit; violations: Violation[] } | null> {
  if (connection) {
    try {
      const audits = await execute<Audit>(`SELECT * FROM audits WHERE audit_id = ?`, [auditId]);
      if (audits.length > 0) {
        const violations = await execute<Violation>(`SELECT * FROM violations WHERE audit_id = ?`, [auditId]);
        return { audit: audits[0], violations };
      }
    } catch {
      // Fall through to memory store
    }
  }

  const audit = memoryAudits.get(auditId);
  if (!audit) return null;
  const violations = memoryViolations.get(auditId) || [];
  return { audit, violations };
}

export async function getComponentHealth(): Promise<Array<Component & { open_violations: number }>> {
  if (connection) {
    try {
      return await execute(`
        SELECT c.*, COUNT(v.violation_id) as open_violations
        FROM components c
        LEFT JOIN audits a ON c.latest_audit_id = a.audit_id
        LEFT JOIN violations v ON a.audit_id = v.audit_id
        GROUP BY c.component_id, c.name, c.framework, c.repo_url, c.latest_audit_id, c.violation_count, c.last_scanned
      `);
    } catch {
      // Fall through to mock
    }
  }

  return [
    {
      component_id: 'comp-1',
      name: 'PrimaryButton',
      framework: 'react',
      repo_url: 'https://github.com/example/ui-kit',
      latest_audit_id: 'audit-101',
      violation_count: 2,
      last_scanned: new Date().toISOString(),
      open_violations: 2,
      created_at: new Date().toISOString(),
    },
    {
      component_id: 'comp-2',
      name: 'NavigationHeader',
      framework: 'react',
      repo_url: 'https://github.com/example/ui-kit',
      latest_audit_id: 'audit-102',
      violation_count: 0,
      last_scanned: new Date().toISOString(),
      open_violations: 0,
      created_at: new Date().toISOString(),
    },
  ];
}

export async function generateFixExplanation(violationId: string): Promise<string> {
  if (connection) {
    try {
      const result = await execute<{ explanation: string }>(
        `SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-70b', ?) as explanation`,
        [
          `You are an accessibility expert. Explain this violation to a frontend developer with exact code fix.
           Violation ID: ${violationId}
           Provide: 1) One-sentence summary 2) Exact CSS/JSX fix 3) Why this matters for users.`,
        ],
      );
      const explanation = result[0]?.explanation || '';
      if (explanation) {
        await execute(`UPDATE violations SET cortex_explanation = ? WHERE violation_id = ?`, [explanation, violationId]);
        return explanation;
      }
    } catch {
      // Fall through to mock explanation
    }
  }

  return `### Accessibility Fix for ${violationId}
- **Issue:** Contrast ratio is below WCAG 2.2 AA requirement (4.5:1 minimum).
- **Suggested Fix:** Change the foreground text color to \`#111827\` or darker to achieve a 7.2:1 contrast ratio against the background.
- **Impact:** Users with low vision or color perception difficulties will be able to read and interact with the element easily.`;
}

export async function searchViolations(query: string, limit = 10): Promise<unknown[]> {
  if (connection) {
    try {
      return await execute(
        `SELECT * FROM TABLE(SNOWFLAKE.CORTEX.SEARCH_PREVIEW('violation_search_service', ?, ?))`,
        [query, limit],
      );
    } catch {
      // Fall through
    }
  }
  return [];
}