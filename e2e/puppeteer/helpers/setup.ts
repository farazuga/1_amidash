import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function setup() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Ensure Draft status exists
  await supabase
    .from('statuses')
    .upsert(
      {
        name: 'Draft',
        color: '#9CA3AF',
        display_order: 0,
        is_internal_only: true,
        is_active: true,
      },
      { onConflict: 'name' }
    )
    .select()
    .single();

  // Create a test project type if needed
  const { data: projectType } = await supabase
    .from('project_types')
    .select('id')
    .eq('name', 'E2E Test Type')
    .maybeSingle();

  if (!projectType) {
    await supabase.from('project_types').insert({
      name: 'E2E Test Type',
      display_order: 999,
      is_active: true,
    });
  }

  console.log('E2E test setup complete');
}
