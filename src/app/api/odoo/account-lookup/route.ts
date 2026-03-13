import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOdooClient, isOdooConfigured } from '@/lib/odoo';
import { findAccountByCode } from '@/lib/odoo/queries';

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

    if (!isOdooConfigured()) {
      return NextResponse.json({ error: 'Odoo is not configured' }, { status: 200 });
    }

    const body = await request.json();
    const { accountCode } = body as { accountCode: string };

    if (!accountCode || typeof accountCode !== 'string') {
      return NextResponse.json({ error: 'accountCode is required' }, { status: 400 });
    }

    const trimmed = accountCode.trim();
    if (trimmed.length === 0 || trimmed.length > 20) {
      return NextResponse.json({ error: 'Invalid account code' }, { status: 400 });
    }

    const client = getOdooClient();
    const account = await findAccountByCode(client, trimmed);

    if (!account) {
      return NextResponse.json({ error: `Account "${trimmed}" not found` }, { status: 404 });
    }

    return NextResponse.json({
      accountCode: account.code,
      accountName: account.name,
    });
  } catch (error) {
    console.error('Odoo account lookup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to look up account' },
      { status: 500 }
    );
  }
}
