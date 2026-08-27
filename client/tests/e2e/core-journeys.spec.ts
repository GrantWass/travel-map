import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("http://localhost:5001/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/trips/deferred-ids") return route.fulfill({ json: { trip_ids: [] } });
    if (path === "/trips/children-batch") return route.fulfill({ json: { children: [] } });
    if (path === "/trips") return route.fulfill({ json: { trips: [] } });
    if (path === "/me") return route.fulfill({ status: 401, json: { error: "unauthenticated" } });
    return route.fulfill({ status: 404, json: { error: "not found" } });
  });
});

test("map renders without a framework error", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
});

test("search state is reflected in a shareable URL", async ({ page }, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button", { name: "Search" }).click();
  }
  const search = page.locator('input[placeholder^="Search trips"]:visible').first();
  await search.fill("Chicago");
  await expect(page).toHaveURL(/q=Chicago/);
});

test("mobile navigation opens search and protects trip creation", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only journey");
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("button", { name: "Search" }).click();
  await expect(page.getByPlaceholder("Search trips, activities, or places")).toBeVisible();
  await navigation.getByRole("button", { name: "Add trip" }).click();
  await expect(page.getByRole("dialog")).toContainText("Create an account to add trips");
});

test("signup and setup routes expose accessible primary forms", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("input[type='email']")).toBeVisible();
  await page.goto("/setup?accountType=traveler");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("unfinished trip drafts survive navigation and reload", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop"), "One browser is sufficient for persistence");
  const user = { user_id: 1, name: "Test Traveler", email: "test@example.com", verified: true, completed_onboarding_tours: [] };
  await page.addInitScript((cachedUser) => {
    window.localStorage.setItem("travel-map.session-user.v1", JSON.stringify(cachedUser));
  }, user);
  await page.route("http://localhost:5001/me", (route) => route.fulfill({ json: { authenticated: true, user } }));
  await page.goto("/trips");
  const title = page.getByLabel("Trip title");
  await title.fill("Weekend in Milwaukee");
  await expect(page.getByRole("status")).toContainText("Draft saved");
  await page.reload();
  await expect(page.getByLabel("Trip title")).toHaveValue("Weekend in Milwaukee");
  await expect(page.getByRole("status")).toContainText(/Draft (saved|restored)/);
});

test("trip query links open the requested trip for authenticated users", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("desktop"), "One browser is sufficient for deep links");
  const user = { user_id: 1, name: "Test Traveler", email: "test@example.com", verified: true, completed_onboarding_tours: [] };
  const trip = {
    trip_id: 50,
    thumbnail_url: "/placeholder-trip.svg",
    title: "Deep Link Trip",
    description: "Opened directly from a shared URL.",
    latitude: 18.4655,
    longitude: -66.1057,
    cost: 367,
    duration: "multiday trip",
    like_count: 0,
    date: "2026-10",
    visibility: "public",
    owner_user_id: 1,
    owner: { ...user, bio: null, college: null, profile_image_url: null, trips: null, initials: "TT" },
    collaborators: [],
    tags: [],
    lodgings: [],
    activities: [],
    comments: [],
  };
  await page.addInitScript((cachedUser) => {
    window.localStorage.setItem("travel-map.session-user.v1", JSON.stringify(cachedUser));
  }, user);
  await page.route("http://localhost:5001/me", (route) => route.fulfill({ json: { authenticated: true, user } }));
  await page.route("http://localhost:5001/trips/50**", (route) => route.fulfill({ json: { trip } }));

  await page.goto("/?trip=50");
  await expect(page).toHaveURL(/trip=50/);
  await expect(page.getByRole("heading", { name: "Deep Link Trip" })).toBeVisible();
});
