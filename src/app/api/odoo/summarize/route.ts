import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

interface LineItemInput {
  productName: string;
  quantity: number;
  description: string;
  subtotal: number;
}

interface SummarizeRequest {
  lineItems: LineItemInput[];
  clientName: string;
}

const SYSTEM_PROMPT = `You are a project management assistant for Amitrace, a broadcast and streaming studio integration company. Given sales order line items, summarize the key deliverables in 3-4 bullets max. Group similar items together (e.g. multiple cables into one bullet). Skip minor items like shipping, labor, or small accessories. Keep it casual and brief — internal only. A few words per bullet, plain language. No prices. Include product codes like [ami_VIDPOD] when present. One line item should never produce more than one bullet. Output a simple bulleted list with "• " prefix, nothing else.`;

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate input
    const body: SummarizeRequest = await request.json();
    const { lineItems, clientName } = body;

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'lineItems array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!clientName || typeof clientName !== 'string') {
      return NextResponse.json(
        { error: 'clientName is required' },
        { status: 400 }
      );
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Project description cannot be generated.' },
        { status: 500 }
      );
    }

    // Format line items for the prompt
    const itemsText = lineItems
      .map(
        (item, i) =>
          `${i + 1}. ${item.productName} (Qty: ${item.quantity}) - ${item.description}`
      )
      .join('\n');

    const userMessage = `Client: ${clientName}\n\nLine Items:\n${itemsText}\n\nBullet-point summary of deliverables:`;

    // Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textContent = response.content.find(
      (block) => block.type === 'text'
    );
    const summary =
      textContent?.type === 'text' ? textContent.text : '';

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Odoo summarize error:', error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate project summary' },
      { status: 500 }
    );
  }
}
