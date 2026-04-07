import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv, getServiceRoleKey } from '@/lib/supabase/server';
import { internalError } from '@/lib/api/error-response';

// Rate limiting: max 5 attempts per token per 15 minutes
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const { token, email } = await request.json();

  if (!token || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!checkRateLimit(token)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const { url } = getSupabaseEnv();
  const supabase = createClient(url, getServiceRoleKey());

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
  const { data: existing } = await supabase
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
  const { error } = await supabase
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

  if (error) {
    return internalError('Portal Confirm', error);
  }

  return NextResponse.json({ success: true });
}
