import { useEraStore } from "../useEraStore";

/** Shared by every mounted card/voice hook. Consuming is synchronous, before
 * the first await, so a second caller cannot dispatch the same proposal. */
export function takeProposalForConfirmation() {
  const store = useEraStore.getState();
  if (!store.activeProposal || store.turnInFlight || store.askingAI)
    return null;
  const proposal = store.activeProposal;
  useEraStore.setState({ activeProposal: null, turnInFlight: true });
  return proposal;
}
