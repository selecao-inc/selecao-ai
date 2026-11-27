// @vitest-environment node
import { expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { chromium } from "@playwright/test";
import { installBypass } from "@/tests/scenarios/preview.mts";

async function listen(server: Server): Promise<string> {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server failed");
  return `http://127.0.0.1:${address.port}`;
}

it("実ブラウザの cross-origin redirect に bypass を引き継がない", async () => {
  const seen: (string | string[] | undefined)[] = [];
  const outside = createServer((req, res) => {
    seen.push(req.headers["x-vercel-protection-bypass"]);
    res.end("outside");
  });
  const outsideOrigin = await listen(outside);
  const inside = createServer((req, res) => {
    seen.push(req.headers["x-vercel-protection-bypass"]);
    res.writeHead(302, { location: `${outsideOrigin}/landing` });
    res.end();
  });
  const origin = await listen(inside);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await installBypass(context, origin, "fixture-secret");
    const page = await context.newPage();
    await page.goto(origin);
    expect(page.url()).toBe(`${outsideOrigin}/landing`);
    expect(seen[0]).toBe("fixture-secret");
    expect(seen.slice(1).every((v) => v === undefined)).toBe(true);
  } finally {
    await browser.close();
    await Promise.all([inside, outside].map((s) => new Promise<void>((done) => s.close(() => done()))));
  }
}, 30_000);
