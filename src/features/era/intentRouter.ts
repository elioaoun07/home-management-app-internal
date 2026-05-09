// src/features/era/intentRouter.ts
// Re-exports rootIntentRouter from the new per-face registry.
// stubIntentRouter alias preserved for backward compatibility with any existing imports.

import { rootIntentRouter } from "./intents/index";

export { rootIntentRouter };
export const stubIntentRouter = rootIntentRouter;
