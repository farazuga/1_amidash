import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusChart } from '../status-chart';
import { RevenueChart } from '../revenue-chart';

// Mock ResizeObserver for Recharts
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 300, height: 300 }}>
        {children}
      </div>
    ),
  };
});

describe('Chart Components', () => {
  describe('StatusChart', () => {
    const mockData = [
      { name: 'PO Received', count: 10, color: 'hsl(0, 70%, 50%)' },
      { name: 'In Progress', count: 15, color: 'hsl(40, 70%, 50%)' },
      { name: 'Completed', count: 5, color: 'hsl(80, 70%, 50%)' },
    ];

    it('renders chart with data', () => {
      render(<StatusChart data={mockData} />);

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders empty state when no data has counts', () => {
      const emptyData = [
        { name: 'PO Received', count: 0, color: 'hsl(0, 70%, 50%)' },
        { name: 'In Progress', count: 0, color: 'hsl(40, 70%, 50%)' },
      ];

      render(<StatusChart data={emptyData} />);

      expect(screen.getByText('No project data available')).toBeInTheDocument();
    });

    it('renders empty state when data array is empty', () => {
      render(<StatusChart data={[]} />);

      expect(screen.getByText('No project data available')).toBeInTheDocument();
    });

    it('filters out zero-count items', () => {
      const mixedData = [
        { name: 'PO Received', count: 10, color: 'hsl(0, 70%, 50%)' },
        { name: 'Empty Status', count: 0, color: 'hsl(40, 70%, 50%)' },
      ];

      render(<StatusChart data={mixedData} />);

      // Should render chart because there's at least one non-zero count
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });

  describe('RevenueChart', () => {
    const mockData = [
      { month: "Jan '24", revenue: 10000 },
      { month: "Feb '24", revenue: 15000 },
      { month: "Mar '24", revenue: 20000 },
    ];

    it('renders chart with data', () => {
      render(<RevenueChart data={mockData} />);

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('renders empty state when no revenue data', () => {
      const emptyData = [
        { month: "Jan '24", revenue: 0 },
        { month: "Feb '24", revenue: 0 },
      ];

      render(<RevenueChart data={emptyData} />);

      expect(screen.getByText('No revenue data available')).toBeInTheDocument();
    });

    it('renders empty state when data array is empty', () => {
      render(<RevenueChart data={[]} />);

      expect(screen.getByText('No revenue data available')).toBeInTheDocument();
    });

    it('renders chart when at least one month has revenue', () => {
      const mixedData = [
        { month: "Jan '24", revenue: 0 },
        { month: "Feb '24", revenue: 5000 },
      ];

      render(<RevenueChart data={mixedData} />);

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });
  });
});
