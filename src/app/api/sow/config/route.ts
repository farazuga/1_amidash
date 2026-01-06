import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// SOW Configuration endpoint for iOS app
// Returns active template, AI prompts, and equipment options
// iOS app caches this for offline use

interface SOWTemplate {
  id: string;
  name: string;
  version: string;
  sections: TemplateSection[];
  branding: {
    company: string;
    address: string;
    city_state_zip: string;
    footer: string;
  };
}

interface TemplateSection {
  id: string;
  name: string;
  required: boolean;
  conditional?: boolean;
  fields: TemplateField[];
}

interface TemplateField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  example?: string;
}

// Default Amitrace template (used if none in database)
const DEFAULT_TEMPLATE: SOWTemplate = {
  id: 'amitrace_educational_studio_v1',
  name: 'Amitrace Educational Studio SOW',
  version: '1.0',
  branding: {
    company: 'Amitrace',
    address: '1110 Satellite BLVD SW ST#304',
    city_state_zip: 'Suwanee Georgia 30024',
    footer: 'The content of this document is the sole property of Amitrace. Duplication and distribution of this document without Amitrace consent is strictly prohibited.',
  },
  sections: [
    {
      id: 'header',
      name: 'Header',
      required: true,
      fields: [
        { id: 'client_name', label: 'Client Name', type: 'text', required: true },
        { id: 'district', label: 'District/Organization', type: 'text', required: false },
        { id: 'date', label: 'Date', type: 'date', required: true },
      ],
    },
    {
      id: 'location',
      name: 'Location',
      required: true,
      fields: [
        { id: 'address', label: 'Address', type: 'text', required: true },
        { id: 'city_state_zip', label: 'City/State/Zip', type: 'text', required: true },
        { id: 'poc_name', label: 'Point of Contact Name', type: 'text', required: true },
        { id: 'poc_title', label: 'POC Title', type: 'text', required: false },
        { id: 'poc_email', label: 'POC Email', type: 'email', required: false },
      ],
    },
    {
      id: 'overview',
      name: 'Overview',
      required: true,
      fields: [
        { id: 'project_summary', label: 'Project Summary', type: 'textarea', required: true },
        { id: 'current_situation', label: 'Current Situation', type: 'textarea', required: false },
        { id: 'construction_type', label: 'Construction Type', type: 'select', required: false, options: ['New Construction', 'Renovation', 'Upgrade', 'Build Out'] },
        { id: 'installation_type', label: 'Installation Type', type: 'select', required: false, options: ['Countertop', 'Broadcast Console', 'Hybrid'] },
      ],
    },
    {
      id: 'control_room',
      name: 'Control Room',
      required: true,
      fields: [
        { id: 'description', label: 'Control Room Description', type: 'textarea', required: true },
        { id: 'desk_config', label: 'Desk Configuration', type: 'text', required: false, example: '2x 3-bay Watson Unlimited desks' },
        { id: 'switcher', label: 'Switcher', type: 'select', required: true, options: ['TriCaster Mini X', 'TriCaster 2 Elite', 'ATEM Mini Extreme', 'BMD ATEM HD8', 'BMD ATEM Television Studio', 'Other'] },
        { id: 'audio_mixer', label: 'Audio Mixer', type: 'select', required: false, options: ['Mackie 1402', 'Mackie 1202', 'Mackie DLZ Creator', 'Rodecaster Pro II', 'Rodecaster Duo', 'Other'] },
        { id: 'intercom', label: 'Intercom System', type: 'select', required: false, options: ['ITC-300', 'Synco Wireless', 'Hollyland', 'None'] },
        { id: 'graphics_software', label: 'Graphics Software', type: 'multiselect', required: false, options: ['ProPresenter', 'Titler Live', 'Captivate', 'vMix', 'None'] },
      ],
    },
    {
      id: 'studio',
      name: 'Studio',
      required: true,
      fields: [
        { id: 'description', label: 'Studio Description', type: 'textarea', required: true },
        { id: 'camera_type', label: 'Camera Type', type: 'select', required: true, options: ['BMD Studio 4K', 'BMD Studio 4K Pro', 'BMD Studio 4K Plus', 'Panasonic PTZ', 'Sony PTZ', 'Other'] },
        { id: 'camera_count', label: 'Number of Cameras', type: 'number', required: true },
        { id: 'teleprompter', label: 'Teleprompter', type: 'select', required: false, options: ['ikan', 'Prompter People', 'Autocue', 'None'] },
        { id: 'lighting_type', label: 'Lighting Type', type: 'multiselect', required: false, options: ['ikan POE', 'Lyra POE', 'Kino Flo', 'Fresnel', 'LED Panels', 'Other'] },
        { id: 'set_type', label: 'Set Type', type: 'multiselect', required: false, options: ['Physical Set', 'Green Screen', 'Chroma Wall', 'Virtual Set'] },
      ],
    },
    {
      id: 'podcast',
      name: 'Podcast',
      required: false,
      conditional: true,
      fields: [
        { id: 'podcast_table', label: 'Podcast Table', type: 'select', required: false, options: ['Watson Unlimited', 'VidPOD', 'Custom', 'None'] },
        { id: 'podcast_mixer', label: 'Podcast Mixer', type: 'select', required: false, options: ['Mackie DLZ Creator', 'Rodecaster Pro II', 'Rodecaster Duo', 'Other'] },
        { id: 'podcast_notes', label: 'Podcast Notes', type: 'textarea', required: false },
      ],
    },
    {
      id: 'sports_remote',
      name: 'Sports/Remote Production',
      required: false,
      conditional: true,
      fields: [
        { id: 'mobile_switcher', label: 'Mobile Switcher', type: 'select', required: false, options: ['ATEM Mini Extreme', 'TriCaster Mini X', 'vMix Go', 'Other'] },
        { id: 'portable_case', label: 'Portable Case', type: 'text', required: false, example: 'NYPocket studio case' },
        { id: 'sports_notes', label: 'Sports Production Notes', type: 'textarea', required: false },
      ],
    },
  ],
};

