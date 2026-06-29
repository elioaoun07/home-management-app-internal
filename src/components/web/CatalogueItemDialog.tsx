"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateItem, useUpdateItem } from "@/features/catalogue/hooks";
import { catalogueKeys } from "@/features/catalogue/queryKeys";
import { useHouseholdMembers } from "@/hooks/useHouseholdMembers";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { safeFetch } from "@/lib/safeFetch";
import { compressReceiptImage, formatFileSize } from "@/lib/receiptUtils";
import { cn } from "@/lib/utils";
import type {
  CatalogueItem,
  CatalogueItemStatus,
  CatalogueModuleType,
  CataloguePriority,
  CreateItemInput,
} from "@/types/catalogue";
import {
  MODULE_TYPE_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/types/catalogue";
import {
  Calendar,
  Camera,
  DollarSign,
  ImageIcon,
  Languages,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Star,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  moduleType: CatalogueModuleType;
  categoryId?: string;
  editingItem: CatalogueItem | null;
}

const STATUS_OPTIONS: CatalogueItemStatus[] = [
  "active",
  "in_progress",
  "completed",
  "paused",
  "cancelled",
];

const PRIORITY_OPTIONS: CataloguePriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
  "critical",
];

// Module-specific field configurations
const MODULE_FIELD_CONFIG: Record<
  CatalogueModuleType,
  {
    nameLabel: string;
    namePlaceholder: string;
    showDescription: boolean;
    showPriority: boolean;
    showStatus: boolean;
    showProgress: boolean;
    showFrequency: boolean;
    showTags: boolean;
    customFields: Array<{
      key: string;
      label: string;
      type:
        | "text"
        | "number"
        | "date"
        | "select"
        | "combobox"
        | "textarea"
        | "checkbox";
      placeholder?: string;
      icon?: React.ComponentType<{ className?: string }>;
      options?: string[];
    }>;
  }
