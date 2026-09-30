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

import emailRoutes from "./routes/emailRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import trainerRoutes from "./routes/trainerRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import memberAuthRoutes from "./routes/memberAuthRoutes.js";
import membershipRoutes from "./routes/membershipRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import campaignRoutes from "./routes/campaignRoutes.js";
import adminMemberRoutes from "./routes/adminMemberRoutes.js";
import adminPaymentRoutes from "./routes/adminPaymentRoutes.js";
import adminOpsRoutes from "./routes/adminOpsRoutes.js";
import Member from "./models/Member.js";
import { errorHandler, AppError } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { PUBLIC_AVATAR_DIR, LEGACY_MEMBER_DIR } from "./services/storageService.js";
import { runStartupMigrations } from "./migrations/index.js";
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
app.use(express.json({ limit: "1mb" }));
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

const apiRouter = express.Router();
apiRouter.use(apiLimiter);
app.use("/api", apiRouter);

apiRouter.use("/", emailRoutes);
apiRouter.use("/auth", authRoutes);
apiRouter.use("/trainers", trainerRoutes);
apiRouter.use("/products", productRoutes);
apiRouter.use("/plans", planRoutes);
apiRouter.use("/settings", settingsRoutes);
apiRouter.use("/member/auth", memberAuthRoutes);
apiRouter.use("/membership", membershipRoutes);
apiRouter.use("/payments", paymentRoutes);
apiRouter.use("/campaigns", campaignRoutes);
apiRouter.use("/admin/members", adminMemberRoutes);
apiRouter.use("/admin/payments", adminPaymentRoutes);
apiRouter.use("/admin", adminOpsRoutes);
apiRouter.use((req, res, next) => next(new AppError("Endpoint not found", 404, "NOT_FOUND")));


mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    logger.info("MongoDB connected");
    await runStartupMigrations();
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
