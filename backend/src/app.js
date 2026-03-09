import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createRequire } from "module";


import authRoutes from "./routes/authRoutes.js";
import { requireAuth } from "./middleware/authMiddleware.js";
import openapiSpec from "./docs/openapi.js";

import dashboardRoutes from "./routes/dashboardRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import gapRoutes from "./routes/gapRoutes.js";
import recoveryPlanRoutes from "./routes/recoveryPlanRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import youtubeRoutes from "./routes/youtubeRoutes.js";
import assessmentRoutes from "./routes/assessmentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

dotenv.config();
const require = createRequire(import.meta.url);

const app = express();
const swaggerUi = process.env.NODE_ENV === "test" ? null : require("swagger-ui-express");


app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://student-learning-recovery-planner.vercel.app"
    ],
    credentials: true,
  })
);

/* -------------------- middleware -------------------- */
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});


app.use((req, res, next) => {
  req.requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  next();
});

/* -------------------- routes -------------------- */
app.get("/", (req, res) => res.send("API is running"));
if (swaggerUi) {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
}

app.use("/api/auth", authRoutes);

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ message: "Protected success", user: req.user });
});

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/gaps", gapRoutes);
app.use("/api/recovery-plans", recoveryPlanRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/youtube", youtubeRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/notifications", notificationRoutes);

/* -------------------- 404 handler -------------------- */
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
    request_id: req.requestId,
  });
});

/* -------------------- error handler -------------------- */
app.use((err, req, res, next) => {
  const statusCode = Number(err?.statusCode) || 500;
  const payload = {
    ts: new Date().toISOString(),
    level: "error",
    request_id: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status_code: statusCode,
    message: err?.message || "Server error",
  };

  console.error(JSON.stringify(payload));
  res.status(statusCode).json({
    message: statusCode >= 500 ? "Server error" : payload.message,
    request_id: req.requestId,
  });
});

/* -------------------- start -------------------- */
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}

export default app;
