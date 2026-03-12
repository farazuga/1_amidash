/**
 * Shows an environment indicator banner on non-production Railway deployments.
 * Railway sets RAILWAY_ENVIRONMENT_NAME automatically per environment.
 * Hidden on "production" / main — only shows on "develop", PR previews, etc.
 */
export function EnvironmentBanner() {
  const env = process.env.RAILWAY_ENVIRONMENT_NAME;

  // Hide on production (main) or when not on Railway (local dev)
  if (!env || env.toLowerCase() === 'production') {
    return null;
  }

  const isPR = env.toLowerCase().startsWith('pr-') || env.toLowerCase().includes('preview');
  const label = isPR ? `PR Preview` : env;
  const bgColor = isPR
    ? 'bg-purple-600'
    : 'bg-amber-500';

  return (
    <div
      className={`${bgColor} text-white text-center text-xs font-medium py-1 px-2 z-50 relative`}
    >
      {label}
    </div>
  );
}
