import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const car = "/inventory/2024-acura-integra-a-spec-technology/1173076";
test.beforeEach(async ({ page }) => {
  // Exercise our wrapper without contacting or submitting to the live credit provider.
  await page.route("https://staging.dealr.website/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html lang='en'><title>Provider fixture</title><main><h1>Provider application fixture</h1></main></html>",
    }),
  );
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = () => Promise.resolve();
    Element.prototype.setPointerCapture = () => {};
  });
});
test("inventory search, empty results, filters, saving and pagination", async ({
  page,
}) => {
  await page.goto("/inventory");
  await expect(page.locator(".vehicle-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page
    .getByRole("searchbox", { name: "Search inventory" })
    .fill("Acura Integra");
  await page.getByRole("button", { name: "Find your car" }).click();
  await expect(page.locator(".vehicle-card")).toHaveCount(1);
  await expect(page.locator(".vehicle-card")).toContainText("23,071");
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove saved vehicle" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("searchbox", { name: "Search inventory" })
    .fill("no-such-car-xyz");
  await page.getByRole("button", { name: "Find your car" }).click();
  await expect(
    page.getByRole("heading", { name: "A little too specific?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByLabel("Body style").selectOption("Truck");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/body=Truck/);
  await expect(page.locator(".vehicle-card")).toHaveCount(12);
});
test("signature drive selector carries its choice into inventory", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Performance/ }).click();
  await expect(
    page.getByRole("button", { name: /Performance/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "View collection" }).click();
  await expect(page).toHaveURL(/mode=performance/);
  await expect(
    page.getByRole("button", { name: /Performance Remove drive style/ }),
  ).toBeVisible();
});
test("vehicle gallery, keyboard dialog and test drive intent work", async ({
  page,
}) => {
  await page.goto(car);
  const hero = page.locator(".gallery-main>img");
  const before = await hero.getAttribute("src");
  await page.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(hero).not.toHaveAttribute("src", before!);
  await page.getByRole("button", { name: "View gallery", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".lightbox-controls")).toContainText("3 / 24");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator(".purchase-panel")
    .getByRole("link", { name: "Request a test drive" })
    .click();
  await expect(page.getByLabel("Preferred date *")).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "Request a test drive", exact: true })
      .first(),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Ask a question", exact: true })
    .click();
  await expect(page.getByLabel("Preferred date *")).toHaveCount(0);
  await page
    .locator(".purchase-panel")
    .getByRole("link", { name: "Request a test drive" })
    .click();
  await expect(page.getByLabel("Preferred date *")).toBeVisible();
});
test("calculator responds to price, down payment, APR and term", async ({
  page,
}) => {
  await page.goto("/financing");
  await page.getByLabel("Vehicle price").fill("12000");
  await page.getByLabel("Down payment").fill("0");
  await page.getByRole("slider", { name: "APR" }).fill("0");
  await expect(page.locator(".payment-result strong")).toHaveText("$200");
  await page.getByLabel("Loan term").selectOption("36");
  await expect(page.locator(".payment-result strong")).toHaveText("$333");
});
test("contact form validates and reports unavailable delivery honestly", async ({
  page,
}) => {
  await page.goto("/contact-us");
  await page.getByLabel("First name *", { exact: true }).fill("Test");
  await page.getByLabel("Last name *", { exact: true }).fill("Driver");
  await page.getByLabel("Email *", { exact: true }).fill("driver@example.com");
  await page.getByLabel("Phone *", { exact: true }).fill("----------");
  await page
    .getByLabel("Your message *")
    .fill("This is a local validation test.");
  await page.getByLabel(/I agree to be contacted/).check();
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByLabel("Phone *", { exact: true })).toHaveJSProperty(
    "validationMessage",
    "Enter a valid phone number",
  );
  await page.getByLabel("Phone *", { exact: true }).fill("8015550123");
  await page.route("**/api/leads", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        message:
          "Online messages are not available yet. Your message has not been sent. Please call or email the team below.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".form-error")).toContainText("has not been sent");
  await expect(page.locator(".form-success")).toHaveCount(0);
});
test("lead endpoint rejects cross-origin and unsupported content without forwarding", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/leads", {
        headers: { Origin: "https://invalid.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/leads", {
        headers: {
          Origin: process.env.TEST_BASE_URL || "http://localhost:3000",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: "firstName=Test",
      })
    ).status(),
  ).toBe(415);
});
test("mobile navigation traps focus, closes, and routes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Expanded navigation" })
    .getByRole("link", { name: "Contact us" })
    .click();
  await expect(page).toHaveURL("/contact-us");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("film plays with sound on request and closes with Escape", async ({
  page,
}) => {
  await page.goto("/");
  expect(await page.locator(".film-dialog video").count()).toBe(0);
  await page.getByRole("button", { name: "Play More than the cars." }).click();
  await expect(page.locator(".film-dialog video")).toHaveAttribute(
    "controls",
    "",
  );
  await expect(page.locator(".film-dialog video")).toHaveJSProperty(
    "paused",
    false,
  );
  await expect(page.locator(".film-dialog video")).toHaveJSProperty(
    "muted",
    false,
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".film-dialog video")).toHaveCount(0);
});
test("story film includes audio and starts playing when opened", async ({
  page,
}) => {
  await page.goto("/our-story");
  await expect(page.locator(".film-dialog video")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Play It starts with people." })
    .click();
  const video = page.locator(".film-dialog video");
  await expect(video).toHaveJSProperty("paused", false);
  await expect(video).toHaveJSProperty("muted", false);
  await expect
    .poll(() =>
      video.evaluate(
        (element: HTMLVideoElement) =>
          (
            element as HTMLVideoElement & {
              webkitAudioDecodedByteCount: number;
            }
          ).webkitAudioDecodedByteCount,
      ),
    )
    .toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(video).toHaveCount(0);
});
test("cinematic hero respects reduced motion and exposes a pause control", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  const background = page.locator(".hero video");
  await expect(background).toHaveJSProperty("paused", true);
  await expect(background).toHaveAttribute("preload", "none");
  await expect(background).toHaveJSProperty("muted", true);
  await page
    .getByRole("button", { name: "Play background film", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause background film" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause background film" }).click();
  await expect(background).toHaveJSProperty("paused", true);
  await page.getByRole("button", { name: /Performance/ }).click();
  await expect(page.locator(".dial-mode")).toHaveText("SPORT");
  expect(
    errors.filter((message) => /hydrat|didn.t match/i.test(message)),
  ).toEqual([]);
});
test("background film pauses when the visitor leaves the hero", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const background = page.locator(".hero video");
  await expect(background).toHaveJSProperty("paused", false);
  await page.locator(".featured-grid").scrollIntoViewIfNeeded();
  await expect(background).toHaveJSProperty("paused", true);
});
test("gold sheen travels with desktop scroll after display fonts load", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const sheen = page.locator(".hero [data-sheen]");
  await page.waitForTimeout(900);
  const initial = await sheen.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--sheen-position"),
  );
  await page.evaluate(() => scrollTo({ top: 280, behavior: "instant" }));
  await expect
    .poll(() =>
      sheen.evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--sheen-position"),
      ),
    )
    .not.toBe(initial);
});
test("core pages pass automated accessibility checks", async ({ page }) => {
  for (const path of [
    "/",
    "/inventory",
    car,
    "/financing",
    "/financing/apply",
    "/financing/terms",
    "/consignment",
    "/sell-your-vehicle",
    "/contact-us",
    "/contact-us/text",
    "/our-story",
  ]) {
    await page.goto(path);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
      path,
    ).toEqual([]);
  }
});

