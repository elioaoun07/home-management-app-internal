import { describe, expect, it } from "vitest";
import { deliverEligibility } from "../../scripts/pm/src/features/delivery/deliveryStore.js";

describe("delivery eligibility",()=>{
  const task={state:"open",module:"Budget",file:"Budget/4 - Checklist.md",cbidx:2};
  it("allows an open checklist task with a delivery topic",()=>{expect(deliverEligibility(task,[],["Budget"])).toEqual({eligible:true,reason:null});});
  it("rejects completed, non-topic, and already-active work",()=>{
    expect(deliverEligibility({...task,state:"done"},[],["Budget"]).eligible).toBe(false);
    expect(deliverEligibility(task,[],["Schedule"]).eligible).toBe(false);
    expect(deliverEligibility(task,[{sessionId:"s1",state:"BUILDING",item:{pmFile:task.file,cbidx:2}}],["Budget"])).toMatchObject({eligible:false,sessionId:"s1"});
  });
});

