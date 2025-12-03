import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';

// DELETE - Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userIdToDelete } = await params;

    // Verify the requesting user is an admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Prevent self-deletion
    if (user.id === userIdToDelete) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the user to be deleted (for logging)
    const { data: userToDelete } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userIdToDelete)
      .single();

    if (!userToDelete) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Use service client to delete user
    const serviceClient = await createServiceClient();

    // Delete the user from Supabase Auth
    // This will cascade to delete the profile due to ON DELETE CASCADE
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(
      userIdToDelete
    );

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    // Log the deletion to audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'delete',
      field_name: 'user',
      old_value: `${userToDelete.full_name || userToDelete.email}`,
    });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
