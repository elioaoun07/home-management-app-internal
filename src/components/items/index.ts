// src/components/items/index.ts
// Export all items-related components

export { default as EditItemDialog } from "./EditItemDialog";
export { default as ItemActionsSheet } from "./ItemActionsSheet";
export { default as ItemDetailModal } from "./ItemDetailModal";
export { default as ItemsDashboard } from "./ItemsDashboard";
export {
  ResponsibleUserBadge,
  ResponsibleUserPicker,
} from "./ResponsibleUserPicker";
export {
  SmartAlertPicker,
  formatAlertDisplay,
  type SmartAlertValue,
} from "./SmartAlertPicker";
export { default as SwipeableItemCard } from "./SwipeableItemCard";

// Catalogue integration components
export { CatalogueTemplatePicker } from "./CatalogueTemplatePicker";
export { EditScopeDialog } from "./EditScopeDialog";
export { PromoteToCatalogueDialog } from "./PromoteToCatalogueDialog";