test("gallery chooses a phone-sized source and preloads only the next photo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("dealrimages")) requests.push(request.url());
  });
  await page.goto(car);
  const photo = page.locator(".gallery-main>img");
  await expect(photo).toHaveAttribute("srcset", /750w/);
  await photo.evaluate((img: HTMLImageElement) => img.decode());
  const current = await photo.evaluate(
    (img: HTMLImageElement) => img.currentSrc,
  );
  expect(Number(new URL(current).searchParams.get("w"))).toBeLessThan(1600);
  await expect
    .poll(() =>
      requests.some(
        (url) =>
          url.includes("QMUQ1HOI47XELE") &&
          Number(new URL(url).searchParams.get("w")) >= 360,
      ),
    )
    .toBe(true);
});

test("interior films respect reduced motion and trade photos can be browsed", async ({
  page,
}) => {
  for (const path of [
    "/sell-your-vehicle",
    "/financing",
    "/our-story",
    "/inventory",
    "/contact-us",
  ]) {
    await page.goto(path);
    const film = page.locator(".ambient-film video");
    await expect(film).toHaveJSProperty("paused", true);
    await expect(film).toHaveAttribute("preload", "none");
    await expect(page.locator(".ambient-film")).toBeVisible();
  }
  await page.goto("/sell-your-vehicle");
  const caption = page.locator(".district-carousel-caption p");
  await expect(caption).toHaveText("Every detail matters.");
  await page.getByRole("button", { name: "Next district photo" }).click();
  await expect(caption).toHaveText("Make room for what’s next.");
  await page.getByRole("button", { name: "Previous district photo" }).click();
  await expect(caption).toHaveText("Every detail matters.");
});

