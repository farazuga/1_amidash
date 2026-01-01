import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { emailSchema, roleSchema } from '@/lib/validation';

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
    const { email, full_name, role: rawRole = 'viewer', is_salesperson = false, password } = body;

    // Validate email
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Validate role
    const roleResult = roleSchema.safeParse(rawRole);
    if (!roleResult.success) {
      return NextResponse.json(
        { error: 'Invalid role. Must be: admin, editor, viewer, or customer' },
        { status: 400 }
      );
    }
    const role = roleResult.data;

    // For customers, password is required
    const isCustomer = role === 'customer';
    if (isCustomer && (!password || password.length < 8)) {
      return NextResponse.json(
        { error: 'Password is required for customer accounts (minimum 8 characters)' },
        { status: 400 }
      );
    }

    // Use service client to create user
    const serviceClient = await createServiceClient();

    // Build user creation options
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createUserOptions: any = {
      email,
      email_confirm: true, // Auto-confirm email so they can log in immediately
      user_metadata: {
        full_name,
      },
    };

    // Add password for customer accounts
    if (isCustomer && password) {
      createUserOptions.password = password;
    }

    // Create the user with Supabase Admin API
    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser(createUserOptions);

    if (createError) {
      console.error('Error creating user:', createError);
      return NextResponse.json({ error: 'User creation failed' }, { status: 400 });
    }

    // Update the profile with role and salesperson status
    // (profile is auto-created by trigger, but we need to update it)
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({
        full_name,
        role,
        is_salesperson: isCustomer ? false : is_salesperson, // Customers are never salespeople
      })
      .eq('id', newUser.user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      // User was created but profile update failed - not critical
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
      },
      message: isCustomer
        ? 'Customer account created with password set.'
        : 'User created. They can use "Forgot Password" to set their password.',
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
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
