// src/features/trips/cascade.ts
//
// Kill switch for the trip activation cascade (activate_trip / complete_trip
// RPCs: skip chores, pause recurring events, cancel one-time events, skip
// meal plans, reassign solo items). Disabled by owner decision 2026-10-05
// until the cascade is verified end-to-end — activation only creates the
// trip expense account. The RPCs and their UI copy stay in place; flip this
// to re-enable. Tracked as TRIP-* in the Trips Master Book.
export const TRIP_CASCADE_ENABLED = false;
