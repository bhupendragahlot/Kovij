import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import path from "path";
// import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import morgan from "morgan";
import fs from "fs";
import { fileURLToPath } from "url";

import { mountApiRoutes } from "./routes/index.js";
import Member from "./models/Member.js";
import { errorHandler, AppError } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { activityLog } from "./middleware/activityLog.js";
import { PUBLIC_AVATAR_DIR, LEGACY_MEMBER_DIR } from "./services/storageService.js";
import { runStartupMigrations } from "./migrations/index.js";
import { failAbandonedEmails, reportEmailSetup } from "./services/emailService.js";
import { contentSecurityPolicy } from "./config/csp.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { logger } from "./utils/logger.js";
import { startAllCrons } from "./cron/cronRunner.js";

dotenv.config();

if (!process.env.JWT_SECRET) {
  logger.error("JWT_SECRET is not set; refusing to start.");
  process.exit(1);
}

try {
  const { getAdmin } = await import("./config/firebaseAdmin.js");
  getAdmin();
} catch (e) {
  logger.warn("Firebase Admin optional init skipped", e?.message);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  })
);
// Keep the raw bytes too: payment webhooks verify signatures against the exact body.
app.use(express.json({ limit: "1mb", verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(mongoSanitize());
app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(cookieParser());

// Uploads: profile photos are public; ID proofs are only reachable through the staff API.
fs.mkdirSync(PUBLIC_AVATAR_DIR, { recursive: true });
app.use("/uploads/avatars", express.static(PUBLIC_AVATAR_DIR, { maxAge: "7d" }));
// Legacy folder mixes photos and ID proofs: serve a file only if it is someone's profile photo.
app.get(
  "/uploads/members/:file",
  asyncHandler(async (req, res) => {
    const file = path.basename(req.params.file);
    const isAvatar = await Member.exists({ profilePhoto: `/uploads/members/${file}` });
    if (!isAvatar) throw new AppError("Not found", 404, "NOT_FOUND");
    res.sendFile(path.join(LEGACY_MEMBER_DIR, file));
  })
);
// A missing upload is a 404, not the app's index page.
app.use("/uploads", (req, res) => res.status(404).end());

const apiRouter = express.Router();
apiRouter.use(apiLimiter);
apiRouter.use(activityLog);
app.use("/api", apiRouter);

mountApiRoutes(apiRouter);

apiRouter.use((req, res, next) => next(new AppError("Endpoint not found", 404, "NOT_FOUND")));


mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    logger.info("MongoDB connected");
    await runStartupMigrations();
    reportEmailSetup();
    failAbandonedEmails()
      .then((n) => n && logger.warn(`${n} queued emails were lost in a restart; marked failed`))
      .catch((e) => logger.warn(`Abandoned email check failed: ${e.message}`));
    startAllCrons();
  })
  .catch((error) => logger.error("MongoDB connection error:", error));

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "kovij-fitness-zone", "dist");
// Hashed assets can be cached forever; the service worker and HTML must always revalidate.
app.use(
  express.static(distDir, {
    setHeaders(res, filePath) {
      if (/[\\/]assets[\\/]/.test(filePath)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      else res.setHeader("Cache-Control", "no-cache");
    },
  })
);

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) next(err);
  });
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
