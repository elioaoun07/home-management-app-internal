"use client";

import {
  ArrowLeftIcon,
  SparklesIcon,
  ZapIcon,
} from "@/components/icons/FuturisticIcons";
import { Card } from "@/components/ui/card";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/utils/getCategoryIcon";
import { format } from "date-fns";
import { useMemo, useState } from "react";

type Transaction = {
  id: string;
  date: string;
  category: string | null;
  subcategory: string | null;
  amount: number;
  description: string | null;
  account_id: string;
  inserted_at: string;
  account_name?: string;
  category_color?: string;
  is_owner?: boolean;
};

type Props = {
  category: string;
  categoryColor?: string;
  transactions: Transaction[];
  totalAmount: number;
  onBack: () => void;
  onTransactionClick: (tx: Transaction) => void;
};

export default function CategoryDetailView({
  category,
  categoryColor,
  transactions,
  totalAmount,
  onBack,
  onTransactionClick,
}: Props) {
  const themeClasses = useThemeClasses();

  // Use category color or fallback to theme color
  const iconColor = categoryColor || themeClasses.defaultAccentColor;
  const iconGlowStyle = categoryColor
    ? `drop-shadow(0 0 8px ${categoryColor}80)`
    : undefined;
  const [isExiting, setIsExiting] = useState(false);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      onBack();
    }, 400);
  };

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
        "min-h-screen bg-bg-dark relative",
        isExiting ? "slide-out-blurred-left" : "slide-in-blurred-right"
      )}
      style={
        {
          "--glow-color": "var(--secondary)",
        } as React.CSSProperties
      }
    >
      {/* Futuristic Background Grid */}
      <div className="fixed inset-0 top-14 opacity-10 pointer-events-none z-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(var(--secondary) 1px, transparent 1px), linear-gradient(90deg, var(--secondary) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Header with Glass Morphism */}
      <div
        className={cn(
          "sticky top-0 z-30 backdrop-blur-xl border-b px-3 py-15 bg-bg-card-custom/90",
          themeClasses.border
        )}
      >
        <button
          onClick={handleBack}
          className={cn(
            "flex items-center gap-2 mb-3 px-4 py-2.5 rounded-lg transition-all duration-300 group shadow-md hover:shadow-lg bg-secondary/10 hover:bg-secondary/20 border",
            themeClasses.text,
            themeClasses.textHover,
            themeClasses.border
          )}
        >
          <ArrowLeftIcon
            className={cn(
              "w-5 h-5 transition-transform group-hover:-translate-x-1",
              themeClasses.glow
            )}
          />
          <span className="text-sm font-semibold">Back to Dashboard</span>
        </button>

        <div className="flex items-center gap-4">
          <div
            className="relative p-3 rounded-xl scale-in-center border"
            style={{
              borderColor: categoryColor
                ? `${categoryColor}50`
                : "rgba(6, 182, 212, 0.3)",
              backgroundColor: categoryColor
                ? `${categoryColor}15`
                : "rgba(6, 182, 212, 0.05)",
              boxShadow: categoryColor
                ? `0 0 30px ${categoryColor}40, 0 0 60px ${categoryColor}20, inset 0 0 20px ${categoryColor}10`
                : "0 0 30px rgba(6, 182, 212, 0.2)",
            }}
          >
            {/* Wrapper div to apply color to SVG via currentColor inheritance */}
            <div
              style={{
                color: categoryColor || iconColor,
                filter: categoryColor
                  ? `drop-shadow(0 0 8px ${categoryColor}) drop-shadow(0 0 16px ${categoryColor}80)`
                  : `drop-shadow(0 0 8px ${iconColor})`,
              }}
            >
              {(() => {
                const IconComponent = getCategoryIcon(category);
                return <IconComponent className="w-12 h-12" />;
              })()}
            </div>
            <div
              className="absolute -top-1 -right-1"
              style={{
                color: categoryColor || themeClasses.defaultAccentColor,
                filter: categoryColor
                  ? `drop-shadow(0 0 6px ${categoryColor})`
                  : undefined,
              }}
            >
              <SparklesIcon className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="fade-in-expand">
            <h1 className={cn("text-2xl font-bold text-white mb-1")}>
              {category}
            </h1>
            <p className="text-sm text-[#94a3b8]">
              {stats.count} transaction{stats.count !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="relative z-10 p-3 space-y-4 pb-20">
        {/* Summary Cards with Stagger Animation */}
        <div className="grid grid-cols-2 gap-3">
          <Card
            className={cn(
              "neo-card p-4 border backdrop-blur-sm scale-in-center bg-secondary/5 bg-gradient-to-br from-secondary via-primary to-primary bg-opacity-10",
              themeClasses.border
            )}
            style={{ animationDelay: "0.1s" }}
          >
            <p className="text-xs mb-1 text-[#94a3b8]">Total Spent</p>
            <div className="flex items-center gap-2">
              <p className={cn("text-2xl font-bold", themeClasses.text)}>
                ${totalAmount.toFixed(2)}
              </p>
              <ZapIcon
                className={cn(
                  "w-5 h-5 animate-pulse",
                  themeClasses.text,
                  themeClasses.glow
                )}
              />
            </div>
          </Card>

          <Card
            className={cn(
              "neo-card p-4 border backdrop-blur-sm scale-in-center bg-primary/5",
              themeClasses.border
            )}
            style={{ animationDelay: "0.2s" }}
          >
            <p className="text-xs mb-1 text-[#94a3b8]">Avg per Transaction</p>
            <p className="text-2xl font-bold text-white">
              ${stats.avgTransaction.toFixed(2)}
            </p>
          </Card>
        </div>

        {/* By Subcategory */}
        {Object.keys(stats.bySubcategory).length > 1 && (
          <Card
            className={cn(
              "neo-card p-4 border backdrop-blur-sm scale-in-center bg-primary/5",
              themeClasses.border
            )}
            style={{ animationDelay: "0.3s" }}
          >
            <h3
              className={cn(
                "text-sm font-semibold mb-3 flex items-center gap-2",
                themeClasses.text
              )}
            >
              <SparklesIcon className={cn("w-4 h-4", themeClasses.glow)} />
              By Subcategory
            </h3>
            <div className="space-y-2">
              {Object.entries(stats.bySubcategory)
                .sort((a, b) => b[1] - a[1])
                .map(([sub, amt], index) => (
                  <div
                    key={sub}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg transition-all hover:scale-105 cursor-pointer bg-secondary/10 hover:bg-secondary/20 border fade-in-expand",
                      themeClasses.border
                    )}
                    style={{ animationDelay: `${0.4 + index * 0.1}s` }}
                  >
                    <span className="text-sm text-white font-medium">
                      {sub}
                    </span>
                    <span
                      className={cn("text-sm font-bold", themeClasses.text)}
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
            "neo-card p-4 border backdrop-blur-sm scale-in-center bg-primary/5",
            themeClasses.border
          )}
          style={{ animationDelay: "0.5s" }}
        >
          <h3
            className={cn(
              "text-sm font-semibold mb-3 flex items-center gap-2",
              themeClasses.text
            )}
          >
            <ZapIcon className={cn("w-4 h-4", themeClasses.glow)} />
            By Account
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.byAccount)
              .sort((a, b) => b[1] - a[1])
              .map(([acct, amt], index) => (
                <div
                  key={acct}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg transition-all hover:scale-105 bg-primary/10 hover:bg-primary/20 border fade-in-expand",
                    themeClasses.border
                  )}
                  style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                >
                  <span className="text-sm text-white font-medium">{acct}</span>
                  <span className={cn("text-sm font-bold", themeClasses.text)}>
                    ${amt.toFixed(2)}
                  </span>
                </div>
              ))}
          </div>
        </Card>

        {/* All Transactions */}
        <Card
          className={cn(
            "neo-card p-4 border backdrop-blur-sm scale-in-center bg-secondary/5",
            themeClasses.border
          )}
          style={{ animationDelay: "0.7s" }}
        >
          <h3
            className={cn(
              "text-sm font-semibold mb-3 flex items-center gap-2",
              themeClasses.text
            )}
          >
            <SparklesIcon
              className={cn("w-4 h-4 animate-pulse", themeClasses.glow)}
            />
            All Transactions
          </h3>
          <div className="space-y-2">
            {transactions
              .sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime()
              )
              .map((tx, index) => {
                // Owner-based border: current user's theme color if owner, opposite if partner
                const isPartner = tx.is_owner === false;
                const ownerBorderColor = isPartner
                  ? themeClasses.isPink
                    ? "rgba(6, 182, 212, 0.4)" // Cyan for partner in pink theme
                    : "rgba(236, 72, 153, 0.4)" // Pink for partner in blue theme
                  : themeClasses.isPink
                    ? "rgba(236, 72, 153, 0.4)" // Pink for owner in pink theme
                    : "rgba(6, 182, 212, 0.4)"; // Cyan for owner in blue theme
                const ownerGlowColor = isPartner
                  ? themeClasses.isPink
                    ? "rgba(6, 182, 212, 0.2)"
                    : "rgba(236, 72, 153, 0.2)"
                  : themeClasses.isPink
                    ? "rgba(236, 72, 153, 0.2)"
                    : "rgba(6, 182, 212, 0.2)";

                return (
                  <div
                    key={tx.id}
                    onClick={() => onTransactionClick(tx)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:scale-105 group bg-primary/5 hover:bg-primary/15 fade-in-expand"
                    )}
                    style={{
                      animationDelay: `${0.8 + index * 0.05}s`,
                      borderColor: ownerBorderColor,
                      boxShadow: `0 0 10px ${ownerGlowColor}`,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {tx.subcategory || category}
                      </p>
                      <div className="flex items-center gap-2 text-xs mt-1 text-[#94a3b8]">
                        <span>{format(new Date(tx.date), "MMM d, yyyy")}</span>
                        <span>•</span>
                        <span>{tx.account_name}</span>
                      </div>
                      {tx.description && (
                        <p className="text-xs mt-1 truncate opacity-70 text-[#94a3b8]">
                          {tx.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "text-base font-bold ml-3",
                          themeClasses.text
                        )}
                      >
                        ${tx.amount.toFixed(2)}
                      </p>
                      <div
                        className={cn(
                          "w-1 h-1 rounded-full transition-all group-hover:w-2 group-hover:h-2",
                          themeClasses.bgActive
                        )}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>
    </div>
  );
}