// Default equipment options
const DEFAULT_EQUIPMENT_OPTIONS = {
  switchers: [
    'TriCaster Mini X',
    'TriCaster 2 Elite',
    'BMD ATEM Mini Extreme',
    'BMD ATEM HD8',
    'BMD ATEM Television Studio',
  ],
  cameras: [
    'BMD Studio 4K',
    'BMD Studio 4K Pro',
    'BMD Studio 4K Plus',
    'Panasonic PTZ',
    'Sony PTZ',
    'Sony PXW-Z90',
    'BMD Pocket Cinema',
  ],
  audio_mixers: [
    'Mackie 1402',
    'Mackie 1202',
    'Mackie DLZ Creator',
    'Rodecaster Pro II',
    'Rodecaster Duo',
  ],
  intercoms: [
    'ITC-300',
    'Synco Wireless',
    'Hollyland',
  ],
  graphics: [
    'ProPresenter',
    'Titler Live',
    'Captivate',
    'vMix',
  ],
  lighting: [
    'ikan POE',
    'Lyra POE',
    'Kino Flo',
    'Fresnel',
    'LED Panels',
  ],
  teleprompters: [
    'ikan',
    'Prompter People',
    'Autocue',
  ],
  furniture: [
    'Watson Unlimited 2-bay',
    'Watson Unlimited 3-bay',
    'VidPOD',
    'Countertop Installation',
  ],
};

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant for Amitrace Field, a mobile app used by sales representatives at Amitrace, a broadcast and streaming studio integration company. Help sales reps create professional scope of work (SOW) documents through natural voice conversation.`;

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Note: SOW tables not yet in generated types, using type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Try to get template from database
    let template = DEFAULT_TEMPLATE;
    const { data: templateData } = await db
      .from('sow_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (templateData?.template_data) {
      template = templateData.template_data as SOWTemplate;
    }

    // Try to get system prompt from database
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    const { data: promptData } = await db
      .from('ai_prompts')
      .select('content')
      .eq('prompt_key', 'scope_builder_system')
      .eq('is_active', true)
      .single();

    if (promptData?.content) {
      systemPrompt = promptData.content;
    }

    // Try to get equipment options from database
    let equipmentOptions = DEFAULT_EQUIPMENT_OPTIONS;
    const { data: equipmentData } = await db
      .from('equipment_catalog')
      .select('category, name')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true });

    if (equipmentData && equipmentData.length > 0) {
      // Group equipment by category
      const grouped: Record<string, string[]> = {};
      for (const item of equipmentData) {
        if (!grouped[item.category]) {
          grouped[item.category] = [];
        }
        grouped[item.category].push(item.name);
      }
      equipmentOptions = { ...DEFAULT_EQUIPMENT_OPTIONS, ...grouped };
    }

    // Return configuration
    return NextResponse.json({
      template,
      systemPrompt,
      equipmentOptions,
      version: '1.0',
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('SOW config error:', error);

    // Return defaults on error
    return NextResponse.json({
      template: DEFAULT_TEMPLATE,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      equipmentOptions: DEFAULT_EQUIPMENT_OPTIONS,
      version: '1.0',
      lastUpdated: new Date().toISOString(),
    });
  }
}
