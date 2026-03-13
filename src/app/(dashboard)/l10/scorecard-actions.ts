'use server';

import { revalidatePath } from 'next/cache';
import { getL10Client } from '@/lib/l10/supabase-helpers';
import type {
  Scorecard,
  ScorecardMeasurableWithOwner,
  ScorecardEntry,
} from '@/types/l10';
import {
  validateInput,
  createMeasurableSchema,
  updateMeasurableSchema,
  reorderMeasurablesSchema,
  upsertScorecardEntrySchema,
} from '@/lib/l10/validation';

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// Scorecard Actions
// ============================================

export interface ScorecardData {
  scorecard: Scorecard;
  measurables: ScorecardMeasurableWithOwner[];
  entries: ScorecardEntry[];
}

export async function getScorecard(teamId: string): Promise<ActionResult<ScorecardData>> {
  try {
    const { supabase } = await getL10Client();

    // Get or create scorecard
    let { data: scorecard } = await supabase
      .from('l10_scorecards')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle();

    if (!scorecard) {
      const { data: newScorecard, error } = await supabase
        .from('l10_scorecards')
        .insert({ team_id: teamId, name: 'Scorecard' })
        .select()
        .single();
      if (error) throw error;
      scorecard = newScorecard;
    }

    // Get measurables with owners
    const { data: measurables, error: measError } = await supabase
      .from('l10_scorecard_measurables')
      .select('*, profiles ( id, full_name, email )')
      .eq('scorecard_id', scorecard.id)
      .eq('is_active', true)
      .order('display_order');

    if (measError) throw measError;

    // Get last 13 weeks of entries
    const measurableIds = (measurables || []).map((m: { id: string }) => m.id);
    let entries: ScorecardEntry[] = [];

    if (measurableIds.length > 0) {
      // Calculate 13 weeks ago (Monday)
      const now = new Date();
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const thirteenWeeksAgo = new Date(monday);
      thirteenWeeksAgo.setDate(monday.getDate() - 12 * 7);

      const { data: entryData, error: entryError } = await supabase
        .from('l10_scorecard_entries')
        .select('*')
        .in('measurable_id', measurableIds)
        .gte('week_of', thirteenWeeksAgo.toISOString().split('T')[0])
        .order('week_of');

      if (entryError) throw entryError;
      entries = (entryData || []) as ScorecardEntry[];
    }

    return {
      success: true,
      data: {
        scorecard: scorecard as Scorecard,
        measurables: (measurables || []) as ScorecardMeasurableWithOwner[],
        entries,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createMeasurable(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(createMeasurableSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { scorecardId, title, ownerId, unit, goalValue, goalDirection, autoSource, odooAccountCode, odooAccountName, odooDateMode } = validation.data;

    // Get next display order
    const { data: existing } = await supabase
      .from('l10_scorecard_measurables')
      .select('display_order')
      .eq('scorecard_id', scorecardId)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;

    const { error } = await supabase
      .from('l10_scorecard_measurables')
      .insert({
        scorecard_id: scorecardId,
        title,
        owner_id: ownerId || null,
        unit,
        goal_value: goalValue ?? null,
        goal_direction: goalDirection,
        auto_source: autoSource ?? null,
        odoo_account_code: odooAccountCode ?? null,
        odoo_account_name: odooAccountName ?? null,
        odoo_date_mode: odooDateMode ?? null,
        display_order: nextOrder,
      });

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateMeasurable(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(updateMeasurableSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();
    const { id, ...updates } = validation.data;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.ownerId !== undefined) dbUpdates.owner_id = updates.ownerId;
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
    if (updates.goalValue !== undefined) dbUpdates.goal_value = updates.goalValue;
    if (updates.goalDirection !== undefined) dbUpdates.goal_direction = updates.goalDirection;
    if (updates.autoSource !== undefined) {
      dbUpdates.auto_source = updates.autoSource;
      // Clear Odoo fields when switching away from odoo_account
      if (updates.autoSource !== 'odoo_account') {
        dbUpdates.odoo_account_code = null;
        dbUpdates.odoo_account_name = null;
        dbUpdates.odoo_date_mode = null;
      }
    }
    if (updates.odooAccountCode !== undefined) dbUpdates.odoo_account_code = updates.odooAccountCode;
    if (updates.odooAccountName !== undefined) dbUpdates.odoo_account_name = updates.odooAccountName;
    if (updates.odooDateMode !== undefined) dbUpdates.odoo_date_mode = updates.odooDateMode;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

    const { error } = await supabase
      .from('l10_scorecard_measurables')
      .update(dbUpdates)
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteMeasurable(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getL10Client();
    // Soft-delete by deactivating
    const { error } = await supabase
      .from('l10_scorecard_measurables')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function reorderMeasurables(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(reorderMeasurablesSchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase } = await getL10Client();

    for (const item of validation.data) {
      const { error } = await supabase
        .from('l10_scorecard_measurables')
        .update({ display_order: item.display_order })
        .eq('id', item.id);
      if (error) throw error;
    }

    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function upsertScorecardEntry(input: unknown): Promise<ActionResult> {
  try {
    const validation = validateInput(upsertScorecardEntrySchema, input);
    if (!validation.success) return { success: false, error: validation.error };

    const { supabase, user } = await getL10Client();
    const { measurableId, weekOf, value } = validation.data;

    const { error } = await supabase
      .from('l10_scorecard_entries')
      .upsert(
        {
          measurable_id: measurableId,
          week_of: weekOf,
          value,
          entered_by: user.id,
          is_auto_populated: false,
        },
        { onConflict: 'measurable_id,week_of' }
      );

    if (error) throw error;
    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function autoPopulateScorecardWeek(
  teamId: string,
  weekOf: string
): Promise<ActionResult> {
  try {
    const { supabase, user } = await getL10Client();

    // Get scorecard measurables with auto_source
    const { data: scorecard } = await supabase
      .from('l10_scorecards')
      .select('id')
      .eq('team_id', teamId)
      .single();

    if (!scorecard) return { success: false, error: 'No scorecard found' };

    // Cast needed: odoo_account_code/odoo_date_mode columns added by migration 050
    // but not yet in generated database.ts types
    const { data: measurables } = await (supabase
      .from('l10_scorecard_measurables') as any)
      .select('id, auto_source, odoo_account_code, odoo_date_mode')
      .eq('scorecard_id', scorecard.id)
      .eq('is_active', true)
      .not('auto_source', 'is', null) as { data: Array<{ id: string; auto_source: string; odoo_account_code: string | null; odoo_date_mode: string | null }> | null };

    if (!measurables || measurables.length === 0) return { success: true };

    // Calculate week range (Monday to Friday)
    const weekStart = new Date(weekOf + 'T00:00:00');
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 4); // Friday
    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = weekEnd.toISOString().split('T')[0];

    // Get invoiced status ID for open_projects queries
    let invoicedStatusId: string | null = null;
    const hasOpenProjects = measurables.some((m) => m.auto_source === 'open_projects');
    if (hasOpenProjects) {
      const { data: statuses } = await supabase
        .from('statuses')
        .select('id')
        .eq('name', 'Invoiced')
        .maybeSingle();
      invoicedStatusId = statuses?.id || null;
    }

    for (const measurable of measurables) {
      let value: number | null = null;

      if (measurable.auto_source === 'po_revenue') {
        // SUM sales_amount WHERE created_date in week range (Mon-Fri)
        const { data: projects } = await supabase
          .from('projects')
          .select('sales_amount')
          .gte('created_date', startStr)
          .lte('created_date', endStr);

        value = (projects || []).reduce((sum: number, p: { sales_amount: number | null }) => sum + (p.sales_amount || 0), 0);
      } else if (measurable.auto_source === 'invoiced_revenue') {
        // SUM sales_amount WHERE invoiced_date in week range (Mon-Fri)
        const { data: projects } = await supabase
          .from('projects')
          .select('sales_amount')
          .not('invoiced_date', 'is', null)
          .gte('invoiced_date', startStr)
          .lte('invoiced_date', endStr);

        value = (projects || []).reduce((sum: number, p: { sales_amount: number | null }) => sum + (p.sales_amount || 0), 0);
      } else if (measurable.auto_source === 'open_projects') {
        // COUNT projects that are NOT invoiced (open/active)
        let countQuery = supabase
          .from('projects')
          .select('id', { count: 'exact', head: true });
        if (invoicedStatusId) {
          countQuery = countQuery.neq('current_status_id', invoicedStatusId);
        }
        const { count } = await countQuery;
        value = count ?? 0;
      } else if (measurable.auto_source === 'odoo_account') {
        if (!measurable.odoo_account_code || !measurable.odoo_date_mode) {
          continue; // skip misconfigured measurables
        }

        const { isOdooConfigured, getOdooClient } = await import('@/lib/odoo');
        if (!isOdooConfigured()) {
          continue;
        }

        const { getAccountMovement, getAccountBalance } = await import('@/lib/odoo/queries');
        const odooClient = getOdooClient();

        if (measurable.odoo_date_mode === 'date_range') {
          // Net movement from Saturday through Friday
          const saturday = new Date(weekStart);
          saturday.setDate(weekStart.getDate() - 2);
          const satStr = saturday.toISOString().split('T')[0];
          value = await getAccountMovement(odooClient, measurable.odoo_account_code, satStr, endStr);
        } else if (measurable.odoo_date_mode === 'last_day') {
          // Cumulative balance as-of Friday
          value = await getAccountBalance(odooClient, measurable.odoo_account_code, endStr);
        }
      }

      if (value !== null) {
        await supabase
          .from('l10_scorecard_entries')
          .upsert(
            {
              measurable_id: measurable.id,
              week_of: weekOf,
              value,
              entered_by: user.id,
              is_auto_populated: true,
            },
            { onConflict: 'measurable_id,week_of' }
          );
      }
    }

    revalidatePath('/l10');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
