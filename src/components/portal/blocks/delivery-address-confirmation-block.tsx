'use client';

import { useState } from 'react';
import type { DeliveryAddressConfirmation } from '@/types';

interface DeliveryAddressConfirmationBlockProps {
  project: {
    delivery_street: string | null;
    delivery_city: string | null;
    delivery_state: string | null;
    delivery_zip: string | null;
    delivery_country: string | null;
  };
  token: string;
  confirmation: DeliveryAddressConfirmation | null;
}

export function DeliveryAddressConfirmationBlock({
  project,
  token,
  confirmation,
}: DeliveryAddressConfirmationBlockProps) {
  const [email, setEmail] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<DeliveryAddressConfirmation | null>(confirmation);

  // No address available
  if (!project.delivery_street) {
    return (
      <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-white">
        <h3 className="text-lg font-semibold text-[#023A2D] mb-3">Delivery Address</h3>
        <p className="text-sm text-gray-500">Delivery address not yet available.</p>
      </div>
    );
  }

  // Already confirmed
  if (confirmed) {
    const confirmedDate = new Date(confirmed.confirmed_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return (
      <div className="mb-6 border border-green-200 rounded-lg p-4 bg-green-50">
        <h3 className="text-lg font-semibold text-[#023A2D] mb-3">Delivery Address</h3>
        <div className="flex items-center gap-2 mb-3">
          <svg
            className="w-5 h-5 text-green-600 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm font-medium text-green-700">
            Address confirmed on {confirmedDate}
          </span>
        </div>
        <div className="text-sm text-gray-700 mb-3">
          <p>{project.delivery_street}</p>
          <p>
            {[project.delivery_city, project.delivery_state, project.delivery_zip]
              .filter(Boolean)
              .join(', ')}
          </p>
          {project.delivery_country && <p>{project.delivery_country}</p>}
        </div>
        <p className="text-xs text-gray-500">
          If this address is incorrect, please contact{' '}
          <a href="mailto:jason@amitrace.com" className="text-[#023A2D] hover:underline">
            jason@amitrace.com
          </a>
        </p>
      </div>
    );
  }

  // Not confirmed — show address + email input
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setConfirming(true);
    setError(null);

    try {
      const res = await fetch('/api/portal/confirm-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: email.trim() }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error || 'Failed to confirm address');
        return;
      }

      // Success — show confirmed state
      setConfirmed({
        id: 'confirmed',
        project_id: '',
        confirmed_by_email: email.trim().toLowerCase(),
        address_snapshot: {
          street: project.delivery_street || '',
          city: project.delivery_city || '',
          state: project.delivery_state || '',
          zip: project.delivery_zip || '',
          country: project.delivery_country || '',
        },
        confirmed_at: new Date().toISOString(),
      });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-white">
      <h3 className="text-lg font-semibold text-[#023A2D] mb-3">Delivery Address</h3>
      <div className="text-sm text-gray-700 mb-4">
        <p>{project.delivery_street}</p>
        <p>
          {[project.delivery_city, project.delivery_state, project.delivery_zip]
            .filter(Boolean)
            .join(', ')}
        </p>
        {project.delivery_country && <p>{project.delivery_country}</p>}
      </div>

      <form onSubmit={handleSubmit}>
        <label htmlFor="confirm-email" className="block text-sm font-medium text-gray-700 mb-1">
          Enter your email to confirm this address
        </label>
        <div className="flex gap-2">
          <input
            id="confirm-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={confirming}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#023A2D] focus:border-transparent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={confirming || !email.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-[#023A2D] px-4 py-2 text-sm font-medium text-white hover:bg-[#034d3b] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {confirming && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {confirming ? 'Confirming...' : 'Confirm Address'}
          </button>
        </div>

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </form>
    </div>
  );
}
