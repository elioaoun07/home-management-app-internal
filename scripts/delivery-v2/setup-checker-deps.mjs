// DLV-133 trusted setup: inspect a recipe first; explicitly prepare a separate
// Linux dependency environment. recipe.policyFile names the proposed policy;
// its command/input/assertion contract is checked before any Docker call.
// Never replace the installed dependency volume.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDockerCli } from "./worker-boundary.mjs";
import { planCheckerEnvironment, stageCheckerEnvironment, stageCheckerPackageDiagnostic } from "./stage-checker-environment.mjs";

/** @param {{recipe?:import('./stage-checker-environment.mjs').CheckerEnvironmentRecipe,
 * expectedKey?:string,docker?:ReturnType<typeof createDockerCli>}} input */
export async function provisionCheckerDependencies({ recipe, expectedKey, docker = createDockerCli() } = {}) {
  if (!recipe) throw new Error("An explicit reviewed recipe is required; legacy host-package copying is disabled.");
  const plan = planCheckerEnvironment(recipe);
  if (expectedKey !== plan.spec.key) throw new Error("Preparation requires the exact reviewed --expected-key from --plan.");
  return stageCheckerEnvironment({ recipe, docker });
}

export async function diagnoseCheckerPackages({ recipe, expectedKey, packages, docker = createDockerCli() }) {
  const plan = planCheckerEnvironment(recipe);
  if (expectedKey !== plan.spec.key) throw new Error("Diagnostic requires the exact reviewed --expected-key from --plan.");
  return stageCheckerPackageDiagnostic({ recipe, docker, packages });
}

function argument(name) {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const path = argument("--recipe");
    if (!path) throw new Error("Use --recipe <file> --plan; after reviewing it, --prepare --expected-key <sha256:key>. No policy is installed by this command.");
    const recipe = JSON.parse(readFileSync(path, "utf8"));
    const diagnostic = argument("--diagnose-packages");
    if (diagnostic && process.argv.includes("--prepare")) throw new Error("choose diagnostic or full preparation, not both");
    const result = diagnostic
      ? await diagnoseCheckerPackages({ recipe, expectedKey: argument("--expected-key"), packages: JSON.parse(diagnostic) })
      : process.argv.includes("--prepare")
      ? await provisionCheckerDependencies({ recipe, expectedKey: argument("--expected-key") })
      : planCheckerEnvironment(recipe);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  }
}
