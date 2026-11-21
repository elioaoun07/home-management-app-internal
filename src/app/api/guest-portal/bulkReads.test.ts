import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAdminDb } from "../../../../tests/helpers/fakeAdminDb";
import { GET as getAllergies } from "./allergies/route";
import { GET as getDrinks } from "./drinks/route";

const mock = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => mock.db }));

const TAG = "11111111-1111-4111-8111-111111111111";
const OTHER_TAG = "22222222-2222-4222-8222-222222222222";

let db: ReturnType<typeof fakeAdminDb>;

beforeEach(() => {
  db = fakeAdminDb({
    guest_allergies: [
      { id: "a1", tag_id: TAG, session_id: "s1", guest_name: "Ann", allergies: "peanuts" },
      { id: "a2", tag_id: TAG, session_id: "s2", guest_name: "Bob", allergies: "shellfish" },
      { id: "a3", tag_id: OTHER_TAG, session_id: "s3", guest_name: "Cy", allergies: "gluten" },
    ],
    guest_drinks: [
      { id: "d1", tag_id: TAG, session_id: "s1", guest_name: "Ann", drink_selection: "water" },
      { id: "d2", tag_id: TAG, session_id: "s2", guest_name: "Bob", drink_selection: "red_wine" },
    ],
  });
  mock.db = db;
});

const request = (path: string, query: string) =>
  new NextRequest(`http://localhost/api/guest-portal/${path}${query}`);

describe.each([
  { name: "allergies", get: getAllergies, key: "allergies", one: "allergy", table: "guest_allergies" },
  { name: "drinks", get: getDrinks, key: "drinks", one: "drink", table: "guest_drinks" },
])("public $name route", ({ name, get, key, one, table }) => {
  it("no longer lists every guest's rows for a tag id, signed in or not", async () => {
    const response = await get(request(name, `?tag_id=${TAG}&all=true`));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).not.toHaveProperty(key);
    expect(db.reads).not.toContain(table);
  });

  it("ignores `all` when a session is given and returns only that session's row", async () => {
    const response = await get(request(name, `?tag_id=${TAG}&all=true&session_id=s2`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).not.toHaveProperty(key);
    expect(body[one]).toMatchObject({ session_id: "s2", guest_name: "Bob" });
  });

  it("still returns the caller's own row by session id", async () => {
    const response = await get(request(name, "?session_id=s1"));
    expect((await response.json())[one]).toMatchObject({ session_id: "s1" });
  });
});
