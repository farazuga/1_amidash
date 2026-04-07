// In-memory rate limiter: 10 uploads per hour per portal token
const uploadRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const UPLOAD_RATE_LIMIT = 10;
const UPLOAD_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkUploadRateLimit(token: string): boolean {
  const now = Date.now();
  const entry = uploadRateLimitMap.get(token);

  if (!entry || now > entry.resetTime) {
    uploadRateLimitMap.set(token, { count: 1, resetTime: now + UPLOAD_WINDOW_MS });
    return true;
  }

  if (entry.count >= UPLOAD_RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}
