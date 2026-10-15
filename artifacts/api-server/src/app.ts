import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const corsMethods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const corsHeaders = ["Accept", "Authorization", "Content-Type", "Origin", "Referer", "X-Requested-With"];
function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).origin;
  } catch {
    return null;
  }
}

function expoPreviewOrigin(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeOrigin(value);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    const labels = url.hostname.split(".");
    if (labels.length < 3 || labels[1] === "expo") return null;
    url.hostname = [labels[0], "expo", ...labels.slice(1)].join(".");
    return url.origin;
  } catch {
    return null;
  }
}

const configuredOrigins = new Set(
  [
    process.env.CORS_ALLOWED_ORIGINS,
    process.env.APP_ORIGIN,
    process.env.EXPO_PUBLIC_DOMAIN,
    process.env.REPLIT_DEV_DOMAIN,
    process.env.REPLIT_EXPO_DEV_DOMAIN,
    process.env.REPLIT_DOMAINS,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => Boolean(value))
    .concat(
      [expoPreviewOrigin(process.env.REPLIT_DEV_DOMAIN)]
        .filter((value): value is string => Boolean(value)),
    ),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// CORS only controls browser access: allow headerless native requests, same-host
// requests, and explicitly configured app origins. It is not authentication;
// admin routes remain bearer-token protected in the API router.
app.use(cors((req, callback) => {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  const forwardedHost = req.headers["x-forwarded-host"];
  const requestHost = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)
    ?.split(",")[0]
    ?.trim()
    || req.headers.host
    || "";
  let sameHost = false;
  if (origin && requestHost) {
    try {
      sameHost = new URL(origin).host.toLowerCase() === requestHost.toLowerCase();
    } catch {
      sameHost = false;
    }
  }
  const normalized = origin ? normalizeOrigin(origin) : null;
  callback(null, {
    origin: origin && (sameHost || (normalized && configuredOrigins.has(normalized))) ? origin : false,
    methods: corsMethods,
    allowedHeaders: corsHeaders,
    maxAge: 86400,
  });
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
