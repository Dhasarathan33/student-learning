import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProtectedRoute from "./components/ProtectedRoute";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Subjects = lazy(() => import("./pages/Subjects"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Gaps = lazy(() => import("./pages/Gaps"));
const RecoveryPlans = lazy(() => import("./pages/RecoveryPlans"));
const Progress = lazy(() => import("./pages/Progress"));
const LearningConcepts = lazy(() => import("./pages/LearningConcepts"));
const Assessment = lazy(() => import("./pages/Assessment"));
const Settings = lazy(() => import("./pages/Settings"));
const Notifications = lazy(() => import("./pages/Notifications"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="page"><div className="emptyState">Loading...</div></div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/subjects"
            element={
              <ProtectedRoute>
                <Subjects />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            }
          />

          <Route
            path="/gaps"
            element={
              <ProtectedRoute>
                <Gaps />
              </ProtectedRoute>
            }
          />

          <Route
            path="/learning-concepts"
            element={
              <ProtectedRoute>
                <LearningConcepts />
              </ProtectedRoute>
            }
          />

          <Route
            path="/recovery-plans"
            element={
              <ProtectedRoute>
                <RecoveryPlans />
              </ProtectedRoute>
            }
          />

          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <Progress />
              </ProtectedRoute>
            }
          />

          <Route
            path="/assessment"
            element={
              <ProtectedRoute>
                <Assessment />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
