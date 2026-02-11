import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import { requireAuth } from "./middleware/authMiddleware.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import gapRoutes from "./routes/gapRoutes.js";
import recoveryPlanRoutes from "./routes/recoveryPlanRoutes.js";
import progressRoutes from "./routes/progressRoutes.js";



dotenv.config();

const app = express();

// middleware
app.use(express.json());

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
  })
);

// routes
app.get("/", (req, res) => res.send("API is running"));
app.use("/api/auth", authRoutes);

// test protected route
app.get("/api/me", requireAuth, (req, res) => {
  res.json({ message: "Protected success", user: req.user });
});

app.use("/api/dashboard", dashboardRoutes);

app.use("/api/subjects", subjectRoutes);

app.use("/api/tasks", taskRoutes);

app.use("/api/gaps", gapRoutes);

app.use("/api/recovery-plans", recoveryPlanRoutes);

app.use("/api/progress", progressRoutes);



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
