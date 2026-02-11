import { supabase, isSupabaseConfigured } from '../supabase-client.js';
import { logger } from '../../utils/logger.js';
import { startOfWeek, startOfMonth, addDays, format } from 'date-fns';
// Generate a color based on status name
function getStatusColor(statusName) {
    const name = statusName.toLowerCase();
    if (name.includes('complete'))
        return '#10b981'; // green
    if (name.includes('progress') || name.includes('active'))
        return '#3b82f6'; // blue
    if (name.includes('review') || name.includes('waiting'))
        return '#f59e0b'; // amber
    if (name.includes('pending') || name.includes('hold'))
        return '#6b7280'; // gray
    if (name.includes('cancel'))
        return '#ef4444'; // red
    if (name.includes('design') || name.includes('planning'))
        return '#8b5cf6'; // purple
    if (name.includes('test') || name.includes('qa'))
        return '#06b6d4'; // cyan
    return '#6b7280'; // default gray
}
export async function fetchProjectMetrics() {
    if (!isSupabaseConfigured() || !supabase) {
        logger.debug('Supabase not configured, returning mock metrics');
        return getMockMetrics();
    }
    try {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const monthStart = startOfMonth(now);
        const nextWeek = addDays(now, 7);
        // Fetch all projects with their status and type
        const { data: projects, error: projectsError } = await supabase
            .from('projects')
            .select(`
        id,
        goal_completion_date,
        statuses:current_status_id(id, name),
        project_types:project_type_id(name)
      `);
        if (projectsError)
            throw projectsError;
        // Fetch completed status IDs (statuses containing "complete" in name)
        const { data: completedStatuses, error: statusError } = await supabase
            .from('statuses')
            .select('id, name')
            .ilike('name', '%complete%');
        if (statusError)
            throw statusError;
        const completedStatusIds = new Set((completedStatuses || []).map(s => s.id));
        // Count projects by status
        const statusCounts = new Map();
        // Count projects by type
        const typeCounts = new Map();
        // Count overdue and upcoming
        let overdueCount = 0;
        let upcomingDeadlines = 0;
        for (const project of projects || []) {
            const status = project.statuses;
            const projectType = project.project_types;
            // Status counts
            if (status) {
                const existing = statusCounts.get(status.name);
                if (existing) {
                    existing.count++;
                }
                else {
                    statusCounts.set(status.name, { color: getStatusColor(status.name), count: 1 });
                }
                // Skip completed projects for deadline checks
                if (!completedStatusIds.has(status.id)) {
                    const dueDate = project.goal_completion_date ? new Date(project.goal_completion_date) : null;
                    if (dueDate) {
                        if (dueDate < now) {
                            overdueCount++;
                        }
                        else if (dueDate <= nextWeek) {
                            upcomingDeadlines++;
                        }
                    }
                }
            }
            // Type counts
            if (projectType) {
                typeCounts.set(projectType.name, (typeCounts.get(projectType.name) || 0) + 1);
            }
        }
        // Fetch status history for completed projects this week/month
        const { data: recentCompletions, error: historyError } = await supabase
            .from('status_history')
            .select('id, changed_at, status_id')
            .in('status_id', Array.from(completedStatusIds))
            .gte('changed_at', format(monthStart, 'yyyy-MM-dd'));
        if (historyError)
            throw historyError;
        const completedThisWeek = (recentCompletions || []).filter(c => c.changed_at && new Date(c.changed_at) >= weekStart).length;
        const completedThisMonth = (recentCompletions || []).length;
        const byStatus = Array.from(statusCounts.entries())
            .map(([status_name, data]) => ({
            status_name,
            status_color: data.color,
            count: data.count,
        }))
            .sort((a, b) => b.count - a.count);
        const byType = Array.from(typeCounts.entries())
            .map(([type_name, count]) => ({ type_name, count }))
            .sort((a, b) => b.count - a.count);
        return {
            total: projects?.length || 0,
            byStatus,
            byType,
            completedThisWeek,
            completedThisMonth,
            upcomingDeadlines,
            overdueCount,
        };
    }
    catch (error) {
        logger.error({ error }, 'Failed to fetch project metrics, returning mock data');
        return getMockMetrics();
    }
}
function getMockMetrics() {
    return {
        total: 24,
        byStatus: [
            { status_name: 'In Progress', status_color: '#3b82f6', count: 8 },
            { status_name: 'Review', status_color: '#f59e0b', count: 5 },
            { status_name: 'Design', status_color: '#8b5cf6', count: 4 },
            { status_name: 'Pending', status_color: '#6b7280', count: 4 },
            { status_name: 'Complete', status_color: '#10b981', count: 3 },
        ],
        byType: [
            { type_name: 'Integration', count: 10 },
            { type_name: 'Custom Development', count: 8 },
            { type_name: 'Support', count: 6 },
        ],
        completedThisWeek: 2,
        completedThisMonth: 7,
        upcomingDeadlines: 3,
        overdueCount: 1,
    };
}
//# sourceMappingURL=metrics.js.map