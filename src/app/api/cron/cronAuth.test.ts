import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as chatNotifications from "./chat-notifications/route";
import * as dailyItemsReminder from "./daily-items-reminder/route";
import * as dailyReminder from "./daily-reminder/route";
import * as gcalReconcile from "./gcal-reconcile/route";
import * as itemReminders from "./item-reminders/route";
import * as purgeRecycleBin from "./purge-recycle-bin/route";

// Reaching the service-role client means the auth gate let the call through.
const mock = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: mock.admin }));

type Handler = (req: NextRequest) => Promise<Response>;

type RouteModule = { GET?: Handler; POST?: Handler };

const routes: Array<[string, RouteModule]> = [
  ["chat-notifications", chatNotifications],
  ["daily-items-reminder", dailyItemsReminder],
  ["daily-reminder", dailyReminder],
  ["gcal-reconcile", gcalReconcile],
  ["item-reminders", itemReminders],
  ["purge-recycle-bin", purgeRecycleBin],
];

const call = (handler: Handler, authorization?: string) =>
  handler(
    new NextRequest("http://localhost/api/cron/x", {
      headers: authorization ? { authorization } : {},
    }),
  ).catch(() => null);

const SECRET = "test-cron-secret-0123456789";
const original = process.env.CRON_SECRET;

beforeEach(() => {
  vi.resetAllMocks();
  mock.admin.mockImplementation(() => {
    throw new Error("service-role client reached");
  });
});
afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

describe.each(routes)("cron route %s", (_name, mod) => {
  const handlers = (["GET", "POST"] as const).flatMap((method) => {
    const handler = mod[method];
    return handler ? [[method, handler] as const] : [];
  });

  it.each(handlers)(
    "%s: refuses `Bearer undefined` when CRON_SECRET is unset",
    async (_method, handler) => {
      delete process.env.CRON_SECRET;
      const response = await call(handler, "Bearer undefined");
      expect(response?.status).toBe(401);
      expect(mock.admin).not.toHaveBeenCalled();
    },
  );

  it.each(handlers)(
    "%s: refuses an unauthenticated call when CRON_SECRET is unset",
    async (_method, handler) => {
      delete process.env.CRON_SECRET;
      expect((await call(handler))?.status).toBe(401);
      expect(mock.admin).not.toHaveBeenCalled();
    },
  );

  it.each(handlers)(
    "%s: refuses a wrong or missing secret when one is configured",
    async (_method, handler) => {
      process.env.CRON_SECRET = SECRET;
      for (const header of [undefined, "Bearer wrong", SECRET, "Bearer undefined"]) {
        expect((await call(handler, header))?.status).toBe(401);
      }
      expect(mock.admin).not.toHaveBeenCalled();
    },
  );

  it.each(handlers)(
    "%s: lets the configured secret through to the job",
    async (_method, handler) => {
      process.env.CRON_SECRET = SECRET;
      await call(handler, `Bearer ${SECRET}`);
      expect(mock.admin).toHaveBeenCalled();
    },
  );
});
