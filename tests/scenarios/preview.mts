import { test as base, expect, type BrowserContext } from "@playwright/test";
import { deploymentOrigin } from "../../.github/scripts/scenario-runner.mts";

export function bypassHeaders(url: string, origin: string, headers: Record<string, string>, secret: string) {
  const safe = Object.fromEntries(Object.entries(headers).filter(([name]) =>
    name.toLowerCase() !== "x-vercel-protection-bypass"));
  if (new URL(url).origin === origin) safe["x-vercel-protection-bypass"] = secret;
  return safe;
}

export async function installBypass(context: BrowserContext, origin: string, secret: string) {
  // route.continue の headers は redirect にも引き継がれるため使わない。
  // redirect を一段で止めて fulfill し、次の URL も改めて origin で判定する。
  await context.route("**/*", async (route) => {
    const response = await route.fetch({
      headers: bypassHeaders(route.request().url(), origin, route.request().headers(), secret),
      maxRedirects: 0,
    });
    await route.fulfill({ response });
  });
}

export const test = base.extend<{ scenarioProtection: void }>({
  // auto fixture にして、page/context を明示的に使わないテストでも保護を設定する。
  scenarioProtection: [async ({ context }, provide, info) => {
    const origin = deploymentOrigin(process.env.PREVIEW_ORIGIN!);
    const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (!secret) throw new Error("bypass secret が未登録です");
    await installBypass(context, origin, secret);
    info.annotations.push({ type: "scenario:protected-context" });
    await provide();
  }, { auto: true }],
});
export { expect };
