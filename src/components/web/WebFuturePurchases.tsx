"use client";

import { Card } from "@/components/ui/card";
import {
  useAllocateSavings,
  useCreateFuturePurchase,
  useDeleteFuturePurchase,
  useFuturePurchases,
  useSpendingAnalysis,
} from "@/features/future-purchases/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import {
  PURCHASE_COLORS,
  PURCHASE_ICONS,
  URGENCY_COLORS,
  URGENCY_LABELS,
  type CreateFuturePurchaseInput,
  type FuturePurchase,
  type UrgencyLevel,
} from "@/types/futurePurchase";
import { differenceInDays, differenceInMonths, format } from "date-fns";
import {
  AlertCircle,
  BookOpen,
  Camera,
  Car,
  Clock,
  DollarSign,
  Dumbbell,
  Gamepad2,
  Gift,
  Headphones,
  Heart,
  Home,
  Laptop,
  Monitor,
  Package,
  PiggyBank,
  Plane,
  Plus,
  Rocket,
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Watch,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

// Icon mapping
const ICON_COMPONENTS: Record<string, any> = {
  monitor: Monitor,
  laptop: Laptop,
  smartphone: Smartphone,
  headphones: Headphones,
  camera: Camera,
  car: Car,
  home: Home,
  plane: Plane,
  gift: Gift,
  gamepad: Gamepad2,
  watch: Watch,
  shirt: Shirt,
  sofa: Sofa,
  dumbbell: Dumbbell,
  book: BookOpen,
  heart: Heart,
  package: Package,
};

type ViewMode = "grid" | "detail";

export default function WebFuturePurchases() {
  const themeClasses = useThemeClasses();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] =
    useState<FuturePurchase | null>(null);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocateAmount, setAllocateAmount] = useState("");

  const { data: purchases = [], isLoading } = useFuturePurchases("active");
  const { data: spendingAnalysis } = useSpendingAnalysis();
  const createMutation = useCreateFuturePurchase();
  const deleteMutation = useDeleteFuturePurchase();
  const allocateMutation = useAllocateSavings();

  // Stats
  const totalGoalAmount = purchases.reduce(
    (sum, p) => sum + p.target_amount,
    0
  );
  const totalSaved = purchases.reduce((sum, p) => sum + p.current_saved, 0);
  const totalRecommendedMonthly = purchases.reduce(
    (sum, p) => sum + p.recommended_monthly_savings,
    0
  );
  const overallProgress =
    totalGoalAmount > 0 ? (totalSaved / totalGoalAmount) * 100 : 0;

  // Calculate available monthly surplus after existing goals
  const availableMonthlySurplus = useMemo(() => {
    if (!spendingAnalysis) return null;
    return Math.max(
      0,
      spendingAnalysis.averageMonthlySurplus - totalRecommendedMonthly
    );
  }, [spendingAnalysis, totalRecommendedMonthly]);

  const handleAllocate = () => {
    if (!selectedPurchase || !allocateAmount) return;
    const amount = parseFloat(allocateAmount);
    if (isNaN(amount) || amount <= 0) return;

    allocateMutation.mutate({
      id: selectedPurchase.id,
      amount,
    });
    setShowAllocateModal(false);
    setAllocateAmount("");
    setSelectedPurchase(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this purchase goal?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className={`min-h-full ${themeClasses.pageBg} p-6`}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-64 ${themeClasses.surfaceBg} rounded-2xl animate-pulse`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-full ${themeClasses.pageBg}`}>
      {/* Animated Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-transparent to-cyan-600/20" />
        <div className="absolute inset-0">
          {/* Animated particles */}
          <div className="absolute top-10 left-10 w-2 h-2 bg-violet-400 rounded-full animate-ping" />
          <div
            className="absolute top-20 right-20 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping"
            style={{ animationDelay: "0.5s" }}
          />
          <div
            className="absolute bottom-10 left-1/3 w-1 h-1 bg-pink-400 rounded-full animate-ping"
            style={{ animationDelay: "1s" }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-xl blur-lg opacity-50 animate-pulse" />
                <div className="relative p-3 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-xl">
                  <Rocket className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent animate-gradient bg-300%">
                  Future Purchases
                </h1>
                <p className={`text-sm ${themeClasses.textMuted}`}>
                  Plan your dreams, track your progress
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="group relative flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-cyan-600 opacity-100 group-hover:opacity-80 transition-opacity" />
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
              <Plus className="relative w-5 h-5 text-white" />
              <span className="relative text-sm font-semibold text-white">
                New Goal
              </span>
            </button>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="neo-card p-4 bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-500/20 backdrop-blur-sm">
                  <Target className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-violet-300/70">Total Goals</p>
                  <p className="text-xl font-bold text-violet-400">
                    {purchases.length}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="neo-card p-4 bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/20 backdrop-blur-sm">
                  <DollarSign className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-cyan-300/70">Target Amount</p>
                  <p className="text-xl font-bold text-cyan-400">
                    ${totalGoalAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="neo-card p-4 bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 backdrop-blur-sm">
                  <PiggyBank className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-emerald-300/70">Saved So Far</p>
                  <p className="text-xl font-bold text-emerald-400">
                    ${totalSaved.toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="neo-card p-4 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 backdrop-blur-sm">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-amber-300/70">Monthly Target</p>
                  <p className="text-xl font-bold text-amber-400">
                    ${totalRecommendedMonthly.toFixed(0)}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Overall Progress Bar */}
          {purchases.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Overall Progress</span>
                <span className="text-sm font-bold text-cyan-400">
                  {overallProgress.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 bg-slate-800/50 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500 transition-all duration-1000 relative overflow-hidden"
                  style={{ width: `${Math.min(100, overallProgress)}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Purchase Goals Grid */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {purchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full blur-2xl opacity-30 animate-pulse" />
              <div className="relative p-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-full border border-slate-700">
                <Sparkles className="w-12 h-12 text-violet-400" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Start Planning Your Future
            </h3>
            <p className="text-slate-400 text-center max-w-md mb-6">
              Add your first purchase goal and let the system help you save
              smartly based on your spending patterns.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-xl text-white font-semibold hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-300"
            >
              <Plus className="w-5 h-5" />
              Create Your First Goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {purchases.map((purchase) => (
              <PurchaseCard
                key={purchase.id}
                purchase={purchase}
                onAllocate={() => {
                  setSelectedPurchase(purchase);
                  setShowAllocateModal(true);
                }}
                onDelete={() => handleDelete(purchase.id)}
                themeClasses={themeClasses}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddPurchaseModal
          onClose={() => setShowAddModal(false)}
          onSubmit={(data) => {
            createMutation.mutate(data);
            setShowAddModal(false);
          }}
          themeClasses={themeClasses}
          availableSurplus={availableMonthlySurplus}
          averageSurplus={spendingAnalysis?.averageMonthlySurplus}
        />
      )}

      {/* Allocate Modal */}
      {showAllocateModal && selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={`relative w-full max-w-md p-6 rounded-2xl ${themeClasses.dialogBg} border border-cyan-500/20 shadow-2xl`}
          >
            <button
              onClick={() => {
                setShowAllocateModal(false);
                setAllocateAmount("");
              }}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-emerald-500/20">
                <PiggyBank className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Allocate Savings
                </h3>
                <p className="text-sm text-slate-400">
                  {selectedPurchase.name}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/50">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Progress</span>
                  <span className="text-emerald-400 font-medium">
                    ${selectedPurchase.current_saved.toLocaleString()} / $
                    {selectedPurchase.target_amount.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all"
                    style={{
                      width: `${(selectedPurchase.current_saved / selectedPurchase.target_amount) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Amount to Save
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>
                  <input
                    type="number"
                    value={allocateAmount}
                    onChange={(e) => setAllocateAmount(e.target.value)}
                    placeholder="0.00"
                    className={`w-full pl-8 pr-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all`}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Recommended monthly: $
                  {selectedPurchase.recommended_monthly_savings.toFixed(0)}
                </p>
              </div>

              <button
                onClick={handleAllocate}
                disabled={!allocateAmount || parseFloat(allocateAmount) <= 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
              >
                Save Now
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        @keyframes gradient {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
        .bg-300\% {
          background-size: 300% 300%;
        }
      `}</style>
    </div>
  );
}

// Purchase Card Component
function PurchaseCard({
  purchase,
  onAllocate,
  onDelete,
  themeClasses,
}: {
  purchase: FuturePurchase;
  onAllocate: () => void;
  onDelete: () => void;
  themeClasses: ReturnType<typeof useThemeClasses>;
}) {
  const IconComponent = ICON_COMPONENTS[purchase.icon] || Package;
  const progress = (purchase.current_saved / purchase.target_amount) * 100;
  const remaining = purchase.target_amount - purchase.current_saved;
  const daysLeft = differenceInDays(new Date(purchase.target_date), new Date());
  const monthsLeft = differenceInMonths(
    new Date(purchase.target_date),
    new Date()
  );
  const urgencyColor = URGENCY_COLORS[purchase.urgency as UrgencyLevel];

  return (
    <Card className="group relative overflow-hidden neo-card border border-slate-700/50 hover:border-cyan-500/30 transition-all duration-500">
      {/* Background glow effect */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${purchase.color}20, transparent 70%)`,
        }}
      />

      {/* Urgency indicator */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{
          background: `linear-gradient(90deg, ${urgencyColor}, transparent)`,
        }}
      />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-xl transition-transform duration-300 group-hover:scale-110"
              style={{ backgroundColor: `${purchase.color}20` }}
            >
              <IconComponent
                className="w-6 h-6"
                style={{ color: purchase.color }}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-cyan-300 transition-colors">
                {purchase.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: `${urgencyColor}20`,
                    color: urgencyColor,
                  }}
                >
                  {URGENCY_LABELS[purchase.urgency as UrgencyLevel]}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Progress</span>
            <span
              className="text-sm font-bold"
              style={{ color: purchase.color }}
            >
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="relative h-3 bg-slate-800/50 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min(100, progress)}%`,
                background: `linear-gradient(90deg, ${purchase.color}, ${purchase.color}cc)`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-slate-800/30">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-slate-400">Saved</span>
            </div>
            <p className="text-lg font-bold text-emerald-400">
              ${purchase.current_saved.toLocaleString()}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/30">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs text-slate-400">Remaining</span>
            </div>
            <p className="text-lg font-bold text-cyan-400">
              ${remaining.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-400">
              {daysLeft > 0
                ? monthsLeft > 1
                  ? `${monthsLeft} months left`
                  : `${daysLeft} days left`
                : "Overdue"}
            </span>
          </div>
          <button
            onClick={onAllocate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600/20 to-cyan-600/20 border border-cyan-500/30 text-cyan-400 text-sm font-medium hover:from-violet-600/30 hover:to-cyan-600/30 transition-all"
          >
            <PiggyBank className="w-4 h-4" />
            Save
          </button>
        </div>

        {/* Monthly Recommendation */}
        <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-500/20">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-400">Recommended monthly:</span>
            <span className="text-sm font-bold text-amber-400">
              ${purchase.recommended_monthly_savings.toFixed(0)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Add Purchase Modal
function AddPurchaseModal({
  onClose,
  onSubmit,
  themeClasses,
  availableSurplus,
  averageSurplus,
}: {
  onClose: () => void;
  onSubmit: (data: CreateFuturePurchaseInput) => void;
  themeClasses: ReturnType<typeof useThemeClasses>;
  availableSurplus?: number | null;
  averageSurplus?: number;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>(3);
  const [targetDate, setTargetDate] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("package");
  const [selectedColor, setSelectedColor] = useState<string>(
    PURCHASE_COLORS[0]
  );

  // Calculate recommended monthly savings based on input
  // Urgency affects HOW savings are distributed (front-loading), not the total
  const calculateRecommendation = () => {
    if (!targetAmount || !targetDate) return null;
    const amount = parseFloat(targetAmount);
    const months = differenceInMonths(new Date(targetDate), new Date());
    if (months <= 0) return null;

    // Base savings (total / months)
    const baseMonthlySavings = amount / months;

    // Urgency-based allocation plan
    let firstMonthSavings = baseMonthlySavings;
    let laterMonthSavings = baseMonthlySavings;
    let allocationDescription = "Evenly distributed";

    if (urgency >= 4) {
      // HIGH/CRITICAL: Front-load 60-70% in first half
      const frontLoadPct = urgency === 5 ? 0.7 : 0.6;
      const firstHalfMonths = Math.ceil(months / 2);
      const secondHalfMonths = months - firstHalfMonths;

      firstMonthSavings = (amount * frontLoadPct) / firstHalfMonths;
      laterMonthSavings = (amount * (1 - frontLoadPct)) / secondHalfMonths;
      allocationDescription = `${(frontLoadPct * 100).toFixed(0)}% in first ${firstHalfMonths} months`;
    } else if (urgency >= 2) {
      // MEDIUM: Slight front-load 55%
      const frontLoadPct = 0.55;
      const firstHalfMonths = Math.ceil(months / 2);
      const secondHalfMonths = months - firstHalfMonths;

      firstMonthSavings = (amount * frontLoadPct) / firstHalfMonths;
      laterMonthSavings = (amount * (1 - frontLoadPct)) / secondHalfMonths;
      allocationDescription = `55% in first ${firstHalfMonths} months`;
    }

    const surplus = averageSurplus ?? 0;
    const isFeasible = firstMonthSavings <= surplus;

    return {
      firstMonthSavings,
      laterMonthSavings,
      baseMonthlySavings,
      months,
      isFeasible,
      allocationDescription,
      totalAmount: amount,
    };
  };

  const recommendation = calculateRecommendation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount || !targetDate) return;

    onSubmit({
      name,
      description: description || undefined,
      target_amount: parseFloat(targetAmount),
      urgency,
      target_date: targetDate,
      icon: selectedIcon,
      color: selectedColor,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-2xl ${themeClasses.dialogBg} border border-violet-500/20 shadow-2xl`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-r from-violet-500/20 to-cyan-500/20">
            <Rocket className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              New Purchase Goal
            </h3>
            <p className="text-sm text-slate-400">
              Plan your next big purchase
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              What do you want to buy?
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., New Monitor"
              className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details about this purchase..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all resize-none"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Target Budget
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                $
              </span>
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                required
              />
            </div>
          </div>

          {/* Target Date */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              When do you want it?
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd")}
              className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              required
            />
          </div>

          {/* Smart Savings Insight */}
          {(recommendation || averageSurplus !== undefined) && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-500/20 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium text-violet-300">
                  Smart Savings Insight
                </span>
              </div>

              {averageSurplus !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">
                    Your average monthly surplus:
                  </span>
                  <span className="font-semibold text-cyan-400">
                    ${averageSurplus.toFixed(2)}
                  </span>
                </div>
              )}

              {recommendation && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                      Base monthly savings:
                    </span>
                    <span className="text-slate-300">
                      ${recommendation.baseMonthlySavings.toFixed(2)}/mo
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Even distribution:</span>
                    <span className="text-slate-500">
                      ${recommendation.baseMonthlySavings.toFixed(2)}/mo
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                      {URGENCY_LABELS[urgency]} urgency plan:
                    </span>
                    <span className="text-violet-400 font-medium text-xs">
                      {recommendation.allocationDescription}
                    </span>
                  </div>

                  <div className="space-y-1 bg-slate-800/30 p-3 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">
                        First month{recommendation.months > 2 ? "s" : ""}:
                      </span>
                      <span
                        className={cn(
                          "font-semibold",
                          recommendation.isFeasible
                            ? "text-emerald-400"
                            : "text-amber-400"
                        )}
                      >
                        ${recommendation.firstMonthSavings.toFixed(2)}/mo
                      </span>
                    </div>
                    {recommendation.firstMonthSavings !==
                      recommendation.laterMonthSavings && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Later months:</span>
                        <span className="text-cyan-400 font-medium">
                          ${recommendation.laterMonthSavings.toFixed(2)}/mo
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/50">
                      <span className="text-slate-500">Total saved:</span>
                      <span className="text-white font-medium">
                        ${recommendation.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Time to goal:</span>
                    <span className="text-white">
                      {recommendation.months} months
                    </span>
                  </div>

                  {recommendation.isFeasible ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg">
                      <TrendingUp className="w-4 h-4" />
                      <span>This goal looks achievable! 🎯</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg">
                      <AlertCircle className="w-4 h-4" />
                      <span>
                        Consider extending the date, reducing urgency, or the
                        amount
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Urgency */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              How urgent is this?
            </label>
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as UrgencyLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setUrgency(level)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                    urgency === level ? "ring-2" : "hover:opacity-80"
                  )}
                  style={{
                    backgroundColor: `${URGENCY_COLORS[level]}20`,
                    color: URGENCY_COLORS[level],
                    ...(urgency === level && {
                      boxShadow: `0 0 0 2px ${URGENCY_COLORS[level]}`,
                    }),
                  }}
                >
                  {URGENCY_LABELS[level]}
                </button>
              ))}
            </div>
            {urgency >= 4 && (
              <p className="text-xs text-violet-400 mt-2">
                💡 High urgency = save more upfront to reach your goal faster
              </p>
            )}
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Choose an icon
            </label>
            <div className="grid grid-cols-6 gap-2">
              {PURCHASE_ICONS.map((icon) => {
                const Icon = ICON_COMPONENTS[icon.id] || Package;
                return (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => setSelectedIcon(icon.id)}
                    className={cn(
                      "p-3 rounded-xl transition-all",
                      selectedIcon === icon.id
                        ? "bg-violet-500/30 ring-2 ring-violet-500"
                        : "bg-slate-800/50 hover:bg-slate-700/50"
                    )}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: selectedColor }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Pick a color
            </label>
            <div className="flex flex-wrap gap-2">
              {PURCHASE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    selectedColor === color
                      ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110"
                      : "hover:scale-105"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-semibold hover:shadow-lg hover:shadow-violet-500/25 transition-all"
          >
            Create Goal
          </button>
        </form>
      </div>
    </div>
  );
}
