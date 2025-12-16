import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveCampaignClient, isActiveCampaignConfigured } from '@/lib/activecampaign';

export async function GET(request: NextRequest) {
  // Authenticate user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if AC is configured
  if (!isActiveCampaignConfigured()) {
    return NextResponse.json({ contacts: [] });
  }

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') || '';

  // Require at least 2 characters
  if (search.length < 2) {
    return NextResponse.json({ contacts: [] });
  }

  try {
    const client = getActiveCampaignClient();
    const contacts = await client.searchContacts(search);

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('Error searching contacts:', error);
    return NextResponse.json(
      { error: 'Failed to search contacts' },
      { status: 500 }
    );
  }
}
