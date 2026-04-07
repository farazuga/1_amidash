import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOdooClient, isOdooConfigured } from '@/lib/odoo';
import { getInvoiceStatus } from '@/lib/odoo/queries';
import { internalError } from '@/lib/api/error-response';

export async function GET(request: NextRequest) {
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
      return NextResponse.json(
        { error: 'Odoo is not configured' },
        { status: 200 }
      );
    }

    // Validate input
    const searchParams = request.nextUrl.searchParams;
    const orderIdStr = searchParams.get('orderId');

    if (!orderIdStr) {
      return NextResponse.json(
        { error: 'orderId query parameter is required' },
        { status: 400 }
      );
    }

    const orderId = parseInt(orderIdStr, 10);
    if (isNaN(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: 'orderId must be a positive integer' },
        { status: 400 }
      );
    }

    // Fetch from Odoo
    const client = getOdooClient();
    const invoiceStatus = await getInvoiceStatus(client, orderId);

    if (invoiceStatus === null) {
      return NextResponse.json(
        { error: `Order ${orderId} not found in Odoo` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      invoiceStatus,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return internalError('Odoo Invoice', error);
  }
}
