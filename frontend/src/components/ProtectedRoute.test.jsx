import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

function renderProtected(initialPath = "/private") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/private"
          element={
            <ProtectedRoute>
              <div>Private Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login Screen</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("renders protected content when token exists", () => {
    localStorage.setItem("token", "fake-token");
    renderProtected();
    expect(screen.getByText("Private Content")).toBeInTheDocument();
  });

  it("redirects to login when token is missing", () => {
    renderProtected();
    expect(screen.getByText("Login Screen")).toBeInTheDocument();
  });
});
