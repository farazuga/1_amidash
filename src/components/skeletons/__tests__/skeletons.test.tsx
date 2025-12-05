import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartSkeleton } from '../chart-skeleton';
import { DashboardSkeleton } from '../dashboard-skeleton';
import { ProjectsTableSkeleton } from '../projects-table-skeleton';

describe('Skeleton Components', () => {
  describe('ChartSkeleton', () => {
    it('renders with correct accessibility attributes', () => {
      render(<ChartSkeleton />);

      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('aria-label', 'Loading chart');
    });

    it('renders with correct styling classes', () => {
      render(<ChartSkeleton />);

      const skeleton = screen.getByRole('status');
      expect(skeleton).toHaveClass('h-[300px]', 'animate-pulse', 'bg-muted');
    });

    it('contains screen reader text', () => {
      render(<ChartSkeleton />);

      expect(screen.getByText('Loading chart...')).toBeInTheDocument();
    });
  });

  describe('DashboardSkeleton', () => {
    it('renders with correct accessibility attributes', () => {
      render(<DashboardSkeleton />);

      // Use specific name to get the dashboard skeleton (not nested chart skeletons)
      const skeleton = screen.getByRole('status', { name: 'Loading dashboard' });
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('aria-label', 'Loading dashboard');
    });

    it('renders four stat card skeletons', () => {
      render(<DashboardSkeleton />);

      // Each card has a header skeleton div
      const animatedDivs = document.querySelectorAll('.animate-pulse');
      expect(animatedDivs.length).toBeGreaterThan(4);
    });

    it('renders two chart skeleton areas', () => {
      render(<DashboardSkeleton />);

      // ChartSkeleton renders with aria-label="Loading chart"
      const chartSkeletons = screen.getAllByLabelText('Loading chart');
      expect(chartSkeletons).toHaveLength(2);
    });

    it('contains screen reader text', () => {
      render(<DashboardSkeleton />);

      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    });
  });

  describe('ProjectsTableSkeleton', () => {
    it('renders with correct accessibility attributes', () => {
      render(<ProjectsTableSkeleton />);

      const skeleton = screen.getByRole('status');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('aria-label', 'Loading projects');
    });

    it('renders default number of rows (5)', () => {
      render(<ProjectsTableSkeleton />);

      // Table body rows (excluding header)
      const rows = screen.getAllByRole('row');
      // 1 header row + 5 body rows
      expect(rows).toHaveLength(6);
    });

    it('renders custom number of rows', () => {
      render(<ProjectsTableSkeleton rows={10} />);

      const rows = screen.getAllByRole('row');
      // 1 header row + 10 body rows
      expect(rows).toHaveLength(11);
    });

    it('renders table headers', () => {
      render(<ProjectsTableSkeleton />);

      expect(screen.getByText('Client')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Contract Type')).toBeInTheDocument();
      expect(screen.getByText('Goal Date')).toBeInTheDocument();
      expect(screen.getByText('PO #')).toBeInTheDocument();
      expect(screen.getByText('Sales Order')).toBeInTheDocument();
      expect(screen.getByText('POC')).toBeInTheDocument();
    });

    it('contains screen reader text', () => {
      render(<ProjectsTableSkeleton />);

      expect(screen.getByText('Loading projects...')).toBeInTheDocument();
    });
  });
});
