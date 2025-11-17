"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowLeft, Sparkles, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Transaction = {
  id: string;
  date: string;
  category: string | null;
  subcategory: string | null;
  amount: number;
  description: string | null;
  account_id: string;
  account_name?: string;
  category_icon?: string;
};

type Props = {
  category: string;
  transactions: Transaction[];
  totalAmount: number;
  onBack: () => void;
  onTransactionClick: (tx: Transaction) => void;
};

export default function CategoryDetailView({
  category,
  transactions,
  totalAmount,
  onBack,
  onTransactionClick,
}: Props) {
  const categoryIcon = transactions[0]?.category_icon || "📁";
  const [theme, setTheme] = useState<"blue" | "pink">("blue");
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const colorTheme = localStorage.getItem("color-theme") || "blue";
    setTheme(colorTheme as "blue" | "pink");
  }, []);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      onBack();
    }, 400);
  };

  const themeColors = {
    blue: {
      primary: "cyan",
      primaryHex: "#06b6d4",
      secondary: "#38bdf8",
      gradient: "from-cyan-500 via-blue-500 to-blue-600",
      cardBg: "bg-cyan-500/5",
      cardBorder: "border-cyan-500/30",
      textPrimary: "text-cyan-400",
      textSecondary: "text-blue-300",
      glow: "shadow-cyan-500/50",
    },
    pink: {
      primary: "pink",
      primaryHex: "#f472b6",
      secondary: "#f9a8d4",
      gradient: "from-pink-400 via-rose-500 to-pink-600",
      cardBg: "bg-pink-500/5",
      cardBorder: "border-pink-500/30",
      textPrimary: "text-pink-400",
      textSecondary: "text-rose-300",
      glow: "shadow-pink-500/50",
    },
  };

  const colors = themeColors[theme];

  const stats = useMemo(() => {
    const bySubcategory = transactions.reduce(
      (acc, t) => {
        const sub = t.subcategory || "Other";
        acc[sub] = (acc[sub] || 0) + t.amount;
        return acc;
      },
      {} as Record<string, number>
    );

    const byAccount = transactions.reduce(
      (acc, t) => {
        const acct = t.account_name || "Unknown";
        acc[acct] = (acc[acct] || 0) + t.amount;
        return acc;
      },
      {} as Record<string, number>
    );

    const sortedByDate = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return {
      bySubcategory,
      byAccount,
      avgTransaction: totalAmount / transactions.length,
      count: transactions.length,
      recent: sortedByDate.slice(0, 5),
    };
  }, [transactions, totalAmount]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-[#0a1628] overflow-hidden",
        theme === "pink" && "bg-[#1a0a14]",
        isExiting ? "slide-out-blurred-left" : "slide-in-blurred-right"
      )}
      style={
        {
          "--glow-color":
            theme === "blue"
              ? "rgba(6, 182, 212, 0.3)"
              : "rgba(244, 114, 182, 0.3)",
        } as React.CSSProperties
      }
    >
      {/* Futuristic Background Grid */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${colors.primaryHex} 1px, transparent 1px), linear-gradient(90deg, ${colors.primaryHex} 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
            animation: "backgroundScroll 20s linear infinite",
          }}
        />
      </div>

      <style jsx>{`
        @keyframes backgroundScroll {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(50px, 50px);
          }
        }
      `}</style>

      {/* Header with Glass Morphism */}
      <div
        className={cn(
          "sticky top-0 z-30 backdrop-blur-xl border-b px-3 py-4",
          theme === "blue"
            ? "bg-[#1a2942]/80 border-cyan-500/20"
            : "bg-[#2d1b29]/80 border-pink-500/20"
        )}
      >
        <button
          onClick={handleBack}
          className={cn(
            "flex items-center gap-2 mb-3 px-4 py-2 rounded-lg transition-all duration-300 group",
            theme === "blue"
              ? "text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              : "text-pink-400 hover:text-pink-300 hover:bg-pink-500/10"
          )}
        >
          <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-medium">Back to Dashboard</span>
        </button>

        <div className="flex items-center gap-4">
          <div
            className={cn(
              "relative p-3 rounded-xl scale-in-center",
              colors.cardBg,
              colors.cardBorder,
              "border glow-pulse"
            )}
          >
            <span className="text-5xl">{categoryIcon}</span>
            <Sparkles
              className={cn(
                "absolute -top-1 -right-1 w-4 h-4",
                colors.textPrimary,
                "animate-pulse"
              )}
            />
          </div>
          <div className="fade-in-expand">
            <h1 className={cn("text-2xl font-bold text-white mb-1")}>
              {category}
            </h1>
            <p className={cn("text-sm", colors.textSecondary)}>
              {stats.count} transaction{stats.count !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto h-[calc(100vh-140px)] p-3 space-y-4 pb-20">
        {/* Summary Cards with Stagger Animation */}
        <div className="grid grid-cols-2 gap-3">
          <Card
            className={cn(
              "neo-card p-4 border backdrop-blur-sm scale-in-center",
              colors.cardBorder,
              colors.cardBg,
              `bg-gradient-to-br ${colors.gradient} bg-opacity-10`
            )}
            style={{ animationDelay: "0.1s" }}
          >
            <p className={cn("text-xs mb-1", colors.textSecondary)}>
              Total Spent
            </p>
            <div className="flex items-center gap-2">
              <p className={cn("text-2xl font-bold", colors.textPrimary)}>
                ${totalAmount.toFixed(2)}
              </p>
              <Zap
                className={cn("w-5 h-5", colors.textPrimary, "animate-pulse")}
              />
            </div>
          </Card>

          <Card
            className={cn(
              "neo-card p-4 border backdrop-blur-sm scale-in-center",
              theme === "blue"
                ? "border-blue-500/20 bg-blue-500/5"
                : "border-rose-500/20 bg-rose-500/5"
            )}
            style={{ animationDelay: "0.2s" }}
          >
            <p className={cn("text-xs mb-1", colors.textSecondary)}>
              Avg per Transaction
            </p>
            <p className="text-2xl font-bold text-white">
              ${stats.avgTransaction.toFixed(2)}
            </p>
          </Card>
        </div>

        {/* By Subcategory */}
        {Object.keys(stats.bySubcategory).length > 1 && (
          <Card
            className={cn(
              "neo-card p-4 border backdrop-blur-sm scale-in-center",
              theme === "blue"
                ? "border-blue-500/20 bg-blue-500/5"
                : "border-rose-500/20 bg-rose-500/5"
            )}
            style={{ animationDelay: "0.3s" }}
          >
            <h3
              className={cn(
                "text-sm font-semibold mb-3 flex items-center gap-2",
                colors.textPrimary
              )}
            >
              <Sparkles className="w-4 h-4" />
              By Subcategory
            </h3>
            <div className="space-y-2">
              {Object.entries(stats.bySubcategory)
                .sort((a, b) => b[1] - a[1])
                .map(([sub, amt], index) => (
                  <div
                    key={sub}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg transition-all hover:scale-105 cursor-pointer",
                      theme === "blue"
                        ? "bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20"
                        : "bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20",
                      "fade-in-expand"
                    )}
                    style={{ animationDelay: `${0.4 + index * 0.1}s` }}
                  >
                    <span className="text-sm text-white font-medium">
                      {sub}
                    </span>
                    <span
                      className={cn("text-sm font-bold", colors.textPrimary)}
                    >
                      ${amt.toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        )}

        {/* By Account */}
        <Card
          className={cn(
            "neo-card p-4 border backdrop-blur-sm scale-in-center",
            theme === "blue"
              ? "border-blue-500/20 bg-blue-500/5"
              : "border-rose-500/20 bg-rose-500/5"
          )}
          style={{ animationDelay: "0.5s" }}
        >
          <h3
            className={cn(
              "text-sm font-semibold mb-3 flex items-center gap-2",
              colors.textPrimary
            )}
          >
            <Zap className="w-4 h-4" />
            By Account
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.byAccount)
              .sort((a, b) => b[1] - a[1])
              .map(([acct, amt], index) => (
                <div
                  key={acct}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg transition-all hover:scale-105",
                    theme === "blue"
                      ? "bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20"
                      : "bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20",
                    "fade-in-expand"
                  )}
                  style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                >
                  <span className="text-sm text-white font-medium">{acct}</span>
                  <span className={cn("text-sm font-bold", colors.textPrimary)}>
                    ${amt.toFixed(2)}
                  </span>
                </div>
              ))}
          </div>
        </Card>

        {/* All Transactions */}
        <Card
          className={cn(
            "neo-card p-4 border backdrop-blur-sm scale-in-center",
            theme === "blue"
              ? "border-cyan-500/20 bg-cyan-500/5"
              : "border-pink-500/20 bg-pink-500/5"
          )}
          style={{ animationDelay: "0.7s" }}
        >
          <h3
            className={cn(
              "text-sm font-semibold mb-3 flex items-center gap-2",
              colors.textPrimary
            )}
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            All Transactions
          </h3>
          <div className="space-y-2">
            {transactions
              .sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime()
              )
              .map((tx, index) => (
                <div
                  key={tx.id}
                  onClick={() => onTransactionClick(tx)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:scale-105 group",
                    theme === "blue"
                      ? "bg-blue-500/5 hover:bg-blue-500/15 border-blue-500/20 hover:border-cyan-500/40"
                      : "bg-pink-500/5 hover:bg-pink-500/15 border-pink-500/20 hover:border-pink-500/40",
                    "fade-in-expand"
                  )}
                  style={{ animationDelay: `${0.8 + index * 0.05}s` }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {tx.subcategory || category}
                    </p>
                    <div
                      className={cn(
                        "flex items-center gap-2 text-xs mt-1",
                        colors.textSecondary
                      )}
                    >
                      <span>{format(new Date(tx.date), "MMM d, yyyy")}</span>
                      <span>•</span>
                      <span>{tx.account_name}</span>
                    </div>
                    {tx.description && (
                      <p
                        className={cn(
                          "text-xs mt-1 truncate opacity-70",
                          colors.textSecondary
                        )}
                      >
                        {tx.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "text-base font-bold ml-3",
                        colors.textPrimary
                      )}
                    >
                      ${tx.amount.toFixed(2)}
                    </p>
                    <div
                      className={cn(
                        "w-1 h-1 rounded-full transition-all group-hover:w-2 group-hover:h-2",
                        theme === "blue" ? "bg-cyan-400" : "bg-pink-400"
                      )}
                    />
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
