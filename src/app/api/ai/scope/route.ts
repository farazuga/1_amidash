import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

// Claude API proxy for iOS app SOW builder
// Keeps API key server-side for security

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ScopeRequest {
  messages: ClaudeMessage[];
  scope_id?: string;
  system_prompt_override?: string;
}

// Default system prompt for Amitrace SOW builder
const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant for Amitrace Field, a mobile app used by sales representatives
at Amitrace, a broadcast and streaming studio integration company based in Suwanee, Georgia.
Your job is to help sales reps create professional scope of work (SOW) documents through
natural voice conversation.

## About Amitrace
Amitrace specializes in building broadcast studios for educational institutions, primarily
high schools with Audio/Visual and CTAE (Career, Technical, and Agricultural Education)
programs. Projects typically include:
- Control rooms with production switching
- TV studios with cameras and lighting
- Podcast spaces
- Sports/remote production kits
- Classroom/field production equipment

## Your Equipment Knowledge
You are an expert in the equipment Amitrace commonly specifies:

**Switchers:** TriCaster Mini X, TriCaster 2 Elite, BMD ATEM Mini Extreme, BMD ATEM HD8
**Cameras:** BMD Studio 4K/Pro/Plus, Panasonic PTZ, Sony PXW-Z90
**Audio:** Mackie 1402/1202, Mackie DLZ Creator, Rodecaster Pro II/Duo
**Intercom:** ITC-300, Synco Wireless, Hollyland
**Graphics:** ProPresenter, Titler Live, Captivate
**Furniture:** Watson Unlimited desks, VidPOD podcast tables
**Lighting:** ikan POE, Lyra POE, Kino Flo, Fresnel
**Teleprompters:** ikan, Prompter People, Autocue

## Conversation Guidelines

1. Start by gathering basics: client name, school/organization, location
2. Listen for project type: New construction, Renovation, Upgrade, Build out
3. Capture core components: Control Room, Studio, optional areas (Podcast, Sports, Field)
4. Ask about infrastructure: Countertop vs broadcast console, ceiling type, existing equipment
5. Use Amitrace terminology: "Watson desk", "Turret", "Edison workflow", "Days x Talent"
6. Be conversational and concise for voice playback

When the conversation is complete, generate a structured JSON with client info, overview,
control room specs, studio specs, optional sections, and any missing information.`;

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body: ScopeRequest = await request.json();
    const { messages, scope_id, system_prompt_override } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Get custom system prompt from database if configured
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;

    // Note: ai_prompts table not yet in generated types, using type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    if (!system_prompt_override) {
      const { data: promptData } = await db
        .from('ai_prompts')
        .select('content')
        .eq('prompt_key', 'scope_builder_system')
        .eq('is_active', true)
        .single();

      if (promptData?.content) {
        systemPrompt = promptData.content;
      }
    } else {
      systemPrompt = system_prompt_override;
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    // Extract text content from response
    const textContent = response.content.find(block => block.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    // Check if conversation appears complete (contains structured JSON output)
    const conversationComplete = responseText.includes('"client"') &&
                                  responseText.includes('"control_room"') &&
                                  responseText.includes('"studio"');

    // Try to extract structured data if complete
    let extractedData = null;
    if (conversationComplete) {
      try {
        // Look for JSON in the response
        const jsonMatch = responseText.match(/\{[\s\S]*"client"[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // JSON parsing failed, that's okay
      }
    }

    // If scope_id provided, save conversation to database
    if (scope_id) {
      const { data: existingScope } = await db
        .from('scope_of_work')
        .select('conversation_history')
        .eq('id', scope_id)
        .single();

      if (existingScope) {
        const updatedHistory = [
          ...(existingScope.conversation_history || []),
          ...messages,
          { role: 'assistant', content: responseText }
        ];

        await db
          .from('scope_of_work')
          .update({
            conversation_history: updatedHistory,
            extracted_data: extractedData || existingScope.conversation_history,
            updated_at: new Date().toISOString(),
          })
          .eq('id', scope_id);
      }
    }

    return NextResponse.json({
      content: responseText,
      extracted_data: extractedData,
      conversation_complete: conversationComplete,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });

  } catch (error) {
    console.error('Claude API error:', error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
