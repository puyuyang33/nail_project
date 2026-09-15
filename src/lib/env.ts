import "server-only";
import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

const schema = z.preprocess(
  (input) => {
    if (!input || typeof input !== "object") {
      return input;
    }
    if ("NOSQL_PROVIDER" in input && input.NOSQL_PROVIDER === "mongodb") {
      return input;
    }
    return {
      ...input,
      MONGODB_URI: undefined,
      MONGODB_DATABASE: undefined,
      NOSQL_EVENT_RETENTION_DAYS: undefined,
    };
  },
  z
    .object({
      NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
      VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
      NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
      DATABASE_URL: optionalUrl,
      DIRECT_URL: optionalUrl,
      DATABASE_URL_UNPOOLED: optionalUrl,
      AUTH_SECRET: z.string().min(32).optional(),
      AUTH_GOOGLE_ID: z.string().min(1).optional(),
      AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
      AUTH_GOOGLE_ADMIN_EMAILS: z.string().default(""),
      AUTH_CREDENTIALS_ENABLED: z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
      AUTH_PASSWORD_REGISTRATION_ENABLED: z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
      APPOINTMENT_NOTIFICATION_EMAILS: z.string().default(""),
      STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
      STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
      CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
      CLOUDINARY_API_KEY: z.string().min(1).optional(),
      CLOUDINARY_API_SECRET: z.string().min(1).optional(),
      RESEND_API_KEY: z.string().startsWith("re_").optional(),
      EMAIL_FROM: z.string().min(3).optional(),
      UPSTASH_REDIS_REST_URL: optionalUrl,
      UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
      CRON_SECRET: z.string().min(32).optional(),
      BUSINESS_TIMEZONE: z.string().default("America/Chicago"),
      STORE_CURRENCY: z.string().length(3).default("USD"),
      APPOINTMENT_DEPOSITS_ENABLED: z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
      NOSQL_PROVIDER: z.enum(["disabled", "mongodb"]).default("disabled"),
      MONGODB_URI: z
        .string()
        .regex(/^mongodb(\+srv)?:\/\//)
        .optional(),
      MONGODB_DATABASE: z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,64}$/)
        .default("lunaria"),
      NOSQL_EVENT_RETENTION_DAYS: z.coerce
        .number()
        .int()
        .min(1)
        .max(3650)
        .default(90),
    })
    .superRefine((value, context) => {
      if (Boolean(value.AUTH_GOOGLE_ID) !== Boolean(value.AUTH_GOOGLE_SECRET)) {
        context.addIssue({
          code: "custom",
          path: ["AUTH_GOOGLE_ID"],
          message:
            "AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must be configured together",
        });
      }
      if (
        value.AUTH_PASSWORD_REGISTRATION_ENABLED &&
        !value.AUTH_CREDENTIALS_ENABLED
      ) {
        context.addIssue({
          code: "custom",
          path: ["AUTH_PASSWORD_REGISTRATION_ENABLED"],
          message:
            "Password registration requires AUTH_CREDENTIALS_ENABLED=true",
        });
      }
      for (const [field, emails] of [
        ["AUTH_GOOGLE_ADMIN_EMAILS", value.AUTH_GOOGLE_ADMIN_EMAILS],
        [
          "APPOINTMENT_NOTIFICATION_EMAILS",
          value.APPOINTMENT_NOTIFICATION_EMAILS,
        ],
      ] as const) {
        const invalid = emails
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean)
          .find((email) => !z.email().safeParse(email).success);
        if (invalid) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: `${field} contains an invalid email address`,
          });
        }
      }
      if (value.NOSQL_PROVIDER === "mongodb" && !value.MONGODB_URI) {
        context.addIssue({
          code: "custom",
          path: ["MONGODB_URI"],
          message: "MONGODB_URI is required when NOSQL_PROVIDER=mongodb",
        });
      }
    }),
);

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration: ${parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")}`,
  );
}

export const env = parsed.data;

export const serviceReadiness = {
  database: Boolean(env.DATABASE_URL),
  auth: Boolean(
    env.AUTH_SECRET &&
    env.DATABASE_URL &&
    ((env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) ||
      env.AUTH_CREDENTIALS_ENABLED),
  ),
  googleAuth: Boolean(
    env.AUTH_SECRET &&
    env.DATABASE_URL &&
    env.AUTH_GOOGLE_ID &&
    env.AUTH_GOOGLE_SECRET,
  ),
  stripe: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
  cloudinary: Boolean(
    env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET,
  ),
  email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
  distributedRateLimit: Boolean(
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN,
  ),
  documentStore: env.NOSQL_PROVIDER === "mongodb" && Boolean(env.MONGODB_URI),
} as const;
