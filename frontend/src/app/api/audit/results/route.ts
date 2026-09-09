import { NextRequest, NextResponse } from 'next/server';
import { getAuditWithViolations } from '../../../../lib/snowflake';
import { getAnnotatedImageUrl, getFixedImageUrl, getResponsiveUrls } from '../../../../lib/cloudinary';
import type { Violation } from '../../../../types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const auditId = searchParams.get('auditId');

    if (!auditId) {
      return NextResponse.json({ error: 'auditId required' }, { status: 400 });
    }

    const result = await getAuditWithViolations(auditId);
    if (!result) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    }

    const { audit, violations } = result;

    const annotatedUrl = audit.cloudinary_public_id
      ? getAnnotatedImageUrl(audit.cloudinary_public_id, violations as Violation[])
      : null;

    const fixes = (violations as Violation[])
      .filter((v: Violation) => Boolean(v.suggested_hex))
      .map((v: Violation) => ({
        bounds: v.coordinates,
        targetHex: v.suggested_hex!,
      }));

    const fixedUrl = audit.cloudinary_public_id && fixes.length > 0
      ? getFixedImageUrl(audit.cloudinary_public_id, fixes)
      : null;

    const responsiveUrls = audit.cloudinary_public_id
      ? getResponsiveUrls(audit.cloudinary_public_id)
      : [];

    return NextResponse.json({
      audit,
      violations,
      annotatedUrl,
      fixedUrl,
      responsiveUrls,
      summary: {
        total: violations.length,
        bySeverity: (violations as Violation[]).reduce((acc: Record<string, number>, v: Violation) => {
          acc[v.severity] = (acc[v.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byRule: (violations as Violation[]).reduce((acc: Record<string, number>, v: Violation) => {
          acc[v.rule_id] = (acc[v.rule_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    console.error('Results error:', error);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}