test("client priorities are prominent and financing stays on RevDistrict", async ({
  page,
}) => {
  await page.goto("/");
  const priorities = page.locator("#your-next-move");
  await expect(
    priorities.getByRole("link", { name: /consignment/i }),
  ).toHaveAttribute("href", "/consignment");
  await expect(priorities.getByRole("link")).toHaveCount(3);
  await expect(
    priorities.getByRole("link", { name: /Explore inventory/i }),
  ).toHaveAttribute("href", "/inventory");
  await expect(
    priorities.getByRole("link", { name: /Financing/i }),
  ).toHaveAttribute("href", "/financing");
  await expect(page.locator(".hero #your-next-move")).toBeVisible();
  expect(
    await priorities.evaluate(
      (el) =>
        el.compareDocumentPosition(
          document.querySelector("#find-your-drive")!,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ),
  ).toBeTruthy();
  await page.goto("/financing");
  await expect(
    page
      .locator(".finance-copy")
      .getByRole("link", { name: "Start your application" }),
  ).toHaveAttribute("href", "/financing/apply");
  await page.goto(car);
  await expect(
    page.getByRole("link", { name: "Apply for financing" }),
  ).toHaveAttribute("href", "/financing/apply?entry_id=1173076");
  for (const path of [
    "/",
    "/financing",
    "/consignment",
    "/financing/apply",
    "/financing/terms",
    "/contact-us/text",
  ]) {
    await page.goto(path);
    await expect(
      page.locator('a[href*="www.utahusedcarfactory.com"]'),
    ).toHaveCount(0);
  }
});

test("credit application uses the supplied provider iframe without native financial fields", async ({
  page,
}) => {
  const response = await page.goto("/financing/apply?entry_id=1173076");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(
    page.locator('iframe[title="Credit Application"]'),
  ).toHaveAttribute("src", "https://staging.dealr.website/39984");
  await expect(page.locator('input[name*="ssn"]')).toHaveCount(0);
  await expect(page.locator(".credit-application-note")).toContainText(
    "Acura Integra",
  );
  await expect(
    page.getByRole("link", { name: "Open application in a new tab" }),
  ).toHaveAttribute("href", "https://staging.dealr.website/39984");
  expect((await page.request.post("/api/finance", { data: {} })).status()).toBe(
    410,
  );
});

test("consignment and text-back forms use their own lead intents", async ({
  page,
}) => {
  const received: Record<string, unknown>[] = [];
  await page.route("**/api/leads", async (route) => {
    received.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ message: "Synthetic test receipt." }),
    });
  });
  await page.goto("/consignment");
  for (const [name, value] of Object.entries({
    year: "2020",
    make: "Example",
    model: "Car",
    mileage: "40000",
    firstName: "Synthetic",
    lastName: "Test",
    email: "test@example.com",
    phone: "8015550199",
    message: "Please discuss consignment.",
  }))
    await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name="condition"]').selectOption("Good");
  await page.locator('[name="consent"]').check();
  await page
    .getByRole("button", { name: "Request a consignment consultation" })
    .click();
  await expect(page.getByText("Synthetic test receipt.")).toBeVisible();
  expect(received[0].intent).toBe("consignment");
  await page.goto("/contact-us/text");
  await expect(page.locator('[name="email"]')).toHaveCount(0);
  for (const [name, value] of Object.entries({
    firstName: "Synthetic",
    lastName: "Test",
    phone: "8015550199",
    message: "Please text me about the car.",
  }))
    await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name="consent"]').check();
  await page.locator('[name="textConsent"]').check();
  await page.getByRole("button", { name: "Request a text back" }).click();
  await expect(page.getByText("Synthetic test receipt.")).toBeVisible();
  expect(received[1].intent).toBe("text");
  expect(received[1].textConsent).toBe(true);
});

test("new service headings stack above their descriptions on phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, section] of [
    ["/consignment", ".consignment-process"],
    ["/financing", ".finance-options"],
  ]) {
    await page.goto(path);
    await expect(
      page.locator(`${section} .section-heading > div`),
    ).toBeVisible();
    const heading = await page
      .locator(`${section} .section-heading > div`)
      .boundingBox();
    const description = await page
      .locator(`${section} .section-heading > p`)
      .boundingBox();
    expect(heading!.width).toBeGreaterThan(300);
    expect(description!.y).toBeGreaterThanOrEqual(heading!.y + heading!.height);
  }
});

