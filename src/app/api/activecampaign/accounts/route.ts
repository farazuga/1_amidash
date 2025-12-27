import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveCampaignClient, isActiveCampaignConfigured } from '@/lib/activecampaign';

export async function GET(request: NextRequest) {
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
        { error: 'ActiveCampaign is not configured', accounts: [] },
        { status: 200 }
      );
    }

    // Get search term from query params
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');

    if (!search || search.length < 2) {
      return NextResponse.json({ accounts: [] });
    }

    const client = getActiveCampaignClient();
    const accounts = await client.searchAccounts(search);

    // Add account URL to each account
    const accountsWithUrls = accounts.map(account => ({
      ...account,
      accountUrl: account.accountUrl || client.getAccountUrl(account.id),
    }));

    return NextResponse.json({ accounts: accountsWithUrls });
  } catch (error) {
    console.error('AC accounts search error:', error);
    return NextResponse.json(
      { error: 'Failed to search accounts', accounts: [] },
      { status: 500 }
    );
  }
}
