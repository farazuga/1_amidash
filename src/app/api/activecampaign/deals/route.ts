import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveCampaignClient, isActiveCampaignConfigured } from '@/lib/activecampaign';
import type { ACDealDisplay } from '@/types/activecampaign';

const PIPELINE_NAME = 'Solution';
const STAGE_NAME = 'Verbal Commit';

export async function GET() {
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

    // Resolve contact and account names in parallel
    const resolvedDeals: ACDealDisplay[] = await Promise.all(
      deals.map(async (deal) => {
        const [contact, account] = await Promise.all([
          deal.contact ? client.getContact(deal.contact) : Promise.resolve(null),
          deal.account ? client.getAccount(deal.account) : Promise.resolve(null),
        ]);

        const contactName = contact
          ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email
          : '';
        const accountName = account?.name || '';

        return { ...deal, contactName, accountName };
      })
    );

    // Sort by created date ascending
    resolvedDeals.sort((a, b) => new Date(a.cdate).getTime() - new Date(b.cdate).getTime());

    return NextResponse.json({ deals: resolvedDeals });
  } catch (error) {
    console.error('AC deals fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deals', deals: [] },
      { status: 500 }
    );
  }
}
