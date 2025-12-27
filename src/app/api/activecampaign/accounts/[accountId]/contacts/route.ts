import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveCampaignClient, isActiveCampaignConfigured } from '@/lib/activecampaign';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if AC is configured
    if (!isActiveCampaignConfigured()) {
      return NextResponse.json(
        { error: 'ActiveCampaign is not configured', contacts: [] },
        { status: 200 }
      );
    }

    const { accountId } = await params;

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID required', contacts: [] },
        { status: 400 }
      );
    }

    const client = getActiveCampaignClient();
    const contacts = await client.getContactsForAccount(accountId);

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('AC contacts fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts', contacts: [] },
      { status: 500 }
    );
  }
}
