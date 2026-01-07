import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchActiveProjects } from './projects';
// Mock logger
vi.mock('../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));
// Mock supabase-client - always return not configured for unit tests
vi.mock('../supabase-client', () => ({
    supabase: null,
    isSupabaseConfigured: vi.fn(() => false),
}));
import { logger } from '../../utils/logger';
describe('fetchActiveProjects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe('mock data fallback', () => {
        it('should return mock projects when Supabase not configured', async () => {
            const projects = await fetchActiveProjects();
            expect(projects).toHaveLength(3);
            expect(projects[0]).toHaveProperty('id');
            expect(projects[0]).toHaveProperty('name');
            expect(projects[0]).toHaveProperty('client_name');
            expect(projects[0]).toHaveProperty('status');
            expect(projects[0]).toHaveProperty('status_color');
        });
        it('should log debug message about mock data', async () => {
            await fetchActiveProjects();
            expect(logger.debug).toHaveBeenCalledWith('Supabase not configured, returning mock projects');
        });
        it('should return projects with expected structure', async () => {
            const projects = await fetchActiveProjects();
            const project = projects[0];
            expect(typeof project.id).toBe('string');
            expect(typeof project.name).toBe('string');
            expect(typeof project.client_name).toBe('string');
            expect(typeof project.status).toBe('string');
            expect(typeof project.status_color).toBe('string');
            expect(typeof project.total_value).toBe('number');
        });
        it('should return projects with valid hex status colors', async () => {
            const projects = await fetchActiveProjects();
            projects.forEach((project) => {
                expect(project.status_color).toMatch(/^#[0-9a-f]{6}$/i);
            });
        });
        it('should have project_type field', async () => {
            const projects = await fetchActiveProjects();
            projects.forEach((project) => {
                expect(project).toHaveProperty('project_type');
            });
        });
        it('should have salesperson field', async () => {
            const projects = await fetchActiveProjects();
            projects.forEach((project) => {
                expect(project).toHaveProperty('salesperson');
            });
        });
        it('should have date fields', async () => {
            const projects = await fetchActiveProjects();
            projects.forEach((project) => {
                expect(project).toHaveProperty('start_date');
                expect(project).toHaveProperty('due_date');
            });
        });
        it('should have positive total_value', async () => {
            const projects = await fetchActiveProjects();
            projects.forEach((project) => {
                expect(project.total_value).toBeGreaterThan(0);
            });
        });
    });
    describe('mock data content', () => {
        it('should include Project Alpha', async () => {
            const projects = await fetchActiveProjects();
            const alpha = projects.find(p => p.name === 'Project Alpha');
            expect(alpha).toBeDefined();
            expect(alpha?.status).toBe('In Progress');
            expect(alpha?.status_color).toBe('#3b82f6'); // blue
        });
        it('should include Project Beta with Review status', async () => {
            const projects = await fetchActiveProjects();
            const beta = projects.find(p => p.name === 'Project Beta');
            expect(beta).toBeDefined();
            expect(beta?.status).toBe('Review');
            expect(beta?.status_color).toBe('#f59e0b'); // amber
        });
        it('should include Project Gamma with Design status', async () => {
            const projects = await fetchActiveProjects();
            const gamma = projects.find(p => p.name === 'Project Gamma');
            expect(gamma).toBeDefined();
            expect(gamma?.status).toBe('Design');
            expect(gamma?.status_color).toBe('#8b5cf6'); // purple
        });
        it('should have correct client names', async () => {
            const projects = await fetchActiveProjects();
            const clientNames = projects.map(p => p.client_name);
            expect(clientNames).toContain('Client A');
            expect(clientNames).toContain('Client B');
            expect(clientNames).toContain('Client C');
        });
        it('should have different project types', async () => {
            const projects = await fetchActiveProjects();
            const types = new Set(projects.map(p => p.project_type));
            expect(types.size).toBeGreaterThan(1);
        });
    });
    describe('ActiveProject interface compliance', () => {
        it('should match ActiveProject interface', async () => {
            const projects = await fetchActiveProjects();
            const project = projects[0];
            // All required fields should be present
            expect(project).toEqual(expect.objectContaining({
                id: expect.any(String),
                name: expect.any(String),
                client_name: expect.any(String),
                status: expect.any(String),
                status_color: expect.any(String),
                total_value: expect.any(Number),
            }));
        });
        it('should have nullable fields as string or null', async () => {
            const projects = await fetchActiveProjects();
            projects.forEach((project) => {
                expect(project.project_type === null || typeof project.project_type === 'string').toBe(true);
                expect(project.salesperson === null || typeof project.salesperson === 'string').toBe(true);
                expect(project.start_date === null || typeof project.start_date === 'string').toBe(true);
                expect(project.due_date === null || typeof project.due_date === 'string').toBe(true);
            });
        });
    });
});
//# sourceMappingURL=projects.test.js.map