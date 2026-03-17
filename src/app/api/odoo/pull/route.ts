import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOdooClient, isOdooConfigured } from '@/lib/odoo';
import {
  findSalesOrderByNumber,
  getSalesOrderLines,
  getProductDetails,
  getPartnerDetails,
  getPartnerContacts,
  getShippingAddress,
  buildOdooUrl,
  odooFalseToNull,
  odooMany2oneName,
  formatOdooPhone,
  parseStateCode,
  parseCountryCode,
} from '@/lib/odoo/queries';
import type { OdooPullResult } from '@/types/odoo';
import { internalError } from '@/lib/api/error-response';
import { validateOrigin } from '@/lib/api/csrf';

export async function POST(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

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
    const [partner, lines, shippingPartner] = await Promise.all([
      getPartnerDetails(client, partnerId),
      getSalesOrderLines(client, order.order_line),
      getShippingAddress(client, order.id),
    ]);

    // Filter out section headers and notes — only keep actual product lines
    const productLines = lines.filter((line) => !line.display_type);

    // Fetch product internal references (default_code) for all products
    const productIds = productLines
      .filter((line) => line.product_id)
      .map((line) => (line.product_id as [number, string])[0]);

    const products = productIds.length > 0
      ? await getProductDetails(client, productIds)
      : [];

    // Build a lookup map: product ID → default_code (e.g. "ami_VIDPOD")
    const productCodeMap = new Map<number, string>();
    for (const product of products) {
      if (product.default_code) {
        productCodeMap.set(product.id, product.default_code as string);
      }
    }

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

    // Build delivery address from shipping partner
    let deliveryAddress: OdooPullResult['deliveryAddress'] = null;
    if (shippingPartner) {
      const street1 = odooFalseToNull(shippingPartner.street) || '';
      const street2 = odooFalseToNull(shippingPartner.street2) || '';
      const combinedStreet = [street1, street2].filter(Boolean).join(', ') || null;

      deliveryAddress = {
        street: combinedStreet,
        city: odooFalseToNull(shippingPartner.city),
        state: parseStateCode(shippingPartner.state_id),
        zip: odooFalseToNull(shippingPartner.zip),
        country: parseCountryCode(shippingPartner.country_id),
      };
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
      lineItems: productLines.map((line) => {
        const prodId = line.product_id ? (line.product_id as [number, string])[0] : null;
        const prodDisplayName = line.product_id
          ? (line.product_id as [number, string])[1]
          : 'Unknown Product';
        const internalRef = prodId ? productCodeMap.get(prodId) || null : null;

        // Use internal reference as productName if available (e.g. "ami_VIDPOD"),
        // otherwise fall back to the product display name
        const productName = internalRef
          ? `[${internalRef}] ${prodDisplayName}`
          : prodDisplayName;

        return {
          productName,
          quantity: line.product_uom_qty,
          description: line.name,
          subtotal: line.price_subtotal,
        };
      }),
      deliveryAddress,
    };

    return NextResponse.json(result);
  } catch (error) {
    return internalError('Odoo Pull', error);
  }
}
