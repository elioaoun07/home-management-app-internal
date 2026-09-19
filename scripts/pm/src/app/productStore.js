import { computed } from "@preact/signals";
import { allTasks, data, files } from "./store.js";
import { deriveCampaigns, parseDecisions } from "../lib/product.js";
import { buildPortfolio } from "../lib/portfolio.js";

export const ownerDecisions = computed(() => parseDecisions(files.value.find((file) => file.relPath === "_Decisions.md")?.raw));
const portfolio = computed(() => buildPortfolio(deriveCampaigns(files.value, allTasks.value, data.value?.cancelledLog || ""), ownerDecisions.value));
export const campaigns = computed(() => portfolio.value.campaigns);
export const workItems = computed(() => portfolio.value.items);
export const topics = computed(() => portfolio.value.topics);
export const outcomes = computed(() => campaigns.value.flatMap((campaign) => [...campaign.shipped, ...campaign.cancelled]).sort((a, b) => b.date.localeCompare(a.date)));
