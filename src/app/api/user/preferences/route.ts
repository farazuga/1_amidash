import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { UserPreferences } from '@/types';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Select all columns - user_preferences and timezone may not exist until migration runs
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching preferences:', error);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    // Cast to any to handle columns that may not exist yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileData = profile as any;

    return NextResponse.json({
      preferences: profileData?.user_preferences || {},
      timezone: profileData?.timezone || 'America/New_York',
    });
  } catch (error) {
    console.error('Error in GET /api/user/preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { preferences, timezone } = body as {
      preferences?: Partial<UserPreferences>;
      timezone?: string;
    };

    // Get current preferences - columns may not exist until migration runs
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileData = currentProfile as any;
    const currentPrefs = (profileData?.user_preferences as UserPreferences) || {};

    // Merge preferences (deep merge for nested objects)
    const updatedPrefs: UserPreferences = {
      ...currentPrefs,
    };

    if (preferences?.projects_table) {
      updatedPrefs.projects_table = {
        ...currentPrefs.projects_table,
        ...preferences.projects_table,
      };
    }

    if (preferences?.projects_filter) {
      updatedPrefs.projects_filter = {
        ...currentPrefs.projects_filter,
        ...preferences.projects_filter,
      };
    }

    // Build update object - only include fields that might exist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    // Only try to update user_preferences if the column exists (migration has run)
    if (profileData?.user_preferences !== undefined || preferences) {
      updateData.user_preferences = updatedPrefs;
    }

    if (timezone !== undefined) {
      updateData.timezone = timezone;
    }

    // If there's nothing to update, just return success
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        preferences: updatedPrefs,
        timezone: profileData?.timezone || 'America/New_York',
      });
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (error) {
      // If the error is about missing columns, log it but return success with defaults
      if (error.message?.includes('does not exist')) {
        console.warn('Preferences columns not yet migrated:', error.message);
        return NextResponse.json({
          success: true,
          preferences: {},
          timezone: 'America/New_York',
          warning: 'Database migration pending',
        });
      }
      console.error('Error updating preferences:', error);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      preferences: updatedPrefs,
      timezone: timezone ?? profileData?.timezone ?? 'America/New_York',
    });
  } catch (error) {
    console.error('Error in PATCH /api/user/preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
