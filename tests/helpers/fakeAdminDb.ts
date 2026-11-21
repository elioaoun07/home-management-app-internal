// Minimal in-memory stand-in for the Supabase service-role client, for route
// tests that need real row scoping (eq / in filters) rather than call spies.
type Row = Record<string, unknown>;

export function fakeAdminDb(tables: Record<string, Row[]>) {
  const reads: string[] = [];
  return {
    reads,
    from(table: string) {
      reads.push(table);
      let rows = [...(tables[table] ?? [])];
      const query = {
        select: () => query,
        order: () => query,
        limit: () => query,
        eq: (column: string, value: unknown) => {
          rows = rows.filter((row) => row[column] === value);
          return query;
        },
        in: (column: string, values: unknown[]) => {
          rows = rows.filter((row) => values.includes(row[column]));
          return query;
        },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then: (
          resolve: (value: { data: Row[]; error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
      };
      return query;
    },
  };
}
