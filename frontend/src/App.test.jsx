import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App routing", () => {
  afterEach(() => {
    localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("redirects root route to login page", async () => {
    render(<App />);
    expect(await screen.findByPlaceholderText("Email")).toBeInTheDocument();
  });
});
