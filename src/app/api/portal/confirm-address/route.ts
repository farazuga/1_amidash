import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const { token, email } = await request.json();

  if (!token || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // 1. Validate token -> get project
  const { data: project } = await supabase
    .from('projects')
    .select('id, poc_email, delivery_street, delivery_city, delivery_state, delivery_zip, delivery_country')
    .eq('client_token', token)
    .single();

  if (!project) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  // 2. Check email matches poc_email (case-insensitive)
  if (email.toLowerCase().trim() !== project.poc_email?.toLowerCase().trim()) {
    return NextResponse.json(
      { error: 'Email does not match our records. Please try again.' },
      { status: 403 },
    );
  }

  // 3. Check not already confirmed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('delivery_address_confirmations')
    .select('id')
    .eq('project_id', project.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: true, alreadyConfirmed: true });
  }

  // 4. Check address exists
  if (!project.delivery_street) {
    return NextResponse.json({ error: 'Delivery address not yet available' }, { status: 400 });
  }

  // 5. Insert confirmation with address snapshot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('delivery_address_confirmations')
    .insert({
      project_id: project.id,
      confirmed_by_email: email.toLowerCase().trim(),
      address_snapshot: {
        street: project.delivery_street,
        city: project.delivery_city,
        state: project.delivery_state,
        zip: project.delivery_zip,
        country: project.delivery_country,
      },
    });

  if (error) return NextResponse.json({ error: 'Failed to confirm' }, { status: 500 });

  return NextResponse.json({ success: true });
}
