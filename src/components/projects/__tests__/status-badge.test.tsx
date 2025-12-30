import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../status-badge';
import { createStatus } from '@/test/factories';

describe('StatusBadge', () => {
  it('renders status name', () => {
    const status = createStatus({ name: 'In Progress' });
    render(<StatusBadge status={status} />);

    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders "No Status" when status is null', () => {
    render(<StatusBadge status={null} />);

    expect(screen.getByText('No Status')).toBeInTheDocument();
  });

  it('renders "No Status" when status is undefined', () => {
    render(<StatusBadge status={undefined} />);

    expect(screen.getByText('No Status')).toBeInTheDocument();
  });

  it('applies correct color class for PO Received', () => {
    const status = createStatus({ name: 'PO Received' });
    render(<StatusBadge status={status} />);

    const badge = screen.getByText('PO Received');
    expect(badge).toHaveClass('bg-blue-50', 'text-blue-800');
  });

  it('applies correct color class for Engineering Review', () => {
    const status = createStatus({ name: 'Engineering Review' });
    render(<StatusBadge status={status} />);

    const badge = screen.getByText('Engineering Review');
    expect(badge).toHaveClass('bg-purple-50', 'text-purple-800');
  });

  it('applies correct color class for In Procurement', () => {
    const status = createStatus({ name: 'In Procurement' });
    render(<StatusBadge status={status} />);

    const badge = screen.getByText('In Procurement');
    expect(badge).toHaveClass('bg-cyan-50', 'text-cyan-800');
  });

  it('applies correct color class for Pending Scheduling', () => {
    const status = createStatus({ name: 'Pending Scheduling' });
    render(<StatusBadge status={status} />);

    const badge = screen.getByText('Pending Scheduling');
    expect(badge).toHaveClass('bg-yellow-50', 'text-yellow-800');
  });

  it('applies correct color class for Scheduled', () => {
    const status = createStatus({ name: 'Scheduled' });
    render(<StatusBadge status={status} />);

    const badge = screen.getByText('Scheduled');
    expect(badge).toHaveClass('bg-orange-50', 'text-orange-800');
  });

  it('applies correct color class for IP', () => {
    const status = createStatus({ name: 'IP' });
    render(<StatusBadge status={status} />);

    const badge = screen.getByText('IP');
    expect(badge).toHaveClass('bg-green-50', 'text-green-800');
  });

  it('applies correct color class for Hold', () => {
    const status = createStatus({ name: 'Hold' });
    render(<StatusBadge status={status} />);

    const badge = screen.getByText('Hold');
    expect(badge).toHaveClass('bg-red-50', 'text-red-800');
  });

  it('applies correct color class for Invoiced', () => {
    const status = createStatus({ name: 'Invoiced' });
    render(<StatusBadge status={status} />);

    const badge = screen.getByText('Invoiced');
    expect(badge).toHaveClass('bg-emerald-50', 'text-emerald-800');
  });

  it('applies default gray color for unknown status', () => {
    const status = createStatus({ name: 'Unknown Status' });
    render(<StatusBadge status={status} />);

    const badge = screen.getByText('Unknown Status');
    expect(badge).toHaveClass('bg-gray-50', 'text-gray-800');
  });

  it('has font-medium class', () => {
    const status = createStatus({ name: 'PO Received' });
    render(<StatusBadge status={status} />);

    const badge = screen.getByText('PO Received');
    expect(badge).toHaveClass('font-medium');
  });
});
