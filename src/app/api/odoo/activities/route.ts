import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOdooClient, isOdooConfigured } from '@/lib/odoo';
import {
  findOdooUserByEmail,
  getUserActivities,
  buildOdooRecordUrl,
  odooMany2oneName,
  odooFalseToNull,
} from '@/lib/odoo/queries';
import type { OdooActivityResult } from '@/types/odoo';

export async function GET() {
  try {
    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Config check
    if (!isOdooConfigured()) {
      return NextResponse.json({ activities: [], configured: false });
    }

    const userEmail = user.email;
    if (!userEmail) {
      return NextResponse.json({ activities: [], configured: true });
    }

    const client = getOdooClient();
    const odooBaseUrl = process.env.ODOO_URL!;

    // Find matching Odoo user by email
    const odooUser = await findOdooUserByEmail(client, userEmail);
    if (!odooUser) {
      return NextResponse.json({ activities: [], configured: true });
    }

    // Fetch open activities for this user
    const activities = await getUserActivities(client, odooUser.id);

    // Transform to AmiDash format
    const results: OdooActivityResult[] = activities.map((activity) => {
      const summary = odooFalseToNull(activity.summary);
      const resName = odooFalseToNull(activity.res_name);

      return {
        id: activity.id,
        name: summary || resName || 'Untitled Activity',
        type: odooMany2oneName(activity.activity_type_id) || 'Activity',
        deadline: odooFalseToNull(activity.date_deadline),
        assignedBy: odooMany2oneName(activity.create_uid),
        recordName: resName,
        recordModel: activity.res_model,
        odooUrl: buildOdooRecordUrl(odooBaseUrl, activity.res_model, activity.res_id),
      };
    });

    return NextResponse.json({ activities: results, configured: true });
  } catch (error) {
    console.error('Odoo activities error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch activities from Odoo',
      },
      { status: 500 }
    );
  }
}
