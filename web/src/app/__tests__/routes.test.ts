import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn()
}));

import AppPage from "../app/page";
import LandingPage from "../page";
import { redirect } from "next/navigation";

describe("demo routes", () => {
  it("redirects /app to /live", () => {
    AppPage();

    expect(redirect).toHaveBeenCalledWith("/live");
  });

  it("renders the landing route with demo CTAs pointing to /live", () => {
    const html = renderToStaticMarkup(createElement(LandingPage));

    expect(html).toContain("class=\"hero");
    expect(html).toContain("class=\"final-cta");
    expect(html).toContain("href=\"/live\"");
    expect(html).not.toContain("href=\"/app\"");
  });
});
