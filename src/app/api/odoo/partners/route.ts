import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOdooClient, isOdooConfigured } from '@/lib/odoo';
import { searchPartners, parseStateCode, parseCountryCode } from '@/lib/odoo/queries';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isOdooConfigured()) {
      return NextResponse.json({ partners: [] });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ partners: [] });
    }

    const client = getOdooClient();
    const results = await searchPartners(client, query);

    const partners = results.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email || null,
      phone: p.phone || null,
      isCompany: p.is_company,
      address: p.street ? {
        street: (p.street || '') + (p.city ? '' : ''),
        city: p.city || null,
        state: parseStateCode(p.state_id),
        zip: p.zip || null,
        country: parseCountryCode(p.country_id),
      } : null,
    }));

    return NextResponse.json({ partners });
  } catch (error) {
    console.error('Odoo partner search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search partners' },
      { status: 500 }
    );
  }
}
