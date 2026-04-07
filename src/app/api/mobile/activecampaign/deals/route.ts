import { createClient } from '@supabase/supabase-js';
import { authenticateMobileRequest } from '@/lib/mobile/auth';
import { internalError } from '@/lib/api/error-response';
import { getActiveCampaignClient, isActiveCampaignConfigured } from '@/lib/activecampaign';
import type { ACDealDisplay } from '@/types/activecampaign';

/**
 * Mobile API endpoint for fetching ActiveCampaign deals
 *
 * Authentication: Bearer token (Supabase JWT) in Authorization header
 * Authorization: Staff only (admin/editor/viewer)
 *
 * Response: { deals: ACDealDisplay[] }
 * Returns deals from "Solutions" pipeline in "Verbal Commit" stage
 */

const PIPELINE_NAME = 'Solutions';
const STAGE_NAME = 'Verbal Commit';
const BATCH_SIZE = 10;

export async function GET(request: Request) {
  try {
    // 1. Authenticate and authorize (staff only)
    const authResult = await authenticateMobileRequest(request);
    if (authResult instanceof Response) return authResult;

    // 2. Check AC is configured
    if (!isActiveCampaignConfigured()) {
      return Response.json(
        { error: 'ActiveCampaign is not configured', deals: [] },
        { status: 200 }
      );
    }

    const client = getActiveCampaignClient();

    // 3. Find Solutions pipeline
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

    // 4. Find Verbal Commit stage
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

    // 5. Fetch open deals in that stage
    const deals = await client.getDeals({ stageId: stage.id, status: 0 });

    // 6. Get forecast close date custom field
    const customFieldMeta = await client.getDealCustomFieldMeta();
    const forecastField = customFieldMeta.find(
      (f) => f.fieldLabel.toLowerCase().includes('forecast') && f.fieldLabel.toLowerCase().includes('close')
    );

    // 7. Check which accounts already have confirmed POs (use user-scoped client)
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/)?.[1];
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.getUser(token);

    const { data: poProjects } = await supabase
      .from('projects')
      .select('activecampaign_account_id')
      .not('activecampaign_account_id', 'is', null)
      .not('po_number', 'is', null);

    const poAccountIds = new Set(
      (poProjects || []).map((p) => p.activecampaign_account_id as string)
    );

    // 8. Resolve contact, account, and forecast close date in batches
    const resolvedDeals: ACDealDisplay[] = [];
    for (let i = 0; i < deals.length; i += BATCH_SIZE) {
      const batch = deals.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (deal) => {
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
      resolvedDeals.push(...results);
    }

    // 9. Sort by forecast close date ascending
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
    return internalError('Mobile AC Deals', error);
  }
}
