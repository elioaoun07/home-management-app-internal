// DLV-133 operational witness. Never enabled by the ordinary Docker-test flag.
// The owner reviews a concrete --plan and separately approves its exact key.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { freezeCandidate } from "../../scripts/delivery-v2/candidate.mjs";
import { runTypecheckVerification } from "../../scripts/delivery-v2/typecheck.mjs";
import { createContainerRuntime, makeBoundaryConfig, createDockerCli } from "../../scripts/delivery-v2/worker-boundary.mjs";
import { describe, expect, it } from "vitest";
import { provisionCheckerDependencies } from "../../scripts/delivery-v2/setup-checker-deps.mjs";

const enabled = process.env.ERA_V2_ENVIRONMENT_WITNESS === "1" &&
  Boolean(process.env.ERA_V2_ENVIRONMENT_RECIPE) && Boolean(process.env.ERA_V2_ENVIRONMENT_KEY);

describe.skipIf(!enabled)("DLV-133 isolated dependency environment witness", () => {
  it("uses one separate Linux environment for compiler negative/control and command oracles, then reuses it", async () => {
    const recipe = JSON.parse(readFileSync(process.env.ERA_V2_ENVIRONMENT_RECIPE!, "utf8"));
    const expectedKey = process.env.ERA_V2_ENVIRONMENT_KEY!;
    const cold = await provisionCheckerDependencies({ recipe, expectedKey });
    expect(cold.receipt.spec.key).toBe(expectedKey);
    expect(cold.receipt.probes.compilerNegativeControl).toBe(true);
    expect(cold.receipt.probes.compilerPositiveControl).toBe(true);
    expect(cold.receipt.probes.nativeExecuted).toBe(true);
    expect(cold.receipt.oracles.length).toBeGreaterThan(0);
    const warm = await provisionCheckerDependencies({ recipe: { ...recipe, evidence: recipe.evidence + "-warm" }, expectedKey });
    expect(warm.reused).toBe(true);
    expect(warm.receipt.receiptDigest).toBe(cold.receipt.receiptDigest);
    expect(warm.dependencies).toEqual(cold.dependencies);
    if (process.env.ERA_V2_FULL_PROGRAM_WITNESS === "1") await fullProgramWitness(recipe, cold);
  }, 5_400_000);
});

// DLV-133 full-program witness; the separate owner opt-in remains required.
async function fullProgramWitness(recipe: {evidence:string;program:{root:string;files:Record<string,string>};image:string}, cold: Awaited<ReturnType<typeof provisionCheckerDependencies>>) {
  const out = recipe.evidence + '-full-program';
  mkdirSync(out, { recursive: false });
  const generatedTypes = Object.fromEntries(Object.entries(recipe.program.files).filter(([name]) => name.startsWith('.next/')));
  const createdVolumes = new Set<string>(); let sequence = 0;
  const cli = createDockerCli();
  const docker = { ...cli, async run(args: string[], options?: Parameters<ReturnType<typeof createDockerCli>["run"]>[1]) {
    const result = await cli.run(args, options);
    writeFileSync(join(out, String(++sequence).padStart(4, '0') + '.json'), JSON.stringify({args,...result},null,2), {flag:'wx'});
    if (args[0] === 'volume' && args[1] === 'inspect' && args.length === 3 && result.status === 0 && !createdVolumes.has(args[2])) throw Error('Pre-existing witness volume; stop without replacing: '+args[2]);
    if (args[0] === 'volume' && args[1] === 'create' && result.status === 0) createdVolumes.add(String(args.at(-1)));
    if (args[0] === 'volume' && args[1] === 'rm' && result.status === 0) createdVolumes.delete(String(args.at(-1)));
    return result;
  }};
  const runtime = createContainerRuntime({boundary: makeBoundaryConfig({image:recipe.image,network:{mode:'none'},credentials:{},dependencies:cold.dependencies,synthetic:true}),hostRoot:recipe.program.root,workRoot:join(out,'work'),docker});
  const relative = 'src/lib/utils/splitBill.ts';
  const original = readFileSync(join(recipe.program.root,relative),'utf8');
  const base = [{path:relative,sha256:recipe.program.files[relative],size:Buffer.byteLength(original)}];
  let program: string | null = null;
  try {
    for (const [generation, appended, state] of [['C1','\nconst __dlv133Witness: number = "bad";\n','failed'],['C2','\nconst __dlv133Witness: number = 1;\n','satisfied']] as const) {
      const root=join(out,generation);mkdirSync(join(root,'src/lib/utils'),{recursive:true});
      writeFileSync(join(root,relative),original+appended,{flag:'wx'});
      const candidate=freezeCandidate({root,generation,base_manifest:base});
      const offered=await runtime.typecheckExecutor({run_id:'r-dlv133-review02',candidate,include:Object.keys(recipe.program.files),generatedTypes});
      expect(offered.ok,offered.reason).toBe(true);
      if (!offered.ok || !offered.program || !offered.execute || !offered.producer) throw Error(offered.reason || "checker unavailable");
      expect(offered.program.refusals).toEqual([]);
      expect(offered.program.files).toBe(Object.keys(recipe.program.files).length);
      if(program)expect(offered.program.fingerprint).toBe(program);else program=offered.program.fingerprint;
      const result=await runTypecheckVerification({hostRoot:recipe.program.root,candidate,argv:['node','scripts/delivery-v2/typecheck-runner.mjs'],execute:offered.execute,producer:offered.producer,requireIsolation:true});
      writeFileSync(join(out,generation+'.verification.json'),JSON.stringify({candidate,program:offered.program,verification:result},null,2),{flag:'wx'});
      expect(result.environment.producer).toBe('protected-checker');
      expect(result.environment.isolated).toBe(true);expect(result.environment.complete).toBe(true);
      expect(result.environment).toMatchObject({dependencies:{environment:cold.dependencies.environment}});
      expect(result.state).toBe(state);
      if(generation==='C1')expect(result.diagnostics.some((d: {code:string;file:string|null})=>d.code==='TS2322'&&d.file===relative)).toBe(true);
      else expect(result.counts.introduced).toBe(0);
    }
  } finally {
    writeFileSync(join(out,'retained-volumes.json'),JSON.stringify([...createdVolumes],null,2),{flag:'wx'});
  }
}
