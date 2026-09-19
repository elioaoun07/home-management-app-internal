import { afterEach, describe, expect, it, vi } from "vitest";
import { activeDeliveryId, deliveryQuestions, deliveryTurns, deliveryTurnsCursor, deliveryTranscriptByTurn, deliverySession, loadDeliveryQuestions, loadDeliveryTurns, loadDeliveryTranscript, loadDeliverySession, deliverEligibility } from "../../scripts/pm/src/features/delivery/deliveryStore.js";
import { loadDeliveryRecommendation } from "../../scripts/pm/src/features/delivery/deliveryStore.js";
afterEach(()=>{vi.unstubAllGlobals();activeDeliveryId.value=null;deliveryTurns.value=[];deliveryTurnsCursor.value=0;deliveryQuestions.value=null;deliveryTranscriptByTurn.value={};deliverySession.value=null;});
const response=(value:unknown)=>({ok:true,json:async()=>value});
describe("session navigation isolation",()=>{
 it("requests context for the chosen approach instead of the default lane",async()=>{
  vi.stubGlobal("PM_MODE","server");
  const fetch=vi.fn(async()=>response({preview:{recommendedLane:"FAST"}}));vi.stubGlobal("fetch",fetch);
  await loadDeliveryRecommendation("Budget/4 - Checklist.md",0,"claude",null,"FAST");
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("lane=FAST"),expect.anything());
 });
 it("ignores late question, turn and transcript responses after switching runs",async()=>{
  vi.stubGlobal("PM_MODE","server");
  let release: (value:unknown)=>void = ()=>{};
  const pending=new Promise(resolve=>{release=resolve;});
  vi.stubGlobal("fetch",vi.fn(()=>pending));
  activeDeliveryId.value="old";
  const requests=[loadDeliveryQuestions("old"),loadDeliveryTurns("old"),loadDeliveryTranscript("old","t1")];
  activeDeliveryId.value="new";
  release(response({blocking:[{text:"old"}],turns:[{turnId:"old"}],lastTurn:1,records:[{text:"old"}]}));
  await Promise.all(requests);
  expect(deliveryQuestions.value).toBeNull();
  expect(deliveryTurns.value).toEqual([]);
  expect(deliveryTranscriptByTurn.value).toEqual({});
 });
 it("deduplicates turns when polling and a refresh overlap",async()=>{
  vi.stubGlobal("PM_MODE","server");activeDeliveryId.value="s1";
  vi.stubGlobal("fetch",vi.fn(async()=>response({turns:[{turnId:"t1"}],lastTurn:1})));
  await Promise.all([loadDeliveryTurns("s1"),loadDeliveryTurns("s1")]);
  expect(deliveryTurns.value).toHaveLength(1);
 });
 it("keeps the newly selected session when an earlier detail request arrives last",async()=>{
  let release:(value:unknown)=>void=()=>{};
  const pending=new Promise(resolve=>{release=resolve;});
  vi.stubGlobal("fetch",vi.fn((url:string)=>url.includes("old")?pending:Promise.resolve(response(url.includes("events")?{events:[],lastSeq:0}:{state:{state:"BUILDING"},packet:{sessionId:"new"}}))));
  const old=loadDeliverySession("old",{reset:true});
  await loadDeliverySession("new",{reset:true});
  release(response({events:[],lastSeq:0,state:{state:"SHIPPED"},packet:{sessionId:"old"}}));await old;
  expect(deliverySession.value).toMatchObject({packet:{sessionId:"new"}});
 });
 it("rejects held work and an existing run after checklist reordering",()=>{
  const task={state:"open",module:"Budget",file:"Budget/4 - Checklist.md",cbidx:8,idChip:"BUD-1",text:"Do work"};
  expect(deliverEligibility({...task,text:"HELD — DEC-01"},[],["Budget"]).eligible).toBe(false);
  expect(deliverEligibility(task,[{state:"BUILDING",sessionId:"s1",item:{pmFile:task.file,cbidx:0,id:"BUD-1"}}],["Budget"]).sessionId).toBe("s1");
 });
});
