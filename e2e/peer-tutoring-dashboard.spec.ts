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

  test("allows a tutor to create a tutoring class", async ({ page }) => {
    await page.route("**/api/tutoring/classes", async (route, request) => {
      if (request.method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: 999,
            title: "New AI Tutoring",
            moduleCode: "CS3243",
            topic: "Search Algorithms",
            mode: "online",
            maxStudents: 5,
            schedule: "Monday 10am",
            isTutor: true
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Peer Tutoring" }).click();
    await page.getByRole("button", { name: "I'm a Tutor" }).click();

    await page.locator(".dashCreateBtn").click();
    await page.getByLabel(/Class Title \*/i).fill("New AI Tutoring");
    await page.getByLabel(/Module Code \*/i).fill("CS3243");
    await page.getByLabel(/Topic/i).fill("Search Algorithms");
    await page.getByLabel(/Schedule \*/i).fill("Monday 10am");
    await page.getByLabel(/Meeting Link \*/i).fill("https://zoom.us/j/123");

    await page.locator(".modalSubmit").click();

    await expect(page.getByText("New AI Tutoring")).toBeVisible();
    await expect(page.getByText("CS3243")).toBeVisible();
  });

  test("allows a tutee to join and leave a class", async ({ page }) => {
    await page.route("**/api/tutoring/classes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: 201,
          title: "Operating Systems Help",
          moduleCode: "CS2106",
          schedule: "Wednesday 2pm",
          mode: "online",
          enrolledCount: 1,
          maxStudents: 5,
          isTutor: false,
          enrolled: false,
        }]),
      });
    });

    await page.route("**/api/tutoring/classes/201/enroll", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });
    await page.route("**/api/tutoring/classes/201/leave", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Peer Tutoring" }).click();
    await page.getByRole("button", { name: "I'm a Tutee" }).click();

    const joinBtn = page.getByRole("button", { name: "Join" });
    await expect(joinBtn).toBeVisible();
    await joinBtn.click();

    const leaveBtn = page.getByRole("button", { name: "Leave" });
    await expect(leaveBtn).toBeVisible();
    await leaveBtn.click();

    await expect(page.getByRole("button", { name: "Join" })).toBeVisible();
  });

  test("allows a tutee to submit feedback for an enrolled class", async ({ page }) => {
    await page.route("**/api/tutoring/classes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: 301,
          title: "Database Systems",
          moduleCode: "CS2102",
          tutorName: "Alice Tan",
          tutorId: "user-1",
          schedule: "Thursday 4pm",
          mode: "online",
          enrolledCount: 2,
          maxStudents: 5,
          isTutor: false,
          enrolled: true,
        }]),
      });
    });

    let feedbackPayload: any;
    await page.route("**/api/tutoring/classes/301/feedback", async (route, request) => {
      if (request.method() === "POST") {
        feedbackPayload = request.postDataJSON();
        await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      } else {
        await route.fulfill({ status: 200, body: "[]" });
      }
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Peer Tutoring" }).click();
    await page.getByRole("button", { name: "I'm a Tutee" }).click();

    await page.getByRole("button", { name: "Feedback" }).click();
    await expect(page.getByRole("heading", { name: /Peer Feedback/ })).toBeVisible();

    await page.getByRole("group", { name: "Overall Rating" }).getByRole("button", { name: "Rate 5 stars" }).click();
    await page.getByRole("group", { name: "Preparedness" }).getByRole("button", { name: "Rate 4 stars" }).click();
    await page.getByLabel(/Strengths/i).fill("Very clear explanations.");
    await page.getByLabel(/Areas for Improvement/i).fill("None really.");

    await page.getByRole("button", { name: "Submit Feedback" }).click();

    await expect(page.getByText("Feedback submitted successfully")).toBeVisible();
    expect(feedbackPayload).toMatchObject({
      revieweeId: "user-1",
      overallRating: 5,
      preparedness: 4,
      strengths: "Very clear explanations.",
      improvements: "None really."
    });
  });

  test("allows a tutor to view submitted feedbacks", async ({ page }) => {
    await page.route("**/api/tutoring/classes", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: 401,
          title: "Networks Clinic",
          moduleCode: "CS3103",
          mode: "online",
          enrolledCount: 3,
          maxStudents: 5,
          isTutor: true,
        }]),
      });
    });

    await page.route("**/api/tutoring/classes/401/feedback", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: "f1",
          reviewerName: "Bob Lee",
          overallRating: 5,
          preparedness: 5,
          communication: 4,
          helpfulness: 5,
          reliability: 5,
          strengths: "Great examples.",
          improvements: "Could be longer.",
          submittedAt: "2026-01-01T10:00:00Z"
        }]),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Peer Tutoring" }).click();
    await page.getByRole("button", { name: "I'm a Tutor" }).click();

    await page.getByRole("button", { name: "View Feedbacks" }).click();
    await expect(page.getByRole("heading", { name: /Submitted Feedbacks/ })).toBeVisible();

    await page.getByRole("list", { name: "Submitted feedback names" }).getByRole("button", { name: /Bob Lee/i }).click();

    await expect(page.locator(".tutorFeedbackDetail").getByText("Great examples.")).toBeVisible();
    await expect(page.locator(".tutorFeedbackDetail").getByText("Could be longer.")).toBeVisible();
  });
});
