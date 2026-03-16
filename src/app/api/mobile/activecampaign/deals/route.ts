import { createClient } from '@supabase/supabase-js';
import { getActiveCampaignClient, isActiveCampaignConfigured } from '@/lib/activecampaign';
import type { ACDealDisplay } from '@/types/activecampaign';

/**
 * Mobile API endpoint for fetching ActiveCampaign deals
 *
 * Authentication: Bearer token (Supabase JWT) in Authorization header
 *
 * Response: { deals: ACDealDisplay[] }
 * Returns deals from "Solutions" pipeline in "Verbal Commit" stage
 */

const PIPELINE_NAME = 'Solutions';
const STAGE_NAME = 'Verbal Commit';

export async function GET(request: Request) {
  try {
    // 1. Extract Bearer token
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // 2. Verify token with Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // 3. Check AC is configured
    if (!isActiveCampaignConfigured()) {
      return Response.json(
        { error: 'ActiveCampaign is not configured', deals: [] },
        { status: 200 }
      );
    }

    const client = getActiveCampaignClient();

    // 4. Find Solutions pipeline
    const pipelines = await client.getPipelines();
    const pipeline = pipelines.find(
      (p) => p.title.toLowerCase() === PIPELINE_NAME.toLowerCase()
    );

    if (!pipeline) {
      return Response.json(
        { error: `Pipeline "${PIPELINE_NAME}" not found`, deals: [] },
        { status: 200 }
      );
    }

    // 5. Find Verbal Commit stage
    const stages = await client.getDealStages(pipeline.id);
    const stage = stages.find(
      (s) => s.title.toLowerCase() === STAGE_NAME.toLowerCase()
    );

    if (!stage) {
      return Response.json(
        { error: `Stage "${STAGE_NAME}" not found`, deals: [] },
        { status: 200 }
      );
    }

    // 6. Fetch open deals in that stage
    const deals = await client.getDeals({ stageId: stage.id, status: 0 });

    // 7. Get forecast close date custom field
    const customFieldMeta = await client.getDealCustomFieldMeta();
    const forecastField = customFieldMeta.find(
      (f) => f.fieldLabel.toLowerCase().includes('forecast') && f.fieldLabel.toLowerCase().includes('close')
    );

    // 8. Check which accounts already have confirmed POs
    const { data: poProjects } = await supabase
      .from('projects')
      .select('activecampaign_account_id')
      .not('activecampaign_account_id', 'is', null)
      .not('po_number', 'is', null);

    const poAccountIds = new Set(
      (poProjects || []).map((p) => p.activecampaign_account_id as string)
    );

    // 9. Resolve contact, account, and forecast close date
    const resolvedDeals: ACDealDisplay[] = await Promise.all(
      deals.map(async (deal) => {
        const [contact, account, customFields] = await Promise.all([
          deal.contact ? client.getContact(deal.contact) : Promise.resolve(null),
          deal.account ? client.getAccount(deal.account) : Promise.resolve(null),
          forecastField ? client.getDealCustomFieldData(deal.id) : Promise.resolve([]),
        ]);

        const contactName = contact
          ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email
          : '';
        const accountName = account?.name || '';
        const dealUrl = client.getDealUrl(deal.id);

        let forecastCloseDate = '';
        if (forecastField) {
          const fcField = customFields.find((f) => String(f.customFieldId) === String(forecastField.id));
          forecastCloseDate = fcField?.fieldValue || '';
        }

        const hasConfirmedPO = deal.account ? poAccountIds.has(deal.account) : false;

        return { ...deal, contactName, accountName, dealUrl, forecastCloseDate, hasConfirmedPO };
      })
    );

    // 10. Sort by forecast close date ascending
    resolvedDeals.sort((a, b) => {
      const aDate = a.forecastCloseDate || '';
      const bDate = b.forecastCloseDate || '';
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    return Response.json({ deals: resolvedDeals });
  } catch (error) {
    console.error('[Mobile AC Deals] Error:', error);
    return Response.json(
      { error: 'Failed to fetch deals', deals: [] },
      { status: 500 }
    );
  }
}
