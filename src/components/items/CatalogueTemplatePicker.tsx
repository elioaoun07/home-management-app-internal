// src/components/items/CatalogueTemplatePicker.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCatalogueItems, useCatalogueModules } from "@/features/catalogue";
import type { CatalogueItem, FlexiblePeriod } from "@/types/catalogue";
import {
  FLEXIBLE_PERIOD_LABELS,
  RECURRENCE_PATTERN_LABELS,
} from "@/types/catalogue";
import {
  Bell,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  Clock,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";

interface CatalogueTemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (catalogueItem: CatalogueItem) => void;
  selectedDate?: Date;
}

export function CatalogueTemplatePicker({
  open,
  onOpenChange,
  onSelectTemplate,
  selectedDate,
}: CatalogueTemplatePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: modules = [] } = useCatalogueModules();
  const { data: allItems = [] } = useCatalogueItems();

  // Find the tasks module
  const tasksModule = useMemo(
    () => modules.find((m) => m.type === "tasks"),
    [modules],
  );

  // Filter items to only show task templates that can be added to calendar
  const availableTemplates = useMemo(() => {
    return allItems.filter((item) => {
      // Only from tasks module
      if (item.module_id !== tasksModule?.id) return false;

      // Must have an item_type (reminder, event, or task)
      if (!item.item_type) return false;

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(query);
        const descMatch = item.description?.toLowerCase().includes(query);
        return nameMatch || descMatch;
      }

      return true;
    });
  }, [allItems, tasksModule?.id, searchQuery]);

  // Separate into active on calendar and not active
  const { activeTemplates, inactiveTemplates, flexibleTemplates } =
    useMemo(() => {
      const active: CatalogueItem[] = [];
      const inactive: CatalogueItem[] = [];
      const flexible: CatalogueItem[] = [];

      availableTemplates.forEach((item) => {
        if (item.is_flexible_routine) {
          flexible.push(item);
        } else if (item.is_active_on_calendar) {
          active.push(item);
        } else {
          inactive.push(item);
        }
      });

      return {
        activeTemplates: active,
        inactiveTemplates: inactive,
        flexibleTemplates: flexible,
      };
    }, [availableTemplates]);

  const getItemTypeIcon = (itemType: string | null) => {
    switch (itemType) {
      case "reminder":
        return <Bell className="h-4 w-4" />;
      case "event":
        return <CalendarDays className="h-4 w-4" />;
      case "task":
      default:
        return <CheckSquare className="h-4 w-4" />;
    }
  };

  const handleSelect = (item: CatalogueItem) => {
    onSelectTemplate(item);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] bg-slate-900/95 border-white/10 backdrop-blur-xl rounded-t-3xl"
      >
        <SheetHeader className="pb-4 border-b border-white/10">
          <SheetTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-cyan-400" />
            Add from Catalogue
          </SheetTitle>
          <SheetDescription className="text-white/60">
            {selectedDate
              ? `Schedule a template for ${selectedDate.toLocaleDateString(
                  "en-US",
                  {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  },
                )}`
              : "Select a template to add to your calendar"}
          </SheetDescription>
        </SheetHeader>

        {/* Search */}
        <div className="py-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(85vh-200px)] py-4">
          {/* Flexible Routines Section */}
          {flexibleTemplates.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Flexible Routines
              </h3>
              <div className="space-y-2">
                {flexibleTemplates.map((item) => (
                  <TemplateCard
                    key={item.id}
                    item={item}
                    icon={getItemTypeIcon(item.item_type)}
                    onSelect={handleSelect}
                    variant="flexible"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Available Templates (not on calendar) */}
          {inactiveTemplates.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                <CalendarPlus className="h-4 w-4 text-cyan-400" />
                Available Templates
              </h3>
              <div className="space-y-2">
                {inactiveTemplates.map((item) => (
                  <TemplateCard
                    key={item.id}
                    item={item}
                    icon={getItemTypeIcon(item.item_type)}
                    onSelect={handleSelect}
                    variant="available"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Already Active on Calendar */}
          {activeTemplates.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-green-400" />
                Already on Calendar
              </h3>
              <div className="space-y-2">
                {activeTemplates.map((item) => (
                  <TemplateCard
                    key={item.id}
                    item={item}
                    icon={getItemTypeIcon(item.item_type)}
                    onSelect={handleSelect}
                    variant="active"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {availableTemplates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-white/20 mb-4" />
              <p className="text-white/60 mb-2">No templates found</p>
              <p className="text-white/40 text-sm">
                {searchQuery
                  ? "Try a different search term"
                  : "Create task templates in the Catalogue first"}
              </p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// Template Card Component
interface TemplateCardProps {
  item: CatalogueItem;
  icon: React.ReactNode;
  onSelect: (item: CatalogueItem) => void;
  variant: "flexible" | "available" | "active";
}

function TemplateCard({ item, icon, onSelect, variant }: TemplateCardProps) {
  const variantStyles = {
    flexible:
      "border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10",
    available: "border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/10",
    active:
      "border-green-500/30 hover:border-green-500/50 hover:bg-green-500/10",
  };

  return (
    <button
      onClick={() => onSelect(item)}
      className={`w-full p-3 rounded-lg border transition-all text-left ${variantStyles[variant]}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg ${
            variant === "flexible"
              ? "bg-amber-500/20 text-amber-400"
              : variant === "active"
                ? "bg-green-500/20 text-green-400"
                : "bg-cyan-500/20 text-cyan-400"
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium truncate">{item.name}</span>
            {variant === "active" && (
              <Badge
                variant="outline"
                className="text-xs border-green-500/30 text-green-400"
              >
                Active
              </Badge>
            )}
          </div>
          {item.description && (
            <p className="text-white/40 text-sm truncate mt-0.5">
              {item.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {item.is_flexible_routine && item.recurrence_pattern && (
              <Badge
                variant="outline"
                className="text-xs border-amber-500/30 text-amber-400"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                {FLEXIBLE_PERIOD_LABELS[item.recurrence_pattern as FlexiblePeriod]}
              </Badge>
            )}
            {item.recurrence_pattern && !item.is_flexible_routine && (
              <Badge
                variant="outline"
                className="text-xs border-white/20 text-white/60"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {RECURRENCE_PATTERN_LABELS[item.recurrence_pattern]}
              </Badge>
            )}
            {item.preferred_time && (
              <Badge
                variant="outline"
                className="text-xs border-white/20 text-white/60"
              >
                <Clock className="h-3 w-3 mr-1" />
                {item.preferred_time.substring(0, 5)}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
