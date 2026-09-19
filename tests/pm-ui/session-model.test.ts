import { describe, expect, it } from "vitest";
import { sessionModel } from "../../scripts/pm/src/features/delivery/sessionModel.js";
const plan={steps:[{id:"s1",description:"Edit UI",paths:["src/a.tsx"]},{id:"s2",description:"Check layout",paths:[]}]};
const base={state:{state:"BUILDING",build:{mode:"plan",stepIndex:1}},runner:{alive:true}};
describe("live execution presentation",()=>{
 it("shows recorded step completion and current work without inventing a percentage",()=>{
  const model=sessionModel(base,[{type:"build.step.done",data:{stepId:"s1"}}],plan);
  expect(model.steps.map(s=>s.status)).toEqual(["done","current"]);
  expect(model.running).toBe(true);
  expect(model.steps[0].paths).toEqual(["src/a.tsx"]);
 });
 it("uses the final build transition to complete the last step after build state is cleared",()=>{
  const model=sessionModel({state:{state:"VALIDATING"},runner:{alive:true}},[{type:"phase.transition",phase:"BUILDING",data:{to:"VALIDATING"}}],plan);
  expect(model.steps.every(s=>s.status==="done")).toBe(true);
  expect(model.visited.has("BUILDING")).toBe(true);
  expect(model.visited.has("DISCOVERY")).toBe(false);
 });
 it.each([
  {state:{...base.state,awaiting:{gate:"question"}},runner:{alive:true}},
  {state:{...base.state,execution:{paused:true}},runner:{alive:true}},
  {...base,runner:{alive:false}},
  {state:{state:"FAILED"},runner:{alive:true}},
 ])("never animates a stopped, waiting, paused or terminal run",detail=>{
  expect(sessionModel(detail,[],plan).running).toBe(false);
 });
 it("does not paint a failed run's unexecuted steps as completed",()=>{
  const model=sessionModel({state:{state:"FAILED"},runner:{alive:false}},[],plan);
  expect(model.steps.map(s=>s.status)).toEqual(["next","next"]);
 });
 it("does not let a recovered historical error replace the actual current phase",()=>{
  const model=sessionModel({state:{state:"UAT_READY",lastError:{phase:"BUILDING"}},runner:{alive:true}});
  expect(model.stage).toBe(4);
 });
});
