import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import path from "path";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import morgan from "morgan";
import fs from "fs";
import { fileURLToPath } from "url";

import emailRoutes from "./routes/emailRoutes.js";
import { cookieMiddleware } from "./middleware/cookieMiddleware.js";
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
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { logger } from "./utils/logger.js";
import { startAllCrons } from "./cron/cronRunner.js";

dotenv.config();

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

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
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
app.use(cookieMiddleware);

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadDir));

const apiRouter = express.Router();
apiRouter.use(apiLimiter);

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

app.use("/api", apiRouter);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    logger.info("MongoDB connected");
    startAllCrons();
  })
  .catch((error) => logger.error("MongoDB connection error:", error));

const rootDir = path.resolve(__dirname, "..");
app.use(express.static(path.join(rootDir, "kovij-fitness-zone", "dist")));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const indexFile = path.join(rootDir, "kovij-fitness-zone", "dist", "index.html");
  res.sendFile(indexFile, (err) => {
    if (err) next(err);
  });
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
