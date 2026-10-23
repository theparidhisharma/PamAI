import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Route } from "@/routes/index";

// The desk is a single route whose five destinations are state-driven sidebar
// buttons; these tests confirm each destination renders its own workspace view.
describe("Pam desk navigation", () => {
  afterEach(cleanup);

  it("switches between the five workspace views from the sidebar", () => {
    const Desk = Route.options.component!;
    render(<Desk />);

    const nav = screen.getByRole("navigation", { name: "Main navigation" });

    // Live desk is the default view.
    expect(screen.getByRole("region", { name: "Case summary" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Live Desk/ })).toHaveAttribute("aria-current", "page");

    fireEvent.click(within(nav).getByRole("button", { name: /Cases/ }));
    expect(screen.getByRole("region", { name: "All cases" })).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: /Policies/ }));
    expect(screen.getByRole("region", { name: "Configured policies" })).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: /Activity/ }));
    expect(screen.getByRole("region", { name: "Recorded activity" })).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: /Settings/ }));
    expect(screen.getByRole("region", { name: "Demo settings" })).toBeInTheDocument();

    fireEvent.click(within(nav).getByRole("button", { name: /Live Desk/ }));
    expect(screen.getByRole("region", { name: "Case summary" })).toBeInTheDocument();
  });

  it("marks the active sidebar item and no others", () => {
    const Desk = Route.options.component!;
    render(<Desk />);

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    fireEvent.click(within(nav).getByRole("button", { name: /Activity/ }));

    expect(within(nav).getByRole("button", { name: /Activity/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("button", { name: /Cases/ })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("button", { name: /Policies/ })).not.toHaveAttribute("aria-current");
  });
});