test("make and model checkboxes wait for Search and combine with price and mileage", async ({
  page,
}) => {
  await page.goto("/inventory?page=2");
  const fields = page.locator(".filter-fields");
  await expect(fields.locator(":scope > label, :scope > details")).toHaveText([
    /Max price/,
    /Make/,
    /Model/,
    /Body style/,
    /Max mileage/,
  ]);
  await fields.locator("summary").filter({ hasText: "Make" }).click();
  await page.getByRole("checkbox", { name: "Acura", exact: true }).check();
  await page.getByRole("checkbox", { name: "Audi", exact: true }).check();
  await fields.locator("summary").filter({ hasText: "Model" }).click();
  await page.getByRole("checkbox", { name: "Integra", exact: true }).check();
  await page.getByRole("checkbox", { name: "A6", exact: true }).check();
  await page.getByLabel("Max price").selectOption("40000");
  await page.getByLabel("Max mileage").selectOption("75000");
  await expect(page).toHaveURL(/inventory\?page=2$/);
  await expect(page.locator(".vehicle-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const params = new URL(page.url()).searchParams;
  expect(params.getAll("make")).toEqual(["Acura", "Audi"]);
  expect(params.getAll("model")).toEqual(["A6", "Integra"]);
  expect(params.has("page")).toBe(false);
  await expect(page.locator(".vehicle-card")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".vehicle-card")).toHaveCount(2);
  await fields.locator("summary").filter({ hasText: "Make" }).click();
  await page.getByRole("checkbox", { name: "Acura", exact: true }).uncheck();
  await fields.locator("summary").filter({ hasText: "Model" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Integra", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Find your car" }).click();
  await expect(page.locator(".vehicle-card")).toHaveCount(1);
  await expect(page.locator(".vehicle-card h3")).toHaveText("A6");
  await page.getByLabel("Max mileage").selectOption("25000");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A little too specific?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page).toHaveURL("/inventory");
  await expect(page.locator(".vehicle-card")).toHaveCount(12);
});

test("mobile filters submit all selections and saved vehicles need no account", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory?make=Acura");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.locator("summary").filter({ hasText: "Model" }).click();
  await page.getByRole("checkbox", { name: "Integra", exact: true }).check();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".inventory-filters")).not.toBeVisible();
  await expect(page.locator(".vehicle-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Save vehicle", exact: true }).click();
  await page.goto("/inventory?saved=true");
  await expect(page.locator(".vehicle-card")).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove saved vehicle" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.locator(".saved-help")).toContainText("No account needed");
  await page.getByRole("button", { name: "Remove saved vehicle" }).click();
  await expect(page.locator(".vehicle-card")).toHaveCount(0);
});

test("original District logo needle follows scroll in both directions and respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/our-story");
  const logo = page.locator(".brand-reveal");
  await expect(logo).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const needle = page.locator(".district-logo-needle");
  const top = await logo.evaluate(
    (el) => el.getBoundingClientRect().top + scrollY - innerHeight * 0.65,
  );
  await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), top);
  await page.waitForTimeout(600);
  const first = await needle.evaluate((el) => getComputedStyle(el).transform);
  await page.evaluate(
    (y) => scrollTo({ top: y + 250, behavior: "instant" }),
    top,
  );
  await page.waitForTimeout(600);
  expect(
    await needle.evaluate((el) => getComputedStyle(el).transform),
  ).not.toBe(first);
  await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), top);
  await page.waitForTimeout(600);
  expect(await needle.evaluate((el) => getComputedStyle(el).transform)).toBe(
    first,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(needle).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect(page.locator(".brand img")).toHaveAttribute(
    "src",
    "/images/revdistrict-transparent.png",
  );
});

test("sorting keeps unsubmitted filter selections and Clear selections clears draft text", async ({
  page,
}) => {
  await page.goto("/inventory");
  await page.locator("summary").filter({ hasText: "Make" }).click();
  await page.getByRole("checkbox", { name: "Acura", exact: true }).check();
  await page.getByLabel("Max mileage").selectOption("75000");
  await page.getByLabel("Sort vehicles").selectOption("price-low");
  await expect(
    page.getByRole("checkbox", { name: "Acura", exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("Max mileage")).toHaveValue("75000");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".vehicle-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Clear selections", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "Search inventory" })
    .fill("unsubmitted search");
  await page
    .getByRole("button", { name: "Clear selections", exact: true })
    .click();
  await expect(
    page.getByRole("searchbox", { name: "Search inventory" }),
  ).toHaveValue("");
});

test("inventory and District pages hydrate without motion attribute mismatches", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydrat|didn.t match/i.test(message.text())
    )
      errors.push(message.text());
  });
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    await page.emulateMedia({ reducedMotion });
    for (const path of ["/inventory", "/our-story"]) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
    }
  }
  expect(errors).toEqual([]);
});
