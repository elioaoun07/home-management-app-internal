"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useCatalogueCategories,
  useCatalogueItems,
  useCatalogueModules,
  useDeleteCategory,
  useDeleteItem,
  useDeleteModule,
  useUpdateItem,
} from "@/features/catalogue/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type {
  CatalogueCategory,
  CatalogueItem,
  CatalogueModule,
} from "@/types/catalogue";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  ChefHat,
  ChevronRight,
  Dumbbell,
  Edit3,
  FileText,
  Film,
  FolderOpen,
  GraduationCap,
  Heart,
  HeartPulse,
  MoreVertical,
  Pencil,
  Pin,
  Plane,
  Plus,
  Search,
  Star,
  Tag,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import CatalogueCategoryDialog from "./CatalogueCategoryDialog";
import CatalogueItemDetailDialog from "./CatalogueItemDetailDialog";
import CatalogueItemDialog from "./CatalogueItemDialog";
import CatalogueModuleDialog from "./CatalogueModuleDialog";

// Icon mapping for modules
const MODULE_ICON_COMPONENTS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  wallet: Wallet,
  "check-square": CheckSquare,
  "chef-hat": ChefHat,
  "heart-pulse": HeartPulse,
  plane: Plane,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  users: Users,
  "file-text": FileText,
  folder: FolderOpen,
  tag: Tag,
  heart: Heart,
  book: BookOpen,
  film: Film,
};

function getModuleIcon(
  iconName: string
): React.ComponentType<{ className?: string; style?: React.CSSProperties }> {
  return MODULE_ICON_COMPONENTS[iconName] || FolderOpen;
}

type ViewLevel = "modules" | "categories" | "items";

interface BreadcrumbItem {
  level: ViewLevel;
  id?: string;
  name: string;
}

