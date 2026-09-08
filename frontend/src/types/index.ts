// Shared types for the accessibility auditor

export interface Violation {
  violation_id: string;
  audit_id: string;
  rule_id: string;
  severity: 'A' | 'AA' | 'AAA';
  element_selector: string;
  coordinates: { x: number; y: number; width: number; height: number };
  contrast_ratio?: number;
  expected_contrast?: number;
  current_hex?: string;
  suggested_hex?: string;
  cloudinary_asset_id?: string;
  fixed_asset_id?: string;
  cortex_explanation?: string;
  created_at: string;
  // Cloudinary function compatibility fields
  rule?: string;
  type?: 'contrast' | 'focus' | 'target-size' | 'reflow' | 'text-detection';
  bounds?: { x: number; y: number; width: number; height: number };
  actualRatio?: number;
  requiredRatio?: number;
  fgColor?: string;
  bgColor?: string;
  suggestedFg?: string;
  confidence?: number;
}

export interface Audit {
  audit_id: string;
  user_id: string;
  source_type: 'screenshot' | 'figma' | 'url' | 'github_pr';
  source_ref: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  wcag_version: string;
  cloudinary_public_id?: string;
  created_at: string;
}

export interface Component {
  component_id: string;
  name: string;
  framework: 'react' | 'vue' | 'html' | 'figma';
  repo_url?: string;
  latest_audit_id?: string;
  violation_count: number;
  last_scanned?: string;
}

export interface AnalysisResult {
  violations: Violation[];
  annotatedImage: Buffer;
  fixedImage: Buffer;
  metadata: {
    width: number;
    height: number;
    textRegionsFound: number;
    analysisTimestamp: string;
  };
}

export interface AuditResult {
  audit: Audit;
  violations: Violation[];
  annotatedUrl?: string;
  fixedUrl?: string;
  responsiveUrls?: Array<{ breakpoint: number; url: string }>;
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byRule: Record<string, number>;
  };
}

export type SourceType = Audit['source_type'];
export type ViolationSeverity = Violation['severity'];