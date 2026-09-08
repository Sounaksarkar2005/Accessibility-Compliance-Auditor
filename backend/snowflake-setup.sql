-- Snowflake Setup for Accessibility Auditor
-- Run this in Snowflake worksheet after creating account

-- Create database and schema
CREATE DATABASE IF NOT EXISTS A11Y_AUDITOR;
CREATE SCHEMA IF NOT EXISTS PUBLIC;
USE DATABASE A11Y_AUDITOR;
USE SCHEMA PUBLIC;

-- Core tables
CREATE TABLE IF NOT EXISTS audits (
  audit_id STRING PRIMARY KEY,
  user_id STRING,
  source_type STRING,
  source_ref STRING,
  status STRING,
  wcag_version STRING DEFAULT '2.2',
  cloudinary_public_id STRING,
  created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS violations (
  violation_id STRING PRIMARY KEY,
  audit_id STRING REFERENCES audits(audit_id),
  rule_id STRING,
  severity STRING,
  element_selector STRING,
  coordinates OBJECT,
  contrast_ratio FLOAT,
  expected_contrast FLOAT,
  current_hex STRING,
  suggested_hex STRING,
  cloudinary_asset_id STRING,
  fixed_asset_id STRING,
  cortex_explanation STRING,
  created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS components (
  component_id STRING PRIMARY KEY,
  name STRING,
  framework STRING,
  repo_url STRING,
  latest_audit_id STRING REFERENCES audits(audit_id),
  violation_count INT DEFAULT 0,
  last_scanned TIMESTAMP_NTZ
);

-- Embeddings table for semantic search
CREATE TABLE IF NOT EXISTS violation_embeddings (
  violation_id STRING PRIMARY KEY REFERENCES violations(violation_id),
  embedding VECTOR(FLOAT, 1536),
  description STRING
);

-- Stream for real-time violation ingestion
CREATE OR REPLACE STREAM violation_stream ON TABLE violations;

-- Task: Check for regressions every hour
CREATE OR REPLACE TASK regression_check_task
  WAREHOUSE = COMPUTE_WH
  SCHEDULE = 'USING CRON 0 * * * * UTC'
AS
INSERT INTO regression_alerts (component_id, rule_id, new_count, detected_at)
SELECT
  c.component_id,
  v.rule_id,
  COUNT(*) as new_count,
  CURRENT_TIMESTAMP()
FROM violation_stream v
JOIN audits a ON v.audit_id = a.audit_id
JOIN components c ON c.latest_audit_id = a.audit_id
WHERE v.METADATA$ACTION = 'INSERT'
  AND v.violation_id NOT IN (
    SELECT violation_id FROM violations
    WHERE audit_id IN (
      SELECT audit_id FROM audits
      WHERE created_at < DATEADD(hour, -1, CURRENT_TIMESTAMP())
    )
  )
GROUP BY c.component_id, v.rule_id
HAVING COUNT(*) > 0;

-- Regression alerts table
CREATE TABLE IF NOT EXISTS regression_alerts (
  alert_id STRING PRIMARY KEY DEFAULT UUID_STRING(),
  component_id STRING,
  rule_id STRING,
  new_count INT,
  detected_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Cortex Search Service for semantic violation search
CREATE OR REPLACE CORTEX SEARCH SERVICE violation_search_service
ON violation_embeddings
ATTRIBUTES rule_id, severity, component_name
WAREHOUSE = COMPUTE_WH
TARGET_LAG = '1 hour'
AS (
  SELECT
    ve.violation_id,
    ve.embedding,
    ve.description,
    v.rule_id,
    v.severity,
    c.name as component_name
  FROM violation_embeddings ve
  JOIN violations v ON ve.violation_id = v.violation_id
  JOIN audits a ON v.audit_id = a.audit_id
  JOIN components c ON c.latest_audit_id = a.audit_id
);

-- Stored procedure: Generate fix explanation using Cortex LLM
CREATE OR REPLACE PROCEDURE generate_fix_explanation(violation_id STRING)
RETURNS STRING
LANGUAGE PYTHON
RUNTIME_VERSION = '3.10'
PACKAGES = ('snowflake-snowpark-python')
HANDLER = 'generate_explanation'
AS $$
def generate_explanation(session, violation_id):
    # Fetch violation details
    row = session.sql(f"""
        SELECT v.*, c.name as component_name, c.framework
        FROM violations v
        JOIN audits a ON v.audit_id = a.audit_id
        JOIN components c ON c.latest_audit_id = a.audit_id
        WHERE v.violation_id = '{violation_id}'
    """).collect()[0]

    rule_descriptions = {
        '1.4.3': 'Contrast (Minimum) - Text must have 4.5:1 contrast ratio',
        '1.4.6': 'Contrast (Enhanced) - Text must have 7:1 contrast ratio',
        '2.4.7': 'Focus Visible - Interactive elements must show focus',
        '2.5.8': 'Target Size - Touch targets must be at least 24x24 CSS pixels',
        '1.4.10': 'Reflow - Content must not require horizontal scroll at 320px',
        '1.4.4': 'Resize Text - Text must be readable at 200% zoom'
    }

    prompt = f"""
    You are an accessibility expert. Explain this violation to a frontend developer:

    Component: {row['COMPONENT_NAME']} ({row['FRAMEWORK']})
    Rule: {row['RULE_ID']} - {rule_descriptions.get(row['RULE_ID'], 'WCAG violation')}
    Severity: {row['SEVERITY']}
    Element: {row['ELEMENT_SELECTOR']}
    Current contrast: {row['CONTRAST_RATIO']:.2f}:1 (required: {row['EXPECTED_CONTRAST']:.2f}:1)
    Current color: {row['CURRENT_HEX']}
    Suggested color: {row['SUGGESTED_HEX']}

    Provide:
    1. One-sentence summary
    2. Exact code fix (CSS/JSX)
    3. Why this matters for users
    """

    # Call Cortex LLM
    result = session.sql(f"""
        SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-70b', ?)
    """, [prompt]).collect()[0][0]

    # Update violation with explanation
    session.sql(f"""
        UPDATE violations SET cortex_explanation = ? WHERE violation_id = ?
    """, [result, violation_id]).collect()

    return result
$$;

-- Enable task
ALTER TASK regression_check_task RESUME;

-- Grant permissions (adjust roles as needed)
-- GRANT USAGE ON DATABASE A11Y_AUDITOR TO ROLE PUBLIC;
-- GRANT USAGE ON SCHEMA PUBLIC TO ROLE PUBLIC;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA PUBLIC TO ROLE PUBLIC;
-- GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE PUBLIC;