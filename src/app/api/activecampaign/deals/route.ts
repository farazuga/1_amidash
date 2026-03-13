import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveCampaignClient, isActiveCampaignConfigured } from '@/lib/activecampaign';
import type { ACDealDisplay } from '@/types/activecampaign';

const PIPELINE_NAME = 'Solutions';
const STAGE_NAME = 'Verbal Commit';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isActiveCampaignConfigured()) {
      return NextResponse.json(
        { error: 'ActiveCampaign is not configured', deals: [] },
        { status: 200 }
      );
    }

    const client = getActiveCampaignClient();

    // Find Solution pipeline
    const pipelines = await client.getPipelines();
    const pipeline = pipelines.find(
      (p) => p.title.toLowerCase() === PIPELINE_NAME.toLowerCase()
    );

    if (!pipeline) {
      return NextResponse.json(
        { error: `Pipeline "${PIPELINE_NAME}" not found`, deals: [] },
        { status: 200 }
      );
    }

    // Find Verbal Commit stage
    const stages = await client.getDealStages(pipeline.id);
    const stage = stages.find(
      (s) => s.title.toLowerCase() === STAGE_NAME.toLowerCase()
    );

    if (!stage) {
      return NextResponse.json(
        { error: `Stage "${STAGE_NAME}" not found`, deals: [] },
        { status: 200 }
      );
    }

    // Fetch open deals in that stage
    const deals = await client.getDeals({ stageId: stage.id, status: 0 });

    // Find the "Forecasted Close Date" custom field ID
    const customFieldMeta = await client.getDealCustomFieldMeta();

    // Debug mode: return custom field info and raw deal data
    const debug = request.nextUrl.searchParams.get('debug');
    if (debug) {
      const firstDeal = deals[0];
      const firstDealCustomFields = firstDeal
        ? await client.getDealCustomFieldData(firstDeal.id)
        : [];
      return NextResponse.json({
        customFieldMeta,
        firstDealCustomFields,
        firstDealKeys: firstDeal ? Object.keys(firstDeal) : [],
        firstDealSample: firstDeal ? { title: firstDeal.title, nextdate: firstDeal.nextdate } : null,
      firstDealRaw: firstDeal,
      });
    }

    const forecastField = customFieldMeta.find(
      (f) => f.fieldLabel.toLowerCase().includes('forecast') && f.fieldLabel.toLowerCase().includes('close')
    );

    // Resolve contact, account, and forecast close date in parallel
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

        // Get forecast close date from custom fields
        let forecastCloseDate = '';
        if (forecastField) {
          const fcField = customFields.find((f) => f.customFieldId === forecastField.id);
          forecastCloseDate = fcField?.fieldValue || '';
        }

        return { ...deal, contactName, accountName, dealUrl, forecastCloseDate };
      })
    );

    // Sort by forecast close date ascending (deals without date go to end)
    resolvedDeals.sort((a, b) => {
      const aDate = a.forecastCloseDate || '';
      const bDate = b.forecastCloseDate || '';
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    return NextResponse.json({ deals: resolvedDeals });
  } catch (error) {
    console.error('AC deals fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deals', deals: [] },
      { status: 500 }
    );
  }
}