> = {
  contacts: {
    nameLabel: "Full Name",
    namePlaceholder: "John Doe",
    showDescription: false,
    showPriority: false,
    showStatus: false,
    showProgress: false,
    showFrequency: false,
    showTags: true,
    customFields: [
      {
        key: "phone",
        label: "Phone",
        type: "text",
        placeholder: "+1 234 567 8900",
        icon: Phone,
      },
      {
        key: "email",
        label: "Email",
        type: "text",
        placeholder: "john@example.com",
        icon: Mail,
      },
      {
        key: "address",
        label: "Address",
        type: "text",
        placeholder: "123 Main St, City",
        icon: MapPin,
      },
      { key: "birthday", label: "Birthday", type: "date", icon: Calendar },
      {
        key: "relationship",
        label: "Relationship",
        type: "select",
        options: [
          "Family",
          "Friend",
          "Colleague",
          "Client",
          "Doctor",
          "Service",
          "Other",
        ],
      },
      {
        key: "company",
        label: "Company/Organization",
        type: "text",
        placeholder: "Company name",
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Additional information...",
      },
    ],
  },
  budget: {
    nameLabel: "Item Name",
    namePlaceholder: "MacBook Pro, New Car...",
    showDescription: true,
    showPriority: true,
    showStatus: false,
    showProgress: true,
    showFrequency: false,
    showTags: true,
    customFields: [
      {
        key: "target_amount",
        label: "Target Price",
        type: "number",
        placeholder: "2500",
        icon: DollarSign,
      },
      {
        key: "where_to_buy",
        label: "Where to Buy",
        type: "text",
        placeholder: "Amazon, Apple Store...",
      },
      {
        key: "url",
        label: "Product URL",
        type: "text",
        placeholder: "https://...",
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Why you want this, specs...",
      },
    ],
  },
  tasks: {
    nameLabel: "Task Name",
    namePlaceholder: "Clean garage, Call mom...",
    showDescription: true,
    showPriority: true,
    showStatus: true,
    showProgress: false,
    showFrequency: true,
    showTags: true,
    customFields: [
      { key: "due_date", label: "Due Date", type: "date", icon: Calendar },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Task details...",
      },
    ],
  },
  healthcare: {
    nameLabel: "Name",
    namePlaceholder: "Dr. Smith, Blood Test...",
    showDescription: true,
    showPriority: false,
    showStatus: false,
    showProgress: false,
    showFrequency: true,
    showTags: true,
    customFields: [
      {
        key: "specialty",
        label: "Specialty/Type",
        type: "text",
        placeholder: "Cardiologist, Lab Test...",
      },
      {
        key: "phone",
        label: "Phone",
        type: "text",
        placeholder: "+1 234 567 8900",
        icon: Phone,
      },
      {
        key: "address",
        label: "Location",
        type: "text",
        placeholder: "Hospital/Clinic address",
        icon: MapPin,
      },
      {
        key: "next_appointment",
        label: "Next Appointment",
        type: "date",
        icon: Calendar,
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Important info, allergies...",
      },
    ],
  },
  trips: {
    nameLabel: "Destination",
    namePlaceholder: "Paris, Tokyo, Bali...",
    showDescription: true,
    showPriority: true,
    showStatus: true,
    showProgress: true,
    showFrequency: false,
    showTags: true,
    customFields: [
      { key: "country", label: "Country", type: "text", placeholder: "France" },
      {
        key: "estimated_cost",
        label: "Estimated Budget",
        type: "number",
        placeholder: "3000",
        icon: DollarSign,
      },
      {
        key: "best_season",
        label: "Best Time to Visit",
        type: "text",
        placeholder: "Spring, Summer...",
      },
      { key: "start_date", label: "Trip Start", type: "date", icon: Calendar },
      { key: "end_date", label: "Trip End", type: "date", icon: Calendar },
      {
        key: "activities",
        label: "Things to Do",
        type: "textarea",
        placeholder: "Museums, beaches, restaurants...",
      },
    ],
  },
  fitness: {
    nameLabel: "Exercise Name",
    namePlaceholder: "Bench Press, Squats...",
    showDescription: true,
    showPriority: false,
    showStatus: false,
    showProgress: false,
    showFrequency: false,
    showTags: true,
    customFields: [
      { key: "sets", label: "Sets", type: "number", placeholder: "4" },
      { key: "reps", label: "Reps", type: "number", placeholder: "10" },
      {
        key: "weight",
        label: "Weight (kg/lbs)",
        type: "text",
        placeholder: "50 kg",
      },
      {
        key: "duration_mins",
        label: "Duration (mins)",
        type: "number",
        placeholder: "30",
      },
      {
        key: "muscle_groups",
        label: "Muscle Groups",
        type: "text",
        placeholder: "Chest, Triceps...",
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Form tips, variations...",
      },
    ],
  },
  learning: {
    nameLabel: "Skill/Topic",
    namePlaceholder: "Piano, TypeScript, Spanish...",
    showDescription: true,
    showPriority: true,
    showStatus: true,
    showProgress: true,
    showFrequency: false,
    showTags: true,
    customFields: [
      {
        key: "skill_level",
        label: "Current Level",
        type: "select",
        options: [
          "Beginner",
          "Elementary",
          "Intermediate",
          "Advanced",
          "Expert",
        ],
      },
      {
        key: "target_level",
        label: "Target Level",
        type: "select",
        options: [
          "Beginner",
          "Elementary",
          "Intermediate",
          "Advanced",
          "Expert",
        ],
      },
      {
        key: "resource_url",
        label: "Learning Resource URL",
        type: "text",
        placeholder: "https://...",
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "What to learn, resources...",
      },
    ],
  },
  recipe: {
    nameLabel: "Recipe Name",
    namePlaceholder: "Pasta Carbonara, Apple Pie...",
    showDescription: true,
    showPriority: false,
    showStatus: false,
    showProgress: false,
    showFrequency: false,
    showTags: true,
    customFields: [
      { key: "servings", label: "Servings", type: "number", placeholder: "4" },
      {
        key: "prep_time",
        label: "Prep Time (mins)",
        type: "number",
        placeholder: "15",
      },
      {
        key: "cook_time",
        label: "Cook Time (mins)",
        type: "number",
        placeholder: "30",
      },
      {
        key: "difficulty",
        label: "Difficulty",
        type: "select",
        options: ["Easy", "Medium", "Hard", "Expert"],
      },
      {
        key: "cuisine",
        label: "Cuisine",
        type: "text",
        placeholder: "Italian, Japanese...",
      },
      {
        key: "ingredients",
        label: "Ingredients",
        type: "textarea",
        placeholder: "List ingredients...",
      },
      {
        key: "instructions",
        label: "Instructions",
        type: "textarea",
        placeholder: "Step by step...",
      },
    ],
  },
  documents: {
    nameLabel: "Document Name",
    namePlaceholder: "Passport, Insurance...",
    showDescription: true,
    showPriority: false,
    showStatus: false,
    showProgress: false,
    showFrequency: false,
    showTags: true,
    customFields: [
      {
        key: "arabic_name",
        label: "Arabic Equivalent",
        type: "text",
        placeholder: "إفادة سكن",
        icon: Languages,
      },
      {
        key: "document_type",
        label: "Document Type",
        type: "combobox",
        placeholder: "Passport, ID, License...",
        options: [
          "Passport",
          "National ID",
          "Driver's License",
          "Residence Permit",
          "Birth Certificate",
          "Marriage Certificate",
          "Health Card",
          "Insurance Policy",
          "Visa",
          "Work Permit",
          "Tax Document",
          "Bank Document",
          "Vehicle Registration",
          "Property Deed",
          "Other",
        ],
      },
      {
        key: "usual_cost",
        label: "Usual Cost",
        type: "text",
        placeholder: "500,000 LBP / $10",
        icon: DollarSign,
      },
      {
        key: "prerequisite_documents",
        label: "Prerequisite Documents",
        type: "textarea",
        placeholder: "ID copy, passport photo, proof of residency...",
      },
      {
        key: "copy_submission_allowed",
        label: "Copy/scanned version accepted",
        type: "checkbox",
      },
      {
        key: "document_number",
        label: "Document Number",
        type: "text",
        placeholder: "ABC123456",
      },
      { key: "issue_date", label: "Issue Date", type: "date", icon: Calendar },
      {
        key: "expiry_date",
        label: "Expiry Date",
        type: "date",
        icon: Calendar,
      },
      {
        key: "issuing_authority",
        label: "Issuing Authority",
        type: "text",
        placeholder: "Government, Bank...",
      },
      {
        key: "issue_location_name",
        label: "Issuing Location",
        type: "text",
        placeholder: "Mukhtar office, Nefaa Dekwaneh...",
        icon: MapPin,
      },
      {
        key: "issue_location_url",
        label: "Issuing Maps Link",
        type: "text",
        placeholder: "https://maps.google.com/...",
        icon: MapPin,
      },
      {
        key: "location",
        label: "Storage Location",
        type: "text",
        placeholder: "Safe, Filing cabinet...",
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Additional info...",
      },
    ],
  },
  movies: {
    nameLabel: "Title",
    namePlaceholder: "Inception, Breaking Bad...",
    showDescription: true,
    showPriority: false,
    showStatus: true,
    showProgress: false,
    showFrequency: false,
    showTags: true,
    customFields: [
      {
        key: "media_type",
        label: "Type",
        type: "select",
        options: ["Movie", "TV Series", "Documentary", "Anime", "Short Film"],
      },
      {
        key: "genre",
        label: "Genre",
        type: "text",
        placeholder: "Action, Drama, Comedy...",
      },
      {
        key: "year",
        label: "Year",
        type: "number",
        placeholder: "2024",
      },
      {
        key: "director",
        label: "Director",
        type: "text",
        placeholder: "Christopher Nolan",
      },
      {
        key: "rating",
        label: "Your Rating",
        type: "select",
        icon: Star,
        options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
      {
        key: "platform",
        label: "Where to Watch",
        type: "text",
        placeholder: "Netflix, Prime, Cinema...",
      },
      {
        key: "watch_date",
        label: "Watch Date",
        type: "date",
        icon: Calendar,
      },
      {
        key: "notes",
        label: "Review/Notes",
        type: "textarea",
        placeholder: "Your thoughts...",
      },
    ],
  },
  custom: {
    nameLabel: "Name",
    namePlaceholder: "Enter name...",
    showDescription: true,
    showPriority: true,
    showStatus: true,
    showProgress: true,
    showFrequency: true,
    showTags: true,
    customFields: [
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Additional notes...",
      },
    ],
  },
  inventory: {
    nameLabel: "Item Name",
    namePlaceholder: "Toilet Paper, Salt, Milk...",
    showDescription: true,
    showPriority: false,
    showStatus: false,
    showProgress: false,
    showFrequency: false,
    showTags: true,
    customFields: [
      {
        key: "barcode",
        label: "Barcode",
        type: "text",
        placeholder: "Scan or enter barcode...",
      },
      {
        key: "unit_type",
        label: "Unit Type",
        type: "select",
        options: [
          "pieces",
          "kg",
          "g",
          "L",
          "mL",
          "pack",
          "box",
          "roll",
          "bottle",
        ],
      },
      {
        key: "unit_size",
        label: "Unit Size",
        type: "number",
        placeholder: "1",
      },
      {
        key: "consumption_rate_days",
        label: "Days to Consume",
        type: "number",
        placeholder: "How many days to use one unit?",
      },
      {
        key: "minimum_stock",
        label: "Minimum Stock",
        type: "number",
        placeholder: "Alert when below this quantity",
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        placeholder: "Brand preference, where to buy...",
      },
    ],
  },
};

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "twice-weekly", label: "Twice a week" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "6-months", label: "Every 6 months" },
  { value: "yearly", label: "Yearly" },
  { value: "as-needed", label: "As needed" },
];

