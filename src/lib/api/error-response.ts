/**
 * Return a sanitized error response that doesn't leak internal details.
 */
export function internalError(context: string, error: unknown): Response {
  console.error(`[${context}]`, error);
  return Response.json(
    { error: 'An internal error occurred. Please try again.' },
    { status: 500 }
  );
}
