// Figma Plugin: Main Code (code.ts)
declare const figma: any;
declare const __html__: string;

figma.showUI(__html__, { width: 420, height: 650, title: 'Accessibility Compliance Auditor' });

let currentAuditId: string | null = null;

figma.ui.onmessage = async (msg: { type: string; fixes?: any[] }) => {
  if (msg.type === 'analyze-selection') {
    await analyzeSelection();
  } else if (msg.type === 'export-fixes') {
    await exportFixes(msg.fixes || []);
  }
};

figma.on('selectionchange', () => {
  figma.ui.postMessage({ type: 'selection-changed', selection: figma.currentPage.selection });
});

async function analyzeSelection(): Promise<void> {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.notify('Select a frame or component first');
    return;
  }

  const node = selection[0];
  if (node.type !== 'FRAME' && node.type !== 'COMPONENT' && node.type !== 'INSTANCE') {
    figma.notify('Please select a Frame, Component, or Instance');
    return;
  }

  figma.ui.postMessage({ type: 'analysis-started' });

  try {
    // Export as PNG at 2x for better analysis
    const bytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 },
    });

    const formData = new FormData();
    formData.append('file', new Blob([bytes], { type: 'image/png' }), `${node.name}.png`);
    formData.append('sourceType', 'figma');
    formData.append('sourceRef', node.id);
    formData.append('userId', 'figma-plugin-user');

    const response = await fetch('https://api.yourapp.com/api/audit/upload', {
      method: 'POST',
      body: formData,
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
    });

    const { auditId } = await response.json();
    currentAuditId = auditId;

    // Poll for results
    const result = await pollForResults(auditId);
    figma.ui.postMessage({ type: 'analysis-complete', result });

    // Show violations as sticky notes
    await showViolationsInFigma(node, result.violations);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(err);
    figma.notify('Analysis failed: ' + errorMsg);
    figma.ui.postMessage({ type: 'analysis-error', error: errorMsg });
  }
}

async function pollForResults(auditId: string): Promise<any> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`https://api.yourapp.com/api/audit/results?auditId=${auditId}`);
    const data = await res.json();
    if (data.violations?.length || data.audit?.status === 'complete') {
      return data;
    }
  }
  throw new Error('Analysis timed out');
}

async function showViolationsInFigma(parentNode: any, violations: any[]): Promise<void> {
  for (const v of violations) {
    const note = figma.createStickyNote();
    note.x = v.bounds.x + v.bounds.width + 20;
    note.y = v.bounds.y;
    note.resize(300, 200);
    note.text = `⚠️ WCAG ${v.rule} (${v.severity})\n${v.type}\n\n${v.cortexExplanation || 'Click "Explain" in dashboard for fix details'}`;
    note.fillStyle = {
      type: 'SOLID',
      color: v.severity === 'A' ? { r: 1, g: 0.9, b: 0.9 } : v.severity === 'AA' ? { r: 1, g: 0.95, b: 0.9 } : { r: 1, g: 1, b: 0.9 },
    };
  }
  figma.notify(`${violations.length} violation(s) added as sticky notes`);
}

async function exportFixes(fixes: any[]): Promise<void> {
  // Apply color fixes to selected nodes
  for (const fix of fixes) {
    // Implementation would map bounds to Figma nodes
  }
  figma.notify('Fixes exported to Figma');
}

async function getAccessToken(): Promise<string> {
  // In production: implement OAuth or use a shared secret
  return 'demo-token';
}