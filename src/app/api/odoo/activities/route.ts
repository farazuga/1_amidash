import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOdooClient, isOdooConfigured } from '@/lib/odoo';
import {
  findOdooUserByEmail,
  getUserActivities,
  getActivitiesAssignedByUser,
  buildOdooRecordUrl,
  odooMany2oneName,
  odooFalseToNull,
} from '@/lib/odoo/queries';
import type { OdooActivity, OdooActivityResult } from '@/types/odoo';
import { internalError } from '@/lib/api/error-response';

function transformActivity(activity: OdooActivity, odooBaseUrl: string): OdooActivityResult {
  const summary = odooFalseToNull(activity.summary);
  const resName = odooFalseToNull(activity.res_name);

  return {
    id: activity.id,
    name: summary || resName || 'Untitled Activity',
    type: odooMany2oneName(activity.activity_type_id) || 'Activity',
    deadline: odooFalseToNull(activity.date_deadline),
    assignedBy: odooMany2oneName(activity.create_uid),
    assignedTo: odooMany2oneName(activity.user_id),
    recordName: resName,
    recordModel: activity.res_model,
    odooUrl: buildOdooRecordUrl(odooBaseUrl, activity.res_model, activity.res_id),
  };
}

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
      return NextResponse.json({
        myActivities: [],
        assignedByMe: [],
        configured: false,
      });
    }

    const userEmail = user.email;
    if (!userEmail) {
      return NextResponse.json({
        myActivities: [],
        assignedByMe: [],
        configured: true,
      });
    }

    const client = getOdooClient();
    const odooBaseUrl = process.env.ODOO_URL!;

    // Find matching Odoo user by email
    const odooUser = await findOdooUserByEmail(client, userEmail);
    if (!odooUser) {
      return NextResponse.json({
        myActivities: [],
        assignedByMe: [],
        configured: true,
      });
    }

    // Fetch both sets in parallel
    const [myRaw, assignedRaw] = await Promise.all([
      getUserActivities(client, odooUser.id),
      getActivitiesAssignedByUser(client, odooUser.id),
    ]);

    const myActivities = myRaw.map((a) => transformActivity(a, odooBaseUrl));
    const assignedByMe = assignedRaw.map((a) => transformActivity(a, odooBaseUrl));

    return NextResponse.json({ myActivities, assignedByMe, configured: true });
  } catch (error) {
    return internalError('Odoo Activities', error);
  }
}
