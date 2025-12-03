import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';

// POST - Create a new user
export async function POST(request: NextRequest) {
  try {
    // Verify the requesting user is an admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { email, full_name, role = 'viewer', is_salesperson = false } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Use service client to create user
    const serviceClient = await createServiceClient();

    // Create the user with Supabase Admin API
    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email so they can log in immediately
      user_metadata: {
        full_name,
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // Update the profile with role and salesperson status
    // (profile is auto-created by trigger, but we need to update it)
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({
        full_name,
        role,
        is_salesperson,
      })
      .eq('id', newUser.user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      // User was created but profile update failed - not critical
    }

    // Send password reset email so user can set their password
    const { error: resetError } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (resetError) {
      console.error('Error sending reset email:', resetError);
      // User was created but email failed - they can use forgot password
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
      },
      message: 'User created. They can log in using the "Forgot Password" link to set their password.',
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - List all users (for admin)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
