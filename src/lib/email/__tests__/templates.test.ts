import { describe, it, expect } from 'vitest';
import { statusChangeEmail, welcomeEmail } from '../templates';

describe('statusChangeEmail', () => {
  it('generates email with required fields', () => {
    const html = statusChangeEmail({
      clientName: 'Test Client',
      newStatus: 'In Production',
      portalUrl: 'https://app.example.com/status/token123',
    });

    expect(html).toContain('Project Status Update');
    expect(html).toContain('Test Client');
    expect(html).toContain('In Production');
    expect(html).toContain('https://app.example.com/status/token123');
    expect(html).toContain('View Project Status');
  });

  it('includes previous status when provided', () => {
    const html = statusChangeEmail({
      clientName: 'Test Client',
      newStatus: 'In Production',
      previousStatus: 'Order Entry',
      portalUrl: 'https://app.example.com/status/token123',
    });

    expect(html).toContain('Previous status:');
    expect(html).toContain('Order Entry');
  });

  it('excludes previous status section when not provided', () => {
    const html = statusChangeEmail({
      clientName: 'Test Client',
      newStatus: 'In Production',
      portalUrl: 'https://app.example.com/status/token123',
    });

    expect(html).not.toContain('Previous status:');
  });

  it('includes note when provided', () => {
    const html = statusChangeEmail({
      clientName: 'Test Client',
      newStatus: 'In Production',
      portalUrl: 'https://app.example.com/status/token123',
      note: 'Production started, expected completion in 2 weeks',
    });

    expect(html).toContain('Production started, expected completion in 2 weeks');
  });

  it('excludes note section when not provided', () => {
    const html = statusChangeEmail({
      clientName: 'Test Client',
      newStatus: 'In Production',
      portalUrl: 'https://app.example.com/status/token123',
    });

    // Note section uses a specific background color
    const noteSection = html.includes('font-style: italic');
    expect(noteSection).toBe(false);
  });

  it('includes preview text in HTML', () => {
    const html = statusChangeEmail({
      clientName: 'Test Client',
      newStatus: 'Shipped',
      portalUrl: 'https://app.example.com/status/token123',
    });

    expect(html).toContain('Test Client status updated to Shipped');
  });

  it('includes brand colors', () => {
    const html = statusChangeEmail({
      clientName: 'Test Client',
      newStatus: 'In Production',
      portalUrl: 'https://app.example.com/status/token123',
    });

    expect(html).toContain('#023A2D');
  });

  it('includes logo URL', () => {
    const html = statusChangeEmail({
      clientName: 'Test Client',
      newStatus: 'In Production',
      portalUrl: 'https://app.example.com/status/token123',
    });

    expect(html).toContain('https://www.amitrace.com/Logo_TwoTone.png');
  });

  it('includes support contact info', () => {
    const html = statusChangeEmail({
      clientName: 'Test Client',
      newStatus: 'In Production',
      portalUrl: 'https://app.example.com/status/token123',
    });

    expect(html).toContain('support@amitrace.com');
  });
});

describe('welcomeEmail', () => {
  it('generates email with all required fields', () => {
    const html = welcomeEmail({
      clientName: 'Test Client',
      pocName: 'John Doe',
      projectType: 'Furniture',
      initialStatus: 'Order Entry',
      portalUrl: 'https://app.example.com/status/token123',
    });

    expect(html).toContain('Welcome to Amitrace!');
    expect(html).toContain('Hi John Doe');
    expect(html).toContain('Test Client');
    expect(html).toContain('Furniture');
    expect(html).toContain('Order Entry');
    expect(html).toContain('https://app.example.com/status/token123');
    expect(html).toContain('View Project Portal');
  });

  it('includes project details table', () => {
    const html = welcomeEmail({
      clientName: 'Test Client',
      pocName: 'John Doe',
      projectType: 'Furniture',
      initialStatus: 'Order Entry',
      portalUrl: 'https://app.example.com/status/token123',
    });

    expect(html).toContain('Project Type:');
    expect(html).toContain('Current Status:');
  });

  it('includes preview text in HTML', () => {
    const html = welcomeEmail({
      clientName: 'My Project',
      pocName: 'Jane',
      projectType: 'Test',
      initialStatus: 'New',
      portalUrl: 'https://example.com/status/xyz',
    });

    expect(html).toContain('Your project My Project is now being tracked');
  });

  it('includes footer with copyright year', () => {
    const html = welcomeEmail({
      clientName: 'Test Client',
      pocName: 'John',
      projectType: 'Test',
      initialStatus: 'New',
      portalUrl: 'https://example.com/status/xyz',
    });

    const currentYear = new Date().getFullYear().toString();
    expect(html).toContain(currentYear);
    expect(html).toContain('Amitrace. All rights reserved');
  });

  it('includes brand colors and styling', () => {
    const html = welcomeEmail({
      clientName: 'Test Client',
      pocName: 'John',
      projectType: 'Test',
      initialStatus: 'New',
      portalUrl: 'https://example.com/status/xyz',
    });

    expect(html).toContain('#023A2D');
    expect(html).toContain('background-color');
    expect(html).toContain('border-radius');
  });

  it('includes proper HTML structure', () => {
    const html = welcomeEmail({
      clientName: 'Test Client',
      pocName: 'John',
      projectType: 'Test',
      initialStatus: 'New',
      portalUrl: 'https://example.com/status/xyz',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html>');
    expect(html).toContain('</html>');
    expect(html).toContain('<head>');
    expect(html).toContain('<body');
  });

  it('includes responsive meta viewport', () => {
    const html = welcomeEmail({
      clientName: 'Test Client',
      pocName: 'John',
      projectType: 'Test',
      initialStatus: 'New',
      portalUrl: 'https://example.com/status/xyz',
    });

    expect(html).toContain('viewport');
    expect(html).toContain('width=device-width');
  });
});
