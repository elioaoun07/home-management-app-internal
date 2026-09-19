// The Command Center views, mounted by whichever shell owns the page: the local
// Node server (main.tsx) or the phone relay route (/pm/live). The shell sets the
// transport before mounting; the views never know which one they have.
import { App } from "./App";
import { Providers } from "./state";

export function CommandCenter() {
  return (
    <Providers>
      <App />
    </Providers>
  );
}
