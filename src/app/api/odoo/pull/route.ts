import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOdooClient, isOdooConfigured } from '@/lib/odoo';
import {
  findSalesOrderByNumber,
  getSalesOrderLines,
  getPartnerDetails,
  getPartnerContacts,
  buildOdooUrl,
  odooFalseToNull,
  odooMany2oneName,
  formatOdooPhone,
} from '@/lib/odoo/queries';
import type { OdooPullResult } from '@/types/odoo';

export async function POST(request: NextRequest) {
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

    // Parse and validate input
    const body = await request.json();
    const { salesOrderNumber } = body as { salesOrderNumber: string };

    if (!salesOrderNumber || typeof salesOrderNumber !== 'string') {
      return NextResponse.json(
        { error: 'salesOrderNumber is required' },
        { status: 400 }
      );
    }

    const trimmed = salesOrderNumber.trim().toUpperCase();
    if (!trimmed.startsWith('S1') || trimmed.length !== 6) {
      return NextResponse.json(
        { error: 'Sales order number must be S1XXXX format' },
        { status: 400 }
      );
    }

    // Fetch from Odoo
    const client = getOdooClient();
    const order = await findSalesOrderByNumber(client, trimmed);

    if (!order) {
      return NextResponse.json(
        { error: `Sales order ${trimmed} not found in Odoo` },
        { status: 404 }
      );
    }

    // Fetch partner details and order lines in parallel
    const partnerId = order.partner_id[0];
    const [partner, lines] = await Promise.all([
      getPartnerDetails(client, partnerId),
      getSalesOrderLines(client, order.order_line),
    ]);

    // Try to find a contact person under the partner (company)
    let pocName: string | null = null;
    let pocEmail: string | null = null;
    let pocPhone: string | null = null;

    if (partner && partner.child_ids.length > 0) {
      const contacts = await getPartnerContacts(client, partnerId);
      if (contacts.length > 0) {
        const firstContact = contacts[0];
        pocName = firstContact.name;
        pocEmail = odooFalseToNull(firstContact.email);
        pocPhone = formatOdooPhone(firstContact.phone || firstContact.mobile || false);
      }
    }

    // If no child contacts, use the partner directly
    if (!pocName && partner) {
      pocName = partner.name;
      pocEmail = odooFalseToNull(partner.email);
      pocPhone = formatOdooPhone(partner.phone || partner.mobile || false);
    }

    // Match salesperson to AmiDash profile
    const odooSalesperson = odooMany2oneName(order.user_id);
    let matchedProfileId: string | null = null;

    if (odooSalesperson) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('full_name', `%${odooSalesperson}%`)
        .eq('is_salesperson', true)
        .limit(1);

      if (profiles && profiles.length > 0) {
        matchedProfileId = profiles[0].id;
      }
    }

    // Build response
    const result: OdooPullResult = {
      salesOrder: {
        odooOrderId: order.id,
        salesOrderUrl: buildOdooUrl(process.env.ODOO_URL!, order.id),
        salesAmount: order.amount_total,
        poNumber: odooFalseToNull(order.client_order_ref),
        invoiceStatus: order.invoice_status,
      },
      client: {
        name: partner?.name || order.partner_id[1],
        pocName,
        pocEmail,
        pocPhone,
      },
      salesperson: {
        odooName: odooSalesperson || '',
        matchedProfileId,
      },
      lineItems: lines.map((line) => ({
        productName: line.product_id
          ? (line.product_id as [number, string])[1]
          : 'Unknown Product',
        quantity: line.product_uom_qty,
        description: line.name,
        subtotal: line.price_subtotal,
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Odoo pull error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to pull data from Odoo',
      },
      { status: 500 }
    );
  }
}
