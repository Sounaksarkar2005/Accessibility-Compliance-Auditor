import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { uploadForAnalysis } from '../../../lib/cloudinary';
import { createAudit } from '../../../lib/snowflake';
import type { SourceType } from '../../../types';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const sourceType = (formData.get('sourceType') as string) || 'screenshot';
    const validSourceTypes: readonly SourceType[] = ['screenshot', 'figma', 'url', 'github_pr'];
    const typedSourceType: SourceType = validSourceTypes.includes(sourceType as SourceType) ? sourceType as SourceType : 'screenshot';
    const sourceRef = (formData.get('sourceRef') as string) || '';
    const userId = (formData.get('userId') as string) || 'anonymous';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const auditId = uuidv4();

    const uploadResult = await uploadForAnalysis(buffer, sourceType, sourceRef);

    await createAudit({
      audit_id: auditId,
      user_id: userId,
      source_type: typedSourceType,
      source_ref: sourceRef,
      status: 'processing',
      wcag_version: '2.2',
      cloudinary_public_id: uploadResult.public_id,
    });

    return NextResponse.json({
      auditId,
      status: 'processing',
      cloudinaryPublicId: uploadResult.public_id,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}