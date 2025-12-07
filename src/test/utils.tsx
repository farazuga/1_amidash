import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

// Custom render options type
type CustomRenderOptions = Omit<RenderOptions, 'wrapper'>;

function AllProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function customRender(ui: ReactElement, options?: CustomRenderOptions) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render with custom render
export { customRender as render };
