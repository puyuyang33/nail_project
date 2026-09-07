import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "./env";

type LimitName =
  "login" | "checkout" | "booking" | "tracking" | "contact" | "wholesale";

const limits: Record<LimitName, { requests: number; window: `${number} m` }> = {
  login: { requests: 8, window: "10 m" },
  checkout: { requests: 10, window: "10 m" },
  booking: { requests: 8, window: "10 m" },
  tracking: { requests: 12, window: "10 m" },
  contact: { requests: 5, window: "10 m" },
  wholesale: { requests: 3, window: "30 m" },
};

const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

if (env.VERCEL_ENV === "production" && !redis) {
  throw new Error(
    "Distributed rate limiting is required in production. Configure Upstash Redis.",
  );
}

const distributed = redis
  ? Object.fromEntries(
      Object.entries(limits).map(([name, value]) => [
        name,
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(value.requests, value.window),
          prefix: `lunaria:${name}`,
        }),
      ]),
    )
  : null;

const localBuckets = new Map<string, { count: number; resetAt: number }>();

export async function enforceRateLimit(
  name: LimitName,
  identifier: string,
): Promise<{ success: boolean; remaining: number; reset: number }> {
  if (distributed) {
    return distributed[name].limit(identifier);
  }

  const now = Date.now();
  const key = `${name}:${identifier}`;
  const config = limits[name];
  const minutes = Number.parseInt(config.window, 10);
  const current = localBuckets.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + minutes * 60_000;
    localBuckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: config.requests - 1, reset: resetAt };
  }
  current.count += 1;
  return {
    success: current.count <= config.requests,
    remaining: Math.max(0, config.requests - current.count),
    reset: current.resetAt,
  };
}

export function getClientIdentifier(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}
