import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Get current user's email preference
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use type assertion since the table is created by a new migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)('email_notification_preferences')
      .select('notifications_enabled')
      .eq('email', user.email.toLowerCase())
      .single();

    // PGRST116 = no rows found - this is OK, just means no preference set yet
    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      email: user.email,
      notifications_enabled: data?.notifications_enabled ?? true,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update email preference
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notifications_enabled } = await request.json();

    if (typeof notifications_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'notifications_enabled must be a boolean' },
        { status: 400 }
      );
    }

    // Upsert the preference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)('email_notification_preferences')
      .upsert({
        email: user.email.toLowerCase(),
        notifications_enabled,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'email',
      });

    if (error) {
      console.error('Error updating email preference:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      notifications_enabled,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
