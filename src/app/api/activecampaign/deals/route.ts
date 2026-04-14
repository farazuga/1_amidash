import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveCampaignClient, isActiveCampaignConfigured } from '@/lib/activecampaign';
import type { ACDealDisplay } from '@/types/activecampaign';

const PIPELINE_NAME = 'Solutions';
const STAGE_NAME = 'Verbal Commit';
const BATCH_SIZE = 10;

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const stagesParam = searchParams.get('stages');
    const fetchAllStages = stagesParam === 'all';

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

    // Get all stages for the pipeline
    const stages = await client.getDealStages(pipeline.id);

    // Determine which stages to fetch deals from
    let stagesToFetch: { id: string; title: string }[];

    if (fetchAllStages) {
      stagesToFetch = stages.map((s) => ({ id: s.id, title: s.title }));
    } else {
      const verbalCommitStage = stages.find(
        (s) => s.title.toLowerCase() === STAGE_NAME.toLowerCase()
      );

      if (!verbalCommitStage) {
        return NextResponse.json(
          { error: `Stage "${STAGE_NAME}" not found`, deals: [] },
          { status: 200 }
        );
      }

      stagesToFetch = [{ id: verbalCommitStage.id, title: verbalCommitStage.title }];
    }

    // Fetch open deals from each stage
    const dealsByStage = await Promise.all(
      stagesToFetch.map(async (s) => {
        const stageDeals = await client.getDeals({ stageId: s.id, status: 0 });
        return stageDeals.map((deal) => ({ deal, stageName: s.title }));
      })
    );
    const dealsWithStage = dealsByStage.flat();

    // Find the "Forecasted Close Date" custom field ID
    const customFieldMeta = await client.getDealCustomFieldMeta();

    const forecastField = customFieldMeta.find(
      (f) => f.fieldLabel.toLowerCase().includes('forecast') && f.fieldLabel.toLowerCase().includes('close')
    );

    // Query projects that have both an AC account ID and a PO number
    const { data: poProjects } = await supabase
      .from('projects')
      .select('activecampaign_account_id')
      .not('activecampaign_account_id', 'is', null)
      .not('po_number', 'is', null);

    const poAccountIds = new Set(
      (poProjects || []).map((p) => p.activecampaign_account_id as string)
    );

    // Resolve contact, account, and forecast close date in batches
    const resolvedDeals: ACDealDisplay[] = [];
    for (let i = 0; i < dealsWithStage.length; i += BATCH_SIZE) {
      const batch = dealsWithStage.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async ({ deal, stageName }) => {
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

          return { ...deal, contactName, accountName, dealUrl, forecastCloseDate, hasConfirmedPO, stageName };
        })
      );
      resolvedDeals.push(...results);
    }

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