const DOCUMENT_ARABIC_SUGGESTIONS = [
  {
    englishName: "Proof of Residency",
    arabicName: "إفادة سكن",
    aliases: [
      "proof residency",
      "proof of residence",
      "residency certificate",
      "ifade sakan",
      "ifedit sakan",
      "ifedet sakan",
      "ifade seken",
      "efade sakan",
      "efedet seken",
      "ifadet sokon",
      "افادت سكن",
    ],
  },
  {
    englishName: "Individual Civil Record",
    arabicName: "إخراج قيد فردي",
    aliases: [
      "individual record",
      "civil record",
      "ikhraj qayd farde",
      "ikhraj eid farde",
      "ekhraj eid farde",
      "ekhraj kayd farde",
    ],
  },
  {
    englishName: "Family Civil Record",
    arabicName: "إخراج قيد عائلي",
    aliases: [
      "family record",
      "family civil record",
      "ikhraj qayd ayle",
      "ikhraj eid 3ayle",
      "ekhraj eid ayle",
      "ekhraj kayd ayle",
    ],
  },
  {
    englishName: "Birth Certificate",
    arabicName: "بيان ولادة",
    aliases: ["birth record", "bayan welade", "bayan wilade", "wlede"],
  },
  {
    englishName: "Marriage Certificate",
    arabicName: "وثيقة زواج",
    aliases: ["marriage record", "wathiqat zawaj", "wes2et zawaj", "zawaj"],
  },
  {
    englishName: "Passport",
    arabicName: "جواز سفر",
    aliases: ["jawaz safar", "jawaz", "passport"],
  },
  {
    englishName: "National ID",
    arabicName: "بطاقة هوية",
    aliases: ["id", "identity card", "hawiyye", "hawiyyeh", "hawiye"],
  },
  {
    englishName: "Driver's License",
    arabicName: "رخصة سوق",
    aliases: ["driving license", "rokhsit sou2", "rokhset sou2", "nefaa"],
  },
  {
    englishName: "Police Record",
    arabicName: "سجل عدلي",
    aliases: [
      "criminal record",
      "no criminal record",
      "sejel 3adle",
      "sijil adle",
      "sejel adli",
    ],
  },
  {
    englishName: "Employment Certificate",
    arabicName: "إفادة عمل",
    aliases: ["work certificate", "ifade amal", "ifedit 3amal", "efedet amal"],
  },
  {
    englishName: "Bank Statement",
    arabicName: "كشف حساب مصرفي",
    aliases: ["bank document", "account statement", "kashf hesab", "bank"],
  },
  {
    englishName: "Insurance Policy",
    arabicName: "بوليصة تأمين",
    aliases: ["insurance", "polisa ta2min", "ta2min", "تامين"],
  },
];

const normalizeDocumentSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[^0-9a-z\u0600-\u06ff]+/g, " ")
    .trim();

const getArabicDocumentSuggestions = (...inputs: string[]) => {
  const terms = inputs
    .map(normalizeDocumentSearch)
    .filter((term) => term.length > 1);
  if (terms.length === 0) return [];

  return DOCUMENT_ARABIC_SUGGESTIONS.filter((suggestion) => {
    const searchable = normalizeDocumentSearch(
      [
        suggestion.englishName,
        suggestion.arabicName,
        ...suggestion.aliases,
      ].join(" "),
    );

    return terms.some((term) => searchable.includes(term));
  }).slice(0, 4);
};

export default function CatalogueItemDialog({
  open,
  onOpenChange,
  moduleId,
  moduleType,
  categoryId,
  editingItem,
}: Props) {
  const themeClasses = useThemeClasses();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const qc = useQueryClient();
  const { data: householdData } = useHouseholdMembers();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const config = MODULE_FIELD_CONFIG[moduleType] || MODULE_FIELD_CONFIG.custom;
  const isDocuments = moduleType === "documents";

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CatalogueItemStatus>("active");
  const [priority, setPriority] = useState<CataloguePriority>("normal");
  const [frequency, setFrequency] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [progressCurrent, setProgressCurrent] = useState("");
  const [progressTarget, setProgressTarget] = useState("");
  const [progressUnit, setProgressUnit] = useState("");
  const [customFields, setCustomFields] = useState<
    Record<string, string | boolean>
  >({});

  // Document-specific state
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [compressedSize, setCompressedSize] = useState<string>("");
  const [belongsTo, setBelongsTo] = useState<string>("");
  const [comboboxOpen, setComboboxOpen] = useState<Record<string, boolean>>({});
  const [uploadingImage, setUploadingImage] = useState(false);

  const isLoading =
    createItem.isPending || updateItem.isPending || uploadingImage;
  const isEditing = !!editingItem;

  // Get module-specific title
  const getDialogTitle = () => {
    if (isEditing)
      return `Edit ${MODULE_TYPE_LABELS[moduleType]?.replace(/s$/, "") || "Item"}`;
    switch (moduleType) {
      case "contacts":
        return "Add Contact";
      case "budget":
        return "Add Wishlist Item";
      case "tasks":
        return "Add Task";
      case "healthcare":
        return "Add Healthcare Entry";
      case "trips":
        return "Add Destination";
      case "fitness":
        return "Add Exercise";
      case "learning":
        return "Add Skill";
      case "recipe":
        return "Add Recipe";
      case "documents":
        return "Add Document";
      case "movies":
        return "Add Movie/Show";
      default:
        return "Add New Item";
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  // Reset form when opening/closing or editing different item
  useEffect(() => {
    if (open) {
      if (editingItem) {
        setName(editingItem.name);
        setDescription(editingItem.description || "");
        setStatus(editingItem.status);
        setPriority(editingItem.priority);
        setFrequency(editingItem.frequency || "");
        setTags(editingItem.tags || []);
        setProgressCurrent(editingItem.progress_current?.toString() || "");
        setProgressTarget(editingItem.progress_target?.toString() || "");
        setProgressUnit(editingItem.progress_unit || "");
        // Load custom fields from metadata_json
        const metadata = editingItem.metadata_json || {};
        const loadedFields: Record<string, string | boolean> = {};
        config.customFields.forEach((field) => {
          if (field.key === "notes") {
            loadedFields[field.key] = editingItem.notes || "";
          } else if (field.type === "checkbox") {
            loadedFields[field.key] = Boolean(metadata[field.key]);
          } else if (metadata[field.key] !== undefined) {
            loadedFields[field.key] = String(metadata[field.key]);
          }
        });
        setCustomFields(loadedFields);
        setBelongsTo((metadata.belongs_to_user_id as string) || "");
      } else {
        setName("");
        setDescription("");
        setStatus("active");
        setPriority("normal");
        setFrequency("");
        setTags([]);
        setTagInput("");
        setProgressCurrent("");
        setProgressTarget("");
        setProgressUnit("");
        setCustomFields({});
        setBelongsTo(householdData?.currentUserId || "");
      }
      setPendingImage(null);
      setImagePreviewUrl(null);
      setCompressedSize("");
      setComboboxOpen({});
    }
  }, [open, editingItem, config.customFields, householdData?.currentUserId]);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleCustomFieldChange = (key: string, value: string | boolean) => {
    setCustomFields((prev) => ({ ...prev, [key]: value }));
  };

  const getCustomFieldString = (key: string) => {
    const value = customFields[key];
    return typeof value === "string" ? value : "";
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressReceiptImage(file);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setPendingImage(compressed);
      setImagePreviewUrl(URL.createObjectURL(compressed));
      setCompressedSize(formatFileSize(compressed.size));
    } catch {
      // silently ignore compression errors — user can retry
    }
    e.target.value = "";
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setPendingImage(null);
    setImagePreviewUrl(null);
    setCompressedSize("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Build metadata_json from custom fields (excluding notes)
    const metadataJson: Record<string, unknown> = {};
    config.customFields.forEach((field) => {
      const rawValue = customFields[field.key];
      if (field.type === "checkbox") {
        metadataJson[field.key] = Boolean(rawValue);
        return;
      }
      if (
        field.key !== "notes" &&
        typeof rawValue === "string" &&
        rawValue.trim()
      ) {
        const value = rawValue.trim();
        if (field.type === "number") {
          metadataJson[field.key] = parseFloat(value);
        } else {
          metadataJson[field.key] = value;
        }
      }
    });
    if (isDocuments && belongsTo) {
      metadataJson.belongs_to_user_id = belongsTo;
    }

    const data = {
      name: name.trim(),
      description: config.showDescription
        ? description.trim() || undefined
        : undefined,
      notes:
        typeof customFields.notes === "string"
          ? customFields.notes.trim() || undefined
          : undefined,
      status: config.showStatus ? status : "active",
      priority: config.showPriority ? priority : "normal",
      frequency: config.showFrequency && frequency ? frequency : undefined,
      tags: config.showTags ? tags : undefined,
      progress_current:
        config.showProgress && progressCurrent
          ? parseFloat(progressCurrent)
          : undefined,
      progress_target:
        config.showProgress && progressTarget
          ? parseFloat(progressTarget)
          : undefined,
      progress_unit:
        config.showProgress && progressUnit.trim()
          ? progressUnit.trim()
          : undefined,
      metadata_json:
        Object.keys(metadataJson).length > 0 ? metadataJson : undefined,
    };

    const uploadImageForItem = async (itemId: string) => {
      if (!pendingImage) return;
      setUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("image", pendingImage, "document.jpg");
        await safeFetch(`/api/catalogue/items/${itemId}/document-image`, {
          method: "POST",
          body: formData,
          timeoutMs: 30_000,
        });
        qc.invalidateQueries({ queryKey: catalogueKeys.items() });
      } finally {
        setUploadingImage(false);
      }
    };

    if (isEditing) {
      updateItem.mutate(
        { id: editingItem.id, ...data },
        {
          onSuccess: async (saved) => {
            await uploadImageForItem(saved.id);
            onOpenChange(false);
          },
        },
      );
    } else {
      const createData: CreateItemInput = {
        module_id: moduleId,
        category_id: categoryId,
        ...data,
      };
      createItem.mutate(createData, {
        onSuccess: async (saved) => {
          await uploadImageForItem(saved.id);
          onOpenChange(false);
        },
      });
    }
  };

  const renderCustomField = (field: (typeof config.customFields)[number]) => {
    const value = getCustomFieldString(field.key);
    const Icon = field.icon;

    if (isDocuments && field.key === "arabic_name") {
      const suggestions = getArabicDocumentSuggestions(
        name,
        getCustomFieldString("document_type"),
        value,
      );

      return (
        <div key={field.key} className="space-y-2">
          <Label className="text-white/70">{field.label}</Label>
          <div className="relative">
            {Icon && (
              <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            )}
            <Input
              value={value}
              onChange={(e) =>
                handleCustomFieldChange(field.key, e.target.value)
              }
              placeholder={field.placeholder}
              dir="auto"
              lang="ar"
              className={cn(
                themeClasses.inputBg,
                "border-white/10 text-white pl-10 text-right",
              )}
            />
          </div>
          {suggestions.length > 0 && (
            <div className="grid gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.englishName}
                  type="button"
                  onClick={() =>
                    handleCustomFieldChange(field.key, suggestion.arabicName)
                  }
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-white/10",
                    themeClasses.inputBg,
                    "border-white/10",
                  )}
                >
                  <span className="text-xs text-white/50">
                    {suggestion.englishName}
                  </span>
                  <span className="font-medium text-white" dir="rtl" lang="ar">
                    {suggestion.arabicName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (field.type === "checkbox") {
      const fieldId = `catalogue-${field.key}`;
      return (
        <div key={field.key} className="space-y-2">
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border px-3 py-3",
              themeClasses.inputBg,
              "border-white/10",
            )}
          >
            <Checkbox
              id={fieldId}
              checked={Boolean(customFields[field.key])}
              onCheckedChange={(checked) =>
                handleCustomFieldChange(field.key, checked === true)
              }
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor={fieldId} className="text-white/80">
                {field.label}
              </Label>
              <p className="text-xs text-white/40">
                Unchecked means an original document is needed.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (field.type === "combobox") {
      const isOpen = comboboxOpen[field.key] ?? false;
      const filteredOptions = (field.options || []).filter(
        (opt) => !value || opt.toLowerCase().includes(value.toLowerCase()),
      );
      return (
        <div key={field.key} className="space-y-2 relative">
          <Label className="text-white/70">{field.label}</Label>
          <Input
            value={value}
            onChange={(e) => {
              handleCustomFieldChange(field.key, e.target.value);
              setComboboxOpen((prev) => ({ ...prev, [field.key]: true }));
            }}
            onFocus={() =>
              setComboboxOpen((prev) => ({ ...prev, [field.key]: true }))
            }
            onBlur={() =>
              setTimeout(
                () =>
                  setComboboxOpen((prev) => ({ ...prev, [field.key]: false })),
                120,
              )
            }
            placeholder={field.placeholder}
            className={cn(themeClasses.inputBg, "border-white/10 text-white")}
          />
          {isOpen && filteredOptions.length > 0 && (
            <div
              className={cn(
                "absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-lg shadow-xl",
                themeClasses.bgPage,
                themeClasses.border,
              )}
            >
              {filteredOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleCustomFieldChange(field.key, opt);
                    setComboboxOpen((prev) => ({
                      ...prev,
                      [field.key]: false,
                    }));
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition-colors"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <div key={field.key} className="space-y-2">
          <Label className="text-white/70">{field.label}</Label>
          <Select
            value={value}
            onValueChange={(v) => handleCustomFieldChange(field.key, v)}
          >
            <SelectTrigger
              className={cn(themeClasses.inputBg, "border-white/10 text-white")}
            >
              <SelectValue
                placeholder={`Select ${field.label.toLowerCase()}...`}
              />
            </SelectTrigger>
            <SelectContent
              className={cn(themeClasses.modalBg, themeClasses.border)}
            >
              {field.options?.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-white">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <div key={field.key} className="space-y-2">
          <Label className="text-white/70">{field.label}</Label>
          <Textarea
            value={value}
            onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={cn(
              themeClasses.inputBg,
              "border-white/10 text-white min-h-[80px]",
            )}
          />
        </div>
      );
    }

    return (
      <div key={field.key} className="space-y-2">
        <Label className="text-white/70">{field.label}</Label>
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          )}
          <Input
            type={field.type === "number" ? "text" : field.type}
            inputMode={field.type === "number" ? "decimal" : undefined}
            value={value}
            onChange={(e) => handleCustomFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={cn(
              themeClasses.inputBg,
              "border-white/10 text-white",
              Icon && "pl-10",
            )}
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-lg max-h-[90vh] overflow-y-auto",
          themeClasses.modalBg,
          themeClasses.border,
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            {moduleType === "contacts" && <User className="w-5 h-5" />}
            {getDialogTitle()}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name - Always shown */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white/70">
              {config.nameLabel} <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={config.namePlaceholder}
              className={cn(themeClasses.inputBg, "border-white/10 text-white")}
              autoFocus
            />
          </div>

          {/* Description - Conditional */}
          {config.showDescription && (
            <div className="space-y-2">
              <Label htmlFor="description" className="text-white/70">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                className={cn(
                  themeClasses.inputBg,
                  "border-white/10 text-white min-h-[60px]",
                )}
              />
            </div>
          )}

          {/* Status and Priority - Conditional */}
          {(config.showStatus || config.showPriority) && (
            <div
              className={cn(
                "grid gap-4",
                config.showStatus && config.showPriority
                  ? "grid-cols-2"
                  : "grid-cols-1",
              )}
            >
              {config.showStatus && (
                <div className="space-y-2">
                  <Label className="text-white/70">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as CatalogueItemStatus)}
                  >
                    <SelectTrigger
                      className={cn(
                        themeClasses.inputBg,
                        "border-white/10 text-white",
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      className={cn(themeClasses.modalBg, themeClasses.border)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="text-white">
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {config.showPriority && (
                <div className="space-y-2">
                  <Label className="text-white/70">Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => setPriority(v as CataloguePriority)}
                  >
                    <SelectTrigger
                      className={cn(
                        themeClasses.inputBg,
                        "border-white/10 text-white",
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      className={cn(themeClasses.modalBg, themeClasses.border)}
                    >
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p} className="text-white">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: PRIORITY_COLORS[p] }}
                            />
                            {PRIORITY_LABELS[p]}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Frequency - Conditional */}
          {config.showFrequency && (
            <div className="space-y-2">
              <Label className="text-white/70">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger
                  className={cn(
                    themeClasses.inputBg,
                    "border-white/10 text-white",
                  )}
                >
                  <SelectValue placeholder="How often?" />
                </SelectTrigger>
                <SelectContent
                  className={cn(themeClasses.modalBg, themeClasses.border)}
                >
                  {FREQUENCY_OPTIONS.map((f) => (
                    <SelectItem
                      key={f.value}
                      value={f.value}
                      className="text-white"
                    >
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Module-specific custom fields */}
          {config.customFields.map(renderCustomField)}

          {/* Progress tracking - Conditional */}
          {config.showProgress && (
            <div className="space-y-2">
              <Label className="text-white/70">Progress Tracking</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={progressCurrent}
                  onChange={(e) => setProgressCurrent(e.target.value)}
                  placeholder="Current"
                  className={cn(
                    themeClasses.inputBg,
                    "border-white/10 text-white",
                  )}
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  value={progressTarget}
                  onChange={(e) => setProgressTarget(e.target.value)}
                  placeholder="Target"
                  className={cn(
                    themeClasses.inputBg,
                    "border-white/10 text-white",
                  )}
                />
                <Input
                  value={progressUnit}
                  onChange={(e) => setProgressUnit(e.target.value)}
                  placeholder="Unit ($, %)"
                  className={cn(
                    themeClasses.inputBg,
                    "border-white/10 text-white",
                  )}
                />
              </div>
            </div>
          )}

          {/* Document image upload */}
          {isDocuments && (
            <div className="space-y-2">
              <Label className="text-white/70">Document Photo</Label>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageSelect}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              {imagePreviewUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt="Document preview"
                    className="w-full max-h-48 object-contain bg-black/20"
                  />
                  {compressedSize && (
                    <div className="absolute bottom-2 right-2 bg-black/60 rounded-lg px-2 py-1 text-xs text-white/70">
                      {compressedSize}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-red-500/80 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all active:scale-[0.98]",
                      themeClasses.inputBg,
                      "border-white/10 hover:border-white/30",
                    )}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5">
                      <Camera className="w-5 h-5 text-white/60" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">
                        Take Photo
                      </p>
                      <p className="text-xs text-white/40">
                        Use rear camera for best quality
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-4 rounded-xl border transition-all active:scale-[0.98]",
                      themeClasses.inputBg,
                      "border-white/10 hover:border-white/30",
                    )}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5">
                      <ImageIcon className="w-5 h-5 text-white/60" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">
                        Choose from Gallery
                      </p>
                      <p className="text-xs text-white/40">
                        Select an existing photo
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Belongs to — documents only, shown when household partner exists */}
          {isDocuments && householdData && householdData.members.length > 1 && (
            <div className="space-y-2">
              <Label className="text-white/70">Belongs to</Label>
              <div className="flex gap-2">
                {householdData.members.map((member) => {
                  const isSelected = belongsTo === member.id;
                  const isCurrentUser = member.isCurrentUser;
                  const accentColor = isCurrentUser ? "blue" : "pink";
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setBelongsTo(member.id)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all",
                        isSelected
                          ? accentColor === "blue"
                            ? "bg-blue-500/20 border-blue-400/60 text-blue-300"
                            : "bg-pink-500/20 border-pink-400/60 text-pink-300"
                          : "border-white/10 text-white/50 hover:border-white/30",
                      )}
                    >
                      <User className="w-3.5 h-3.5 inline mr-1.5" />
                      {member.displayName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags - Conditional */}
          {config.showTags && (
            <div className="space-y-2">
              <Label className="text-white/70">Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add tag..."
                  className={cn(
                    themeClasses.inputBg,
                    "border-white/10 text-white flex-1",
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddTag}
                  className="border-white/10"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 rounded-full text-sm text-white"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-white/70"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="bg-gradient-to-r from-primary to-primary/80 text-white"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing
                ? "Save Changes"
                : moduleType === "contacts"
                  ? "Add Contact"
                  : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
