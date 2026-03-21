import { test, expect } from "@playwright/test";

function createValidToken() {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      sub: "playwright-user",
      name: "Playwright User",
    })
  ).toString("base64url");

  return `${header}.${payload}.signature`;
}

test.describe("Peer tutoring dashboard", () => {
  test.beforeEach(async ({ page }) => {
    const token = createValidToken();

    await page.addInitScript((accessToken) => {
      window.localStorage.setItem("accessToken", accessToken);
    }, token);

    await page.route("**/api/users/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          firstName: "Playwright",
          lastName: "User",
        }),
      });
    });

    await page.route("**/api/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.route("**/api/groups", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("opens the peer tutoring tab from the dashboard", async ({ page }) => {
    await page.route("**/api/tutoring/classes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Study Groups" })).toBeVisible();
    await page.getByRole("button", { name: "Peer Tutoring" }).click();
    await expect(page.getByText("Select your role above to get started with peer tutoring.")).toBeVisible();
  });

  test("shows tutor dashboard empty state", async ({ page }) => {
    await page.route("**/api/tutoring/classes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Peer Tutoring" }).click();
    await page.getByRole("button", { name: "I'm a Tutor" }).click();

    await expect(page.getByRole("heading", { name: "Tutor Dashboard" })).toBeVisible();
    await expect(page.getByText("No classes yet. Create one to start tutoring!")).toBeVisible();
    await expect(page.getByRole("button", { name: /Create Class/i })).toBeVisible();
  });

  test("shows available classes for tutees and allows search", async ({ page }) => {
    await page.route("**/api/tutoring/classes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 101,
            title: "Math Revision Sprint",
            moduleCode: "MA1521",
            topic: "Calculus",
            tutorName: "Jamie Tan",
            schedule: "Every Friday 3pm",
            mode: "online",
            enrolledCount: 2,
            maxStudents: 6,
            isTutor: false,
            enrolled: false,
          },
          {
            id: 102,
            title: "Physics Clinic",
            moduleCode: "PC1201",
            topic: "Kinematics",
            tutorName: "Morgan Lee",
            schedule: "Tuesday 7pm",
            mode: "online",
            enrolledCount: 1,
            maxStudents: 5,
            isTutor: false,
            enrolled: false,
          },
        ]),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Peer Tutoring" }).click();
    await page.getByRole("button", { name: "I'm a Tutee" }).click();

    await expect(page.getByRole("heading", { name: "Tutee Dashboard" })).toBeVisible();
    await expect(page.getByText("Math Revision Sprint")).toBeVisible();
    await expect(page.getByText("Jamie Tan")).toBeVisible();
    await expect(page.getByRole("button", { name: "Join" }).first()).toBeVisible();

    await page.getByPlaceholder("Search by module, topic, or tutor…").fill("physics");
    await expect(page.getByText("Physics Clinic")).toBeVisible();
    await expect(page.getByText("Math Revision Sprint")).toHaveCount(0);
  });
});
