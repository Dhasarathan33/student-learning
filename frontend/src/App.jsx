import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Subjects from "./pages/Subjects";
import Tasks from "./pages/Tasks";
import Gaps from "./pages/Gaps";
import RecoveryPlans from "./pages/RecoveryPlans";
import Progress from "./pages/Progress"; // ✅ NEW LINE ADDED

export default function App() {
  return (
    <BrowserRouter>
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
          path="/recovery-plans"
          element={
            <ProtectedRoute>
              <RecoveryPlans />
            </ProtectedRoute>
          }
        />

        {/* ✅ NEW: Progress Tracking */}
        <Route
          path="/progress"
          element={
            <ProtectedRoute>
              <Progress />
            </ProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}
