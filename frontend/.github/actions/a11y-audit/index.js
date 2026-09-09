const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const FormData = require('form-data');

async function run() {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const snowflakeAccount = process.env.SNOWFLAKE_ACCOUNT;
    const snowflakeUser = process.env.SNOWFLAKE_USER;
    const snowflakePrivateKey = process.env.SNOWFLAKE_PRIVATE_KEY;
    const auditApiUrl = process.env.AUDIT_API_URL || 'https://api.yourapp.com';

    // Get changed files in PR
    const { stdout: changedFiles } = execSync('git diff --name-only HEAD~1', { encoding: 'utf-8' });
    const files = changedFiles.trim().split('\n').filter(f =>
      /\.(tsx|jsx|ts|js|css|scss|vue)$/.test(f)
    );

    if (files.length === 0) {
      console.log('No relevant files changed');
      return;
    }

    console.log('Changed files:', files);

    // Build Storybook to get component screenshots
    console.log('Building Storybook...');
    execSync('npm run build-storybook -- --output-dir storybook-static', { stdio: 'inherit' });

    // For each changed component, find its Storybook story and screenshot
    const componentScreenshots = await captureScreenshots(files);

    // Upload each screenshot for analysis
    const results = [];
    for (const { component, screenshotPath } of componentScreenshots) {
      console.log(`Analyzing ${component}...`);
      const result = await uploadForAnalysis(screenshotPath, component, auditApiUrl);
      results.push({ component, ...result });
    }

    // Generate PR comment
    const comment = generateComment(results);
    await postComment(comment);

    // Save report for artifacts
    fs.writeFileSync('a11y-report.json', JSON.stringify({ results, timestamp: new Date().toISOString() }, null, 2));
    console.log('Report saved to a11y-report.json');

  } catch (err) {
    console.error('Audit failed:', err);
    process.exit(1);
  }
}

async function captureScreenshots(changedFiles) {
  // This is a simplified version - in production you'd map files to Storybook stories
  // and use Playwright/Puppeteer to capture screenshots
  const screenshots = [];

  // Example: Find story files for changed components
  for (const file of changedFiles) {
    const componentName = path.basename(file, path.extname(file));
    const storyPath = `storybook-static/iframe.html?id=${componentName}--primary`;

    if (fs.existsSync(storyPath)) {
      screenshots.push({
        component: componentName,
        screenshotPath: storyPath, // Would be actual screenshot path
      });
    }
  }

  return screenshots;
}

async function uploadForAnalysis(screenshotPath, component, apiUrl) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(screenshotPath));
  formData.append('sourceType', 'github_pr');
  formData.append('sourceRef', component);
  formData.append('userId', 'github-action');

  const response = await fetch(`${apiUrl}/api/audit/upload`, {
    method: 'POST',
    body: formData,
  });

  const { auditId } = await response.json();

  // Poll for results
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`${apiUrl}/api/audit/results?auditId=${auditId}`);
    const data = await res.json();
    if (data.violations?.length || data.audit?.status === 'complete') {
      return { auditId, ...data };
    }
  }

  throw new Error(`Timeout waiting for ${component} analysis`);
}

function generateComment(results) {
  let comment = '## 🔍 Accessibility Audit Results\n\n';
  comment += '| Component | Violations | Status |\n';
  comment += '|-----------|------------|--------|\n';

  for (const { component, violations, summary } of results) {
    const count = violations?.length || 0;
    const status = count === 0 ? '✅ Pass' : '❌ Fail';
    comment += `| ${component} | ${summary?.total || count} | ${status} |\n`;
  }

  comment += '\n### Details\n\n';
  for (const { component, violations } of results) {
    if (!violations?.length) continue;
    comment += `<details><summary><strong>${component}</strong> (${violations.length} violations)</summary>\n\n`;
    comment += '| Rule | Severity | Element | Contrast | Fix |\n';
    comment += '|------|----------|---------|----------|-----|\n';
    for (const v of violations) {
      const contrast = v.actualRatio ? `${v.actualRatio.toFixed(2)}:1 (need ${v.requiredRatio}:1)` : 'N/A';
      const fix = v.suggestedFg ? `\`${v.currentHex}\` → \`${v.suggestedFg}\`` : 'N/A';
      comment += `| ${v.rule} | ${v.severity} | \`${v.element_selector}\` | ${contrast} | ${fix} |\n`;
    }
    comment += '</details>\n\n';
  }

  comment += '\n---\n*Powered by Cloudinary + Snowflake Cortex*';
  return comment;
}

async function postComment(body) {
  const token = process.env.GITHUB_TOKEN;
  const { GITHUB_REPOSITORY, GITHUB_EVENT_PATH } = process.env;

  if (!token || !GITHUB_REPOSITORY || !GITHUB_EVENT_PATH) {
    console.log('Missing GitHub context, skipping comment');
    return;
  }

  const event = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, 'utf-8'));
  const prNumber = event.pull_request?.number || event.number;

  if (!prNumber) {
    console.log('Not a PR, skipping comment');
    return;
  }

  const octokit = new Octokit({ auth: token });
  const [owner, repo] = GITHUB_REPOSITORY.split('/');

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });

  console.log('Posted PR comment');
}

run();