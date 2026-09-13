// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { UserProfile } from "@/types";

const navigation = vi.hoisted(() => ({ pathname: "/admin" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

import AdminShell from "@/components/admin/AdminShell";

afterEach(() => cleanup());

const user = (globalRole: UserProfile["globalRole"]): UserProfile => ({
  id: `user-${globalRole}`,
  username: globalRole.toLowerCase(),
  email: `${globalRole.toLowerCase()}@example.test`,
  fullName: globalRole,
  globalRole,
  isActive: true,
  mustChangePassword: false,
  createdAt: "2026-09-13T00:00:00.000Z",
  updatedAt: "2026-09-13T00:00:00.000Z",
});

describe("P6 Dashboard shell", () => {
  it.each(["GOD", "TENANT_USER"] as const)("hides left navigation on the Dashboard for %s", (role) => {
    navigation.pathname = "/admin";
    const { container } = render(<AdminShell user={user(role)}><p>Dashboard content</p></AdminShell>);
    expect(container.querySelector("#admin-sidebar")).toBeNull();
    expect(screen.queryByRole("button", { name: "เปิดเมนู" })).toBeNull();
    expect(screen.getByText("Dashboard content")).toBeTruthy();
  });

  it("keeps navigation available on management screens", () => {
    navigation.pathname = "/admin/apps";
    const { container } = render(<AdminShell user={user("GOD")}><p>Apps content</p></AdminShell>);
    expect(container.querySelector("#admin-sidebar")).not.toBeNull();
    expect(screen.getByRole("button", { name: "เปิดเมนู" })).toBeTruthy();
  });
});
