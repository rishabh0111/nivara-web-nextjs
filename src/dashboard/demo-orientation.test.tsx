import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { DEMO_STAFF } from "@/session/demo-credentials";

import { DemoOrientation, ORIENTATION_DISMISSED_KEY } from "./demo-orientation";
import type { StaffPrincipal } from "./staff-principal";

/**
 * The few lines that tell a visitor from the "live demo" link where they are.
 * Shown to the seeded account only, and put down for good with one press.
 */
const demoAdmin: StaffPrincipal = {
  kind: "user",
  userId: "usr_demo",
  tenantId: DEMO_STAFF.credentials.tenantId,
  role: "admin",
  email: DEMO_STAFF.credentials.email,
  name: "Ada Okonjo",
};

afterEach(() => window.localStorage.clear());

describe("the demo orientation", () => {
  it("says who the visitor is, what the list is, and what to try first", () => {
    render(<DemoOrientation principal={demoAdmin} />);

    expect(
      screen.getByRole("heading", { name: /you are ada okonjo, admin at meridian/i }),
    ).toBeVisible();
    expect(screen.getByText(/portal, the website widget and slack/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /ask the widget a question/i })).toHaveAttribute(
      "href",
      "/widget",
    );
    expect(screen.getByRole("link", { name: /raise one as a customer/i })).toHaveAttribute(
      "href",
      "/portal?demo",
    );
    expect(screen.getByRole("link", { name: /read the analytics/i })).toBeVisible();
  });

  it("is not shown to anyone signed in with their own account", () => {
    const { container } = render(
      <DemoOrientation principal={{ ...demoAdmin, email: "someone@elsewhere.test" }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("offers analytics only to a role that can read it", () => {
    render(<DemoOrientation principal={{ ...demoAdmin, role: "agent" }} />);

    expect(screen.queryByRole("link", { name: /read the analytics/i })).not.toBeInTheDocument();
  });

  it("stays dismissed in this browser once put down", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DemoOrientation principal={demoAdmin} />);

    await user.click(screen.getByRole("button", { name: /dismiss this introduction/i }));

    expect(screen.queryByRole("heading", { name: /you are/i })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(ORIENTATION_DISMISSED_KEY)).toBe("1");

    unmount();
    render(<DemoOrientation principal={demoAdmin} />);
    expect(screen.queryByRole("heading", { name: /you are/i })).not.toBeInTheDocument();
  });
});
