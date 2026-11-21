import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAdminDb } from "../../../../../../tests/helpers/fakeAdminDb";
import { GET } from "./route";

const mock = vi.hoisted(() => ({
  db: null as unknown,
  getUser: vi.fn(),
  partner: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => mock.db }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({ auth: { getUser: mock.getUser } })),
}));
vi.mock("@/lib/accountAccess", () => ({
  getActiveHouseholdPartnerId: mock.partner,
}));

const HOST = "host-user";
const PARTNER = "partner-user";
const STRANGER = "stranger-user";
const HOME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const MISSING = "33333333-3333-4333-8333-333333333333";

let db: ReturnType<typeof fakeAdminDb>;

const request = (query = "") =>
  new NextRequest(`http://localhost/api/guest-portal/admin/orders${query}`);
const signedInAs = (id: string | null) =>
  mock.getUser.mockResolvedValue({ data: { user: id ? { id } : null } });

beforeEach(() => {
  vi.resetAllMocks();
  signedInAs(HOST);
  mock.partner.mockResolvedValue(null);
  db = fakeAdminDb({
    guest_portal_tags: [
      { id: HOME, user_id: HOST, tag_slug: "home", label: "Home", is_active: true },
      { id: OTHER, user_id: STRANGER, tag_slug: "bar", label: "Bar", is_active: true },
    ],
    guest_drinks: [
      { id: "d1", tag_id: HOME, session_id: "s1", guest_name: "Ann", drink_selection: "water" },
      { id: "d2", tag_id: OTHER, session_id: "s9", guest_name: "Zed", drink_selection: "red_wine" },
    ],
    guest_allergies: [
      { id: "a1", tag_id: HOME, session_id: "s1", guest_name: "Ann", allergies: "peanuts" },
      { id: "a2", tag_id: OTHER, session_id: "s9", guest_name: "Zed", allergies: "gluten" },
    ],
  });
  mock.db = db;
});

describe("guest admin orders boundary", () => {
  it("anonymous request gets 401 and no database access", async () => {
    signedInAs(null);
    const response = await GET(request(`?tag_id=${HOME}`));
    expect(response.status).toBe(401);
    expect(db.reads).toEqual([]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejects a malformed tag id before touching the database", async () => {
    expect((await GET(request("?tag_id=not-a-uuid"))).status).toBe(400);
    expect(db.reads).toEqual([]);
  });

  it("host of another tag gets 403 and no guest row is read", async () => {
    const response = await GET(request(`?tag_id=${OTHER}`));
    expect(response.status).toBe(403);
    expect(db.reads).toEqual(["guest_portal_tags"]);
    expect(JSON.stringify(await response.json())).not.toContain("Zed");
  });

  it("unknown tag is 404, not an empty list", async () => {
    expect((await GET(request(`?tag_id=${MISSING}`))).status).toBe(404);
  });

  it("owning host gets only that tag's drinks and allergies", async () => {
    const response = await GET(request(`?tag_id=${HOME}`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tag).toEqual({ id: HOME, slug: "home", label: "Home" });
    expect(body.drinks.map((d: { id: string }) => d.id)).toEqual(["d1"]);
    expect(body.allergies.map((a: { id: string }) => a.id)).toEqual(["a1"]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("active household partner may read the host's tag", async () => {
    signedInAs(PARTNER);
    mock.partner.mockResolvedValue(HOST);
    const response = await GET(request(`?tag_id=${HOME}`));
    expect(response.status).toBe(200);
  });

  it("an unlinked account is refused even though it is signed in", async () => {
    signedInAs(STRANGER);
    expect((await GET(request(`?tag_id=${HOME}`))).status).toBe(403);
  });

  it("without a tag id resolves the caller's own home portal", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).tag.id).toBe(HOME);
  });

  it("without a tag id and with no portal of their own returns 404", async () => {
    signedInAs("no-portal-user");
    expect((await GET(request())).status).toBe(404);
  });
});
