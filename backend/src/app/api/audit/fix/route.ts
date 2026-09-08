import { NextRequest, NextResponse } from 'next/server';
import { generateFixExplanation } from '../../../lib/snowflake';

export async function POST(req: NextRequest) {
  try {
    const { violationId } = await req.json();

    if (!violationId) {
      return NextResponse.json({ error: 'violationId required' }, { status: 400 });
    }

    const explanation = await generateFixExplanation(violationId);

    return NextResponse.json({ explanation });
  } catch (error) {
    console.error('Fix explanation error:', error);
    return NextResponse.json({ error: 'Failed to generate explanation' }, { status: 500 });
  }
}