export default function WebCatalogue() {
  const themeClasses = useThemeClasses();

  // Navigation state
  const [currentLevel, setCurrentLevel] = useState<ViewLevel>("modules");
  const [selectedModule, setSelectedModule] = useState<CatalogueModule | null>(
    null
  );
  const [selectedCategory, setSelectedCategory] =
    useState<CatalogueCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog state
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogueItem | null>(null);
  const [showItemDetailDialog, setShowItemDetailDialog] = useState(false);
  const [viewingItem, setViewingItem] = useState<CatalogueItem | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<CatalogueCategory | null>(null);
  const [showModuleDialog, setShowModuleDialog] = useState(false);
  const [editingModule, setEditingModule] = useState<CatalogueModule | null>(
    null
  );

  // Data queries
  const { data: modules = [], isLoading: modulesLoading } =
    useCatalogueModules();
  const { data: categories = [], isLoading: categoriesLoading } =
    useCatalogueCategories(selectedModule?.id);
  const { data: items = [], isLoading: itemsLoading } = useCatalogueItems(
    selectedModule?.id,
    selectedCategory?.id
  );

  // Mutations
  const deleteItem = useDeleteItem();
  const deleteCategory = useDeleteCategory();
  const deleteModule = useDeleteModule();
  const updateItem = useUpdateItem();

  // Filtered data
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [items, searchQuery]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(query) ||
        cat.description?.toLowerCase().includes(query)
    );
  }, [categories, searchQuery]);

  // Breadcrumb navigation
  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const crumbs: BreadcrumbItem[] = [{ level: "modules", name: "Catalogue" }];
    if (selectedModule) {
      crumbs.push({
        level: "categories",
        id: selectedModule.id,
        name: selectedModule.name,
      });
    }
    if (selectedCategory) {
      crumbs.push({
        level: "items",
        id: selectedCategory.id,
        name: selectedCategory.name,
      });
    }
    return crumbs;
  }, [selectedModule, selectedCategory]);

  // Navigation handlers
  const navigateToModules = () => {
    setCurrentLevel("modules");
    setSelectedModule(null);
    setSelectedCategory(null);
    setSearchQuery("");
  };

  const navigateToCategories = (module: CatalogueModule) => {
    setCurrentLevel("categories");
    setSelectedModule(module);
    setSelectedCategory(null);
    setSearchQuery("");
  };

  const navigateToItems = (category: CatalogueCategory) => {
    setCurrentLevel("items");
    setSelectedCategory(category);
    setSearchQuery("");
  };

  const handleBreadcrumbClick = (crumb: BreadcrumbItem) => {
    if (crumb.level === "modules") {
      navigateToModules();
    } else if (crumb.level === "categories" && selectedModule) {
      setCurrentLevel("categories");
      setSelectedCategory(null);
      setSearchQuery("");
    }
  };

  // Item actions
  const handleViewItem = (item: CatalogueItem) => {
    setViewingItem(item);
    setShowItemDetailDialog(true);
  };

  const handleTogglePin = (item: CatalogueItem) => {
    updateItem.mutate({ id: item.id, is_pinned: !item.is_pinned });
  };

  const handleToggleFavorite = (item: CatalogueItem) => {
    updateItem.mutate({ id: item.id, is_favorite: !item.is_favorite });
  };

  const handleEditItem = (item: CatalogueItem) => {
    setEditingItem(item);
    setShowItemDialog(true);
  };

  const handleDeleteItem = (item: CatalogueItem) => {
    deleteItem.mutate(item.id);
  };

  const handleEditCategory = (category: CatalogueCategory) => {
    setEditingCategory(category);
    setShowCategoryDialog(true);
  };

  const handleDeleteCategory = (category: CatalogueCategory) => {
    deleteCategory.mutate(category.id);
  };

  // Module actions
  const handleAddModule = () => {
    setEditingModule(null);
    setShowModuleDialog(true);
  };

  const handleEditModule = (module: CatalogueModule) => {
    setEditingModule(module);
    setShowModuleDialog(true);
  };

  const handleDeleteModule = (module: CatalogueModule) => {
    deleteModule.mutate(module.id);
  };

  // Loading state
  if (modulesLoading) {
    return (
      <div className={`min-h-full ${themeClasses.pageBg} p-6`}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className={`h-40 ${themeClasses.surfaceBg} rounded-2xl animate-pulse`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-full ${themeClasses.pageBg}`}>
      {/* Header */}
      <div
        className={`sticky top-0 z-10 ${themeClasses.headerGradient} backdrop-blur-xl border-b ${themeClasses.border}`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 mb-3">
            {currentLevel !== "modules" && (
              <button
                type="button"
                onClick={() => {
                  if (currentLevel === "items" && selectedCategory) {
                    setCurrentLevel("categories");
                    setSelectedCategory(null);
                  } else {
                    navigateToModules();
                  }
                }}
                className={`p-2 rounded-lg ${themeClasses.bgHover} transition-colors`}
              >
                <ArrowLeft className="w-5 h-5 text-white/70" />
              </button>
            )}
            <nav className="flex items-center gap-1 text-sm">
              {breadcrumbs.map((crumb, index) => (
                <div
                  key={crumb.level + (crumb.id || "")}
                  className="flex items-center gap-1"
                >
                  {index > 0 && (
                    <ChevronRight className="w-4 h-4 text-white/40" />
                  )}
                  <button
                    type="button"
                    onClick={() => handleBreadcrumbClick(crumb)}
                    className={cn(
                      "px-2 py-1 rounded-md transition-colors",
                      index === breadcrumbs.length - 1
                        ? "text-white font-medium"
                        : "text-white/60 hover:text-white hover:bg-white/10"
                    )}
                    disabled={index === breadcrumbs.length - 1}
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}
            </nav>
          </div>

          {/* Search and Add */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                type="text"
                placeholder={`Search ${currentLevel}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 ${themeClasses.inputBg} border-white/10 text-white placeholder:text-white/40`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              )}
            </div>

            {/* Add Button */}
            {currentLevel !== "modules" && (
              <button
                type="button"
                onClick={() => {
                  if (currentLevel === "categories") {
                    setEditingCategory(null);
                    setShowCategoryDialog(true);
                  } else {
                    setEditingItem(null);
                    setShowItemDialog(true);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary/80 text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">
                  Add {currentLevel === "categories" ? "Category" : "Item"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Modules Grid */}
        {currentLevel === "modules" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {modules.map((module) => {
              const IconComponent = getModuleIcon(module.icon);
              return (
                <Card
                  key={module.id}
                  className={cn(
                    "group relative overflow-hidden cursor-pointer transition-all duration-300",
                    "hover:scale-[1.02] hover:shadow-xl",
                    themeClasses.cardBg,
                    themeClasses.border
                  )}
                  onClick={() => navigateToCategories(module)}
                >
                  {/* Gradient overlay */}
                  <div
                    className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"
                    style={{
                      background: `linear-gradient(135deg, ${module.gradient_from || module.color} 0%, ${module.gradient_to || module.color} 100%)`,
                    }}
                  />

                  <div className="relative p-6">
                    {/* Edit/Delete buttons */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditModule(module);
                        }}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-white/70" />
                      </button>
                      {!module.is_system && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteModule(module);
                          }}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-white/70" />
                        </button>
                      )}
                    </div>

                    {/* Icon */}
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${module.gradient_from || module.color} 0%, ${module.gradient_to || module.color} 100%)`,
                      }}
                    >
                      <IconComponent className="w-7 h-7 text-white" />
                    </div>

                    {/* Name and description */}
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {module.name}
                    </h3>
                    {module.description && (
                      <p className="text-sm text-white/60 line-clamp-2 mb-3">
                        {module.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-white/50">
                        <FolderOpen className="w-4 h-4" />
                        <span>{module.category_count ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1 text-white/50">
                        <FileText className="w-4 h-4" />
                        <span>{module.item_count ?? 0}</span>
                      </div>
                    </div>

                    {/* Arrow indicator */}
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
                  </div>
                </Card>
              );
            })}

            {/* Add Module Card */}
            <Card
              className={cn(
                "group relative overflow-hidden cursor-pointer transition-all duration-300",
                "hover:scale-[1.02] hover:shadow-xl border-dashed border-2",
                themeClasses.cardBg,
                "border-white/20 hover:border-white/40"
              )}
              onClick={handleAddModule}
            >
              <div className="relative p-6 flex flex-col items-center justify-center min-h-[160px]">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 bg-white/10">
                  <Plus className="w-7 h-7 text-white/50" />
                </div>
                <h3 className="text-lg font-medium text-white/50 group-hover:text-white/70 transition-colors">
                  Add Module
                </h3>
              </div>
            </Card>
          </div>
        )}

        {/* Categories Grid */}
        {currentLevel === "categories" && (
          <div className="space-y-6">
            {/* Categories */}
            <div>
              <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Categories ({filteredCategories.length})
              </h3>
              {categoriesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-24 ${themeClasses.surfaceBg} rounded-xl animate-pulse`}
                    />
                  ))}
                </div>
              ) : filteredCategories.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCategories.map((category) => (
                    <CategoryCard
                      key={category.id}
                      category={category}
                      themeClasses={themeClasses}
                      onClick={() => navigateToItems(category)}
                      onEdit={() => handleEditCategory(category)}
                      onDelete={() => handleDeleteCategory(category)}
                    />
                  ))}
                  {/* Add Category Card */}
                  <Card
                    className={cn(
                      "group relative cursor-pointer transition-all duration-200",
                      "hover:scale-[1.01] hover:shadow-lg border-dashed border-2",
                      themeClasses.cardBg,
                      "border-white/20 hover:border-white/40"
                    )}
                    onClick={() => {
                      setEditingCategory(null);
                      setShowCategoryDialog(true);
                    }}
                  >
                    <div className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/10">
                        <Plus className="w-5 h-5 text-white/50" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white/50 group-hover:text-white/70 transition-colors">
                          Add Category
                        </h4>
                      </div>
                    </div>
                  </Card>
                </div>
              ) : (
                <EmptyState
                  icon={FolderOpen}
                  title="No categories yet"
                  description="Create your first category to organize items"
                  onAdd={() => {
                    setEditingCategory(null);
                    setShowCategoryDialog(true);
                  }}
                  themeClasses={themeClasses}
                />
              )}
            </div>

            {/* Uncategorized Items (if viewing a module) */}
            {selectedModule && (
              <div>
                <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Items without category
                </h3>
                <ItemsGrid
                  items={items.filter((i) => !i.category_id)}
                  isLoading={itemsLoading}
                  themeClasses={themeClasses}
                  onClick={handleViewItem}
                  onDoubleClick={handleTogglePin}
                  onEdit={handleEditItem}
                  onDelete={handleDeleteItem}
                  onAdd={() => {
                    setEditingItem(null);
                    setShowItemDialog(true);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Items Grid */}
        {currentLevel === "items" && (
          <ItemsGrid
            items={filteredItems}
            isLoading={itemsLoading}
            themeClasses={themeClasses}
            onClick={handleViewItem}
            onDoubleClick={handleTogglePin}
            onEdit={handleEditItem}
            onDelete={handleDeleteItem}
            onAdd={() => {
              setEditingItem(null);
              setShowItemDialog(true);
            }}
          />
        )}
      </div>

      {/* Dialogs */}
      <CatalogueItemDialog
        open={showItemDialog}
        onOpenChange={setShowItemDialog}
        moduleId={selectedModule?.id || ""}
        moduleType={selectedModule?.type || "custom"}
        categoryId={selectedCategory?.id}
        editingItem={editingItem}
      />

      <CatalogueCategoryDialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        moduleId={selectedModule?.id || ""}
        editingCategory={editingCategory}
      />

      <CatalogueItemDetailDialog
        open={showItemDetailDialog}
        onOpenChange={setShowItemDetailDialog}
        item={viewingItem}
        moduleType={selectedModule?.type || "custom"}
        onEdit={handleEditItem}
      />

      <CatalogueModuleDialog
        open={showModuleDialog}
        onOpenChange={setShowModuleDialog}
        editingModule={editingModule}
      />
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface CategoryCardProps {
  category: CatalogueCategory;
  themeClasses: ReturnType<typeof useThemeClasses>;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function CategoryCard({
  category,
  themeClasses,
  onClick,
  onEdit,
  onDelete,
}: CategoryCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const IconComponent = getModuleIcon(category.icon || "tag");

  return (
    <Card
      className={cn(
        "group relative cursor-pointer transition-all duration-200",
        "hover:scale-[1.01] hover:shadow-lg",
        themeClasses.cardBg,
        themeClasses.border
      )}
    >
      <div className="p-4 flex items-center gap-4" onClick={onClick}>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: (category.color || "#6366f1") + "30" }}
        >
          <IconComponent
            className="w-5 h-5"
            style={{ color: category.color || "#6366f1" }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white truncate">{category.name}</h4>
          {category.description && (
            <p className="text-sm text-white/50 truncate">
              {category.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/40">
            {category.item_count ?? 0}
          </span>
          <ChevronRight className="w-4 h-4 text-white/30" />
        </div>
      </div>

      {/* Actions menu */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={`p-1.5 rounded-lg ${themeClasses.bgHover}`}
        >
          <MoreVertical className="w-4 h-4 text-white/60" />
        </button>
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />
            <div
              className={`absolute right-0 top-8 z-20 w-32 py-1 rounded-lg shadow-xl ${themeClasses.modalBg} ${themeClasses.border}`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onEdit();
                }}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onDelete();
                }}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

interface ItemsGridProps {
  items: CatalogueItem[];
  isLoading: boolean;
  themeClasses: ReturnType<typeof useThemeClasses>;
  onClick: (item: CatalogueItem) => void;
  onDoubleClick: (item: CatalogueItem) => void;
  onEdit: (item: CatalogueItem) => void;
  onDelete: (item: CatalogueItem) => void;
  onAdd: () => void;
}

function ItemsGrid({
  items,
  isLoading,
  themeClasses,
  onClick,
  onDoubleClick,
  onEdit,
  onDelete,
  onAdd,
}: ItemsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-32 ${themeClasses.surfaceBg} rounded-xl animate-pulse`}
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No items yet"
        description="Add your first item to this category"
        onAdd={onAdd}
        themeClasses={themeClasses}
      />
    );
  }

  // Separate pinned items
  const pinnedItems = items.filter((i) => i.is_pinned);
  const regularItems = items.filter((i) => !i.is_pinned);

  return (
    <div className="space-y-4">
      {/* Pinned items */}
      {pinnedItems.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Pin className="w-3 h-3" /> Pinned
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pinnedItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                themeClasses={themeClasses}
                onClick={onClick}
                onDoubleClick={onDoubleClick}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {regularItems.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            themeClasses={themeClasses}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

interface ItemCardProps {
  item: CatalogueItem;
  themeClasses: ReturnType<typeof useThemeClasses>;
  onClick: (item: CatalogueItem) => void;
  onDoubleClick: (item: CatalogueItem) => void;
  onEdit: (item: CatalogueItem) => void;
  onDelete: (item: CatalogueItem) => void;
}

function ItemCard({
  item,
  themeClasses,
  onClick,
  onDoubleClick,
  onEdit,
  onDelete,
}: ItemCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  // Progress bar calculation
  const hasProgress = item.progress_target && item.progress_target > 0;
  const progressPercent = hasProgress
    ? Math.min(
        100,
        ((item.progress_current ?? 0) / item.progress_target!) * 100
      )
    : 0;

  // Status indicator
  const isCompleted = item.status === "completed";

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200 cursor-pointer",
        "hover:scale-[1.01] hover:shadow-lg",
        themeClasses.cardBg,
        themeClasses.border,
        isCompleted && "opacity-60"
      )}
      onClick={() => onClick(item)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(item);
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {item.is_pinned && (
              <Pin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            )}
            {item.is_favorite && (
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
            )}
            <h4
              className={cn(
                "font-medium truncate",
                isCompleted ? "text-white/60 line-through" : "text-white"
              )}
            >
              {item.name}
            </h4>
          </div>

          {/* Quick actions - only menu button */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded text-white/40 hover:text-white transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Description */}
        {item.description && (
          <p className="text-sm text-white/50 line-clamp-2 mb-3">
            {item.description}
          </p>
        )}

        {/* Progress bar */}
        {hasProgress && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-white/50 mb-1">
              <span>
                {item.progress_current ?? 0} / {item.progress_target}{" "}
                {item.progress_unit || ""}
              </span>
              <span>{progressPercent.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/60"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/40">
                +{item.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Sub-items indicator */}
        {item.sub_items && item.sub_items.length > 0 && (
          <div className="flex items-center gap-1 mt-2 text-xs text-white/40">
            <CheckCircle2 className="w-3 h-3" />
            <span>
              {item.sub_items.filter((s) => s.is_completed).length} /{" "}
              {item.sub_items.length}
            </span>
          </div>
        )}
      </div>

      {/* Menu dropdown */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
          />
          <div
            className={`absolute right-2 top-10 z-20 w-32 py-1 rounded-lg shadow-xl ${themeClasses.modalBg} ${themeClasses.border}`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onEdit(item);
              }}
              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onDelete(item);
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onAdd: () => void;
  themeClasses: ReturnType<typeof useThemeClasses>;
}

function EmptyState({
  icon: Icon,
  title,
  description,
  onAdd,
  themeClasses,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 rounded-2xl",
        themeClasses.surfaceBg,
        themeClasses.border
      )}
    >
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-white/30" />
      </div>
      <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
      <p className="text-sm text-white/50 text-center mb-4">{description}</p>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary/80 text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
      >
        <Plus className="w-4 h-4" />
        Create
      </button>
    </div>
  );
}
