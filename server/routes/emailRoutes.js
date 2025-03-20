// src/routes/emailRoutes.js
import express from "express";
import { sendEmail } from "../controllers/emailController.js";
import { cacheMiddleware } from "../middleware/cacheMiddleware.js";

const router = express.Router();

// Apply cacheMiddleware if you want to cache responses for this route.
// For POST requests caching might be less common, but you can adjust as needed.
router.post("/send-email", cacheMiddleware, sendEmail);

export default router;
