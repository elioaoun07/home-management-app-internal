"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useEffect, useState } from "react";

export function useThemeClasses() {
  // Start with default theme to match server render (avoids hydration mismatch)
  const [mounted, setMounted] = useState(false);

  // Get theme from context
  const { theme: contextTheme } = useTheme();

  // After hydration, mark as mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use default "blue" theme until mounted to avoid hydration mismatch
  // After mount, use the actual theme from context
  const isPink = mounted ? contextTheme === "pink" : false;
  const isFrost = mounted ? contextTheme === "frost" : false;
  const isCalm = mounted ? contextTheme === "calm" : false;

  return {
    // Text Colors - Calm uses warm stone tones for comfortable reading
    text: isCalm
      ? "text-stone-300"
      : isFrost
        ? "text-indigo-600"
        : isPink
          ? "text-pink-400"
          : "text-cyan-400",
    textMuted: isCalm
      ? "text-stone-400"
      : isFrost
        ? "text-slate-500"
        : isPink
          ? "text-pink-400/70"
          : "text-cyan-400/70",
    textFaint: isCalm
      ? "text-stone-500"
      : isFrost
        ? "text-slate-400"
        : isPink
          ? "text-pink-400/60"
          : "text-cyan-400/60",
    textHover: isCalm
      ? "hover:text-stone-200"
      : isFrost
        ? "hover:text-indigo-700"
        : isPink
          ? "hover:text-pink-400"
          : "hover:text-cyan-400",
    textHighlight: isCalm
      ? "text-stone-200"
      : isFrost
        ? "text-indigo-500"
        : isPink
          ? "text-pink-300"
          : "text-cyan-300",
    textActive: isCalm
      ? "text-emerald-400"
      : isFrost
        ? "text-violet-600"
        : isPink
          ? "text-amber-400"
          : "text-teal",
    textButton: isCalm
      ? "!text-stone-100"
      : isFrost
        ? "!text-white"
        : isPink
          ? "!text-pink-100"
          : "!text-cyan-100",
    textSecondary: isCalm
      ? "text-stone-400"
      : isFrost
        ? "text-violet-500"
        : isPink
          ? "text-amber-400"
          : "text-blue-400",
    textAccent: isCalm
      ? "text-emerald-500"
      : isFrost
        ? "text-indigo-500"
        : isPink
          ? "text-pink-500"
          : "text-cyan-500",

    // Backgrounds - Calm uses warm stone backgrounds for tablet comfort
    bgActive: isCalm
      ? "bg-stone-700"
      : isFrost
        ? "bg-indigo-100"
        : isPink
          ? "bg-amber-500/20"
          : "bg-teal/20",
    bgHover: isCalm
      ? "hover:bg-stone-700"
      : isFrost
        ? "hover:bg-slate-100"
        : isPink
          ? "hover:bg-pink-500/20"
          : "hover:bg-cyan-500/20",
    bgSurface: isCalm
      ? "bg-stone-800"
      : isFrost
        ? "bg-indigo-50"
        : isPink
          ? "bg-pink-500/10"
          : "bg-cyan-500/10",
    bgPage: isCalm
      ? "bg-[#1c1917]"
      : isFrost
        ? "bg-[#f8fafc]"
        : isPink
          ? "bg-[#1a0a14]"
          : "bg-[#0a1628]",

    // Borders & Rings - Calm uses subtle warm borders
    border: isCalm
      ? "border-stone-600"
      : isFrost
        ? "border-indigo-200"
        : isPink
          ? "border-pink-400/30"
          : "border-cyan-400/30",
    borderHover: isCalm
      ? "hover:border-stone-500"
      : isFrost
        ? "hover:border-indigo-300"
        : isPink
          ? "hover:border-pink-400/50"
          : "hover:border-cyan-400/50",
    borderActive: isCalm
      ? "border-stone-400"
      : isFrost
        ? "border-indigo-500"
        : isPink
          ? "border-pink-400"
          : "border-cyan-400",
    ringActive: isCalm
      ? "ring-emerald-500"
      : isFrost
        ? "ring-indigo-500"
        : isPink
          ? "ring-amber-400"
          : "ring-teal",
    focusRing: isCalm
      ? "focus:ring-stone-500"
      : isFrost
        ? "focus:ring-indigo-300"
        : isPink
          ? "focus:ring-pink-400/20"
          : "focus:ring-cyan-400/20",
    focusBorder: isCalm
      ? "focus:border-stone-400"
      : isFrost
        ? "focus:border-indigo-500"
        : isPink
          ? "focus:border-pink-400"
          : "focus:border-cyan-400",

    // Input Specific - Calm uses very subtle borders, no harsh glows
    inputBorder: isCalm
      ? "shadow-[0_0_0_1px_rgba(120,113,108,0.3)_inset]"
      : isFrost
        ? "shadow-[0_0_0_1px_rgba(99,102,241,0.15)_inset]"
        : isPink
          ? "shadow-[0_0_0_1px_rgba(236,72,153,0.3)_inset]"
          : "shadow-[0_0_0_1px_rgba(6,182,212,0.3)_inset]",
    inputFocus: isCalm
      ? "focus-visible:shadow-[0_0_0_2px_rgba(120,113,108,0.5)_inset]"
      : isFrost
        ? "focus-visible:shadow-[0_0_0_2px_rgba(99,102,241,0.3)_inset,0_0_0_4px_rgba(99,102,241,0.1)]"
        : isPink
          ? "focus-visible:shadow-[0_0_0_2px_rgba(236,72,153,0.6)_inset,0_0_20px_rgba(236,72,153,0.3)]"
          : "focus-visible:shadow-[0_0_0_2px_rgba(6,182,212,0.6)_inset,0_0_20px_rgba(6,182,212,0.3)]",
    inputFocusForce: isCalm
      ? "focus:shadow-[0_0_0_2px_rgba(120,113,108,0.5)_inset]"
      : isFrost
        ? "focus:shadow-[0_0_0_2px_rgba(99,102,241,0.3)_inset,0_0_0_4px_rgba(99,102,241,0.1)]"
        : isPink
          ? "focus:shadow-[0_0_0_2px_rgba(236,72,153,0.6)_inset,0_0_20px_rgba(236,72,153,0.3)]"
          : "focus:shadow-[0_0_0_2px_rgba(6,182,212,0.6)_inset,0_0_20px_rgba(6,182,212,0.3)]",
    inputBg: isCalm
      ? "bg-[#292524]"
      : isFrost
        ? "bg-white"
        : isPink
          ? "bg-[#1a0a14]/50"
          : "bg-[#0a1628]/50",
    inputFocusBg: isCalm
      ? "focus-visible:bg-[#44403c]"
      : isFrost
        ? "focus-visible:bg-white"
        : isPink
          ? "focus-visible:bg-[#2d1b29]"
          : "focus-visible:bg-[#0f1d2e]",
    placeholder: isCalm
      ? "placeholder:text-stone-500"
      : isFrost
        ? "placeholder:text-slate-400"
        : isPink
          ? "placeholder:text-pink-400/50"
          : "placeholder:text-cyan-400/50",
    selection: isCalm
      ? "selection:bg-stone-600"
      : isFrost
        ? "selection:bg-indigo-200"
        : isPink
          ? "selection:bg-pink-400"
          : "selection:bg-cyan-400",

    // Gradients - Calm uses very subtle warm gradients
    titleGradient: isCalm
      ? "from-stone-300 via-stone-400 to-emerald-400"
      : isFrost
        ? "from-indigo-600 via-violet-600 to-indigo-500"
        : isPink
          ? "from-pink-400 via-amber-400 to-pink-300"
          : "from-cyan-400 via-teal to-cyan-300",
    activeItemGradient: isCalm
      ? "from-stone-700 to-stone-800"
      : isFrost
        ? "from-indigo-100 to-violet-50"
        : isPink
          ? "from-pink-500/20 to-amber-500/20"
          : "from-cyan-500/20 to-teal/20",
    iconBg: isCalm
      ? "from-stone-700 to-stone-800"
      : isFrost
        ? "from-indigo-100 to-violet-50"
        : isPink
          ? "from-pink-500/20 to-amber-500/20"
          : "from-cyan-500/20 to-teal/20",
    cardGradient: isCalm
      ? "from-stone-800 to-stone-900"
      : isFrost
        ? "from-white to-slate-50"
        : isPink
          ? "from-pink-500/10 to-amber-500/5"
          : "from-cyan-500/10 to-teal/5",

    // Shadows - Calm uses no harsh glows, just soft shadows
    activeItemShadow: isCalm
      ? "shadow-[0_2px_8px_rgba(28,25,23,0.3)]"
      : isFrost
        ? "shadow-[0_2px_8px_rgba(99,102,241,0.1)]"
        : isPink
          ? "shadow-[0_0_20px_rgba(236,72,153,0.2)]"
          : "shadow-[0_0_20px_rgba(6,182,212,0.2)]",
    shadowActive: isCalm
      ? "shadow-[0_4px_12px_rgba(28,25,23,0.4)]"
      : isFrost
        ? "shadow-[0_2px_12px_rgba(99,102,241,0.15)]"
        : isPink
          ? "shadow-[0_0_20px_rgba(251,191,36,0.3)]"
          : "shadow-[0_0_20px_rgba(20,184,166,0.3)]",
    glow: isCalm
      ? "drop-shadow-none"
      : isFrost
        ? "drop-shadow-[0_1px_2px_rgba(99,102,241,0.15)]"
        : isPink
          ? "drop-shadow-[0_0_8px_rgba(236,72,153,0.4)]"
          : "drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]",

    // Button Specific - Calm uses muted, solid buttons
    buttonPrimary: isCalm
      ? "bg-stone-600 text-stone-100 shadow-[0_2px_8px_rgba(28,25,23,0.4)] hover:bg-stone-500 hover:shadow-[0_4px_12px_rgba(28,25,23,0.5)]"
      : isFrost
        ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-[0_2px_8px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.35)]"
        : isPink
          ? "bg-gradient-to-r from-pink-500 to-amber-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)]"
          : "bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]",
    buttonSecondary: isCalm
      ? "bg-stone-700 text-stone-300 shadow-[0_1px_4px_rgba(28,25,23,0.3)] hover:bg-stone-600"
      : isFrost
        ? "bg-slate-100 text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:bg-slate-200 hover:shadow-[0_2px_4px_rgba(15,23,42,0.08)]"
        : isPink
          ? "bg-[#2d1b29] text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.2)] hover:bg-[#3d2435] hover:shadow-[0_0_20px_rgba(236,72,153,0.3)]"
          : "bg-[#1a2942] text-[#38bdf8] shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:bg-[#1e3a5f] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]",
    buttonOutline: isCalm
      ? "bg-transparent border border-stone-600 hover:border-stone-500 hover:bg-stone-800 text-stone-300"
      : isFrost
        ? "bg-transparent border border-indigo-300 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-600"
        : isPink
          ? "bg-transparent shadow-[0_0_0_2px_rgba(236,72,153,0.4)_inset] hover:shadow-[0_0_0_2px_rgba(236,72,153,0.8)_inset,0_0_20px_rgba(236,72,153,0.3)] hover:bg-pink-500/10 text-pink-400"
          : "bg-transparent shadow-[0_0_0_2px_rgba(6,182,212,0.4)_inset] hover:shadow-[0_0_0_2px_rgba(6,182,212,0.8)_inset,0_0_20px_rgba(6,182,212,0.3)] hover:bg-[#06b6d4]/10 text-[#06b6d4]",
    buttonGhost: isCalm
      ? "hover:bg-stone-700 hover:text-stone-200"
      : isFrost
        ? "hover:bg-slate-100 hover:text-slate-900"
        : isPink
          ? "hover:bg-pink-500/10 hover:text-pink-300"
          : "hover:bg-accent hover:text-accent-foreground",
    buttonFocus: isCalm
      ? "focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
      : isFrost
        ? "focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2"
        : isPink
          ? "focus-visible:shadow-[0_0_0_3px_rgba(236,72,153,0.4)]"
          : "focus-visible:shadow-[0_0_0_3px_rgba(6,182,212,0.4)]",

    // Card Specific - Calm uses warm dark cards with clear borders
    cardBg: isCalm
      ? "bg-[#292524] text-stone-200 border-stone-700"
      : isFrost
        ? "bg-white text-slate-800 border-slate-200"
        : isPink
          ? "bg-white/80 text-slate-900 backdrop-blur-md border-pink-200/50"
          : "bg-[#0f1d2e] text-white",
    cardShadow: isCalm
      ? "shadow-[0_2px_8px_rgba(28,25,23,0.4)] hover:shadow-[0_4px_12px_rgba(28,25,23,0.5)]"
      : isFrost
        ? "shadow-[0_1px_3px_rgba(15,23,42,0.05),0_2px_8px_rgba(99,102,241,0.04)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.08)]"
        : isPink
          ? "shadow-[0_8px_32px_rgba(236,72,153,0.15)] hover:shadow-[0_8px_32px_rgba(236,72,153,0.25)]"
          : "shadow-[0_0_20px_rgba(59,130,246,0.2)]",
    cardTitle: isCalm
      ? "text-stone-200"
      : isFrost
        ? "text-slate-900"
        : isPink
          ? "text-slate-900"
          : "text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]",
    cardDescription: isCalm
      ? "text-stone-400"
      : isFrost
        ? "text-slate-500"
        : isPink
          ? "text-slate-500"
          : "text-muted-foreground",

    // Dialog Specific - Calm uses warm dark dialogs
    dialogBg: isCalm
      ? "bg-[#292524] border-stone-700"
      : isFrost
        ? "bg-white border-slate-200"
        : isPink
          ? "bg-[#1a0a14]/95 border-pink-500/20"
          : "bg-[#0f1d2e]",
    dialogShadow: isCalm
      ? "shadow-[0_8px_32px_rgba(28,25,23,0.6)]"
      : isFrost
        ? "shadow-[0_8px_40px_rgba(15,23,42,0.12),0_4px_16px_rgba(99,102,241,0.06)]"
        : isPink
          ? "shadow-[0_0_40px_rgba(236,72,153,0.4)]"
          : "shadow-[0_0_40px_rgba(59,130,246,0.4)]",
    dialogClose: isCalm
      ? "text-stone-400 hover:text-stone-200"
      : isFrost
        ? "text-slate-400 hover:text-slate-600"
        : isPink
          ? "text-pink-400"
          : "text-[#38bdf8]",
    dialogTitle: isCalm
      ? "text-stone-200"
      : isFrost
        ? "text-slate-900"
        : isPink
          ? "text-pink-400"
          : "text-[#06b6d4]",
    dialogDescription: isCalm
      ? "text-stone-400"
      : isFrost
        ? "text-slate-500"
        : isPink
          ? "text-pink-400/80"
          : "text-[#38bdf8]/80",

    // Select Specific
    selectTriggerBg: isCalm
      ? "bg-[#292524]"
      : isFrost
        ? "bg-white"
        : isPink
          ? "bg-[#1a0a14]/50"
          : "bg-[#0a1628]/50",
    selectTriggerBorder: isCalm
      ? "shadow-[0_0_0_1px_rgba(120,113,108,0.3)_inset]"
      : isFrost
        ? "shadow-[0_0_0_1px_rgba(99,102,241,0.15)_inset]"
        : isPink
          ? "shadow-[0_0_0_1px_rgba(236,72,153,0.3)_inset]"
          : "shadow-[0_0_0_1px_rgba(6,182,212,0.3)_inset]",
    selectTriggerFocus: isCalm
      ? "focus-visible:shadow-[0_0_0_2px_rgba(120,113,108,0.5)_inset] focus-visible:bg-[#44403c]"
      : isFrost
        ? "focus-visible:shadow-[0_0_0_2px_rgba(99,102,241,0.3)_inset] focus-visible:bg-white"
        : isPink
          ? "focus-visible:shadow-[0_0_0_2px_rgba(236,72,153,0.6)_inset,0_0_20px_rgba(236,72,153,0.3)] focus-visible:bg-[#2d1b29]"
          : "focus-visible:shadow-[0_0_0_2px_rgba(6,182,212,0.6)_inset,0_0_20px_rgba(6,182,212,0.3)] focus-visible:bg-[#0f1d2e]",
    selectContentBg: isCalm
      ? "bg-[#292524]"
      : isFrost
        ? "bg-white"
        : isPink
          ? "bg-[#1a0a14]"
          : "bg-[#0f1d2e]",
    selectContentShadow: isCalm
      ? "shadow-[0_4px_16px_rgba(28,25,23,0.5)]"
      : isFrost
        ? "shadow-[0_4px_20px_rgba(15,23,42,0.1)]"
        : isPink
          ? "shadow-[0_0_30px_rgba(236,72,153,0.4)]"
          : "shadow-[0_0_30px_rgba(59,130,246,0.4)]",
    selectIcon: isCalm
      ? "text-stone-400"
      : isFrost
        ? "text-indigo-500"
        : isPink
          ? "text-pink-400"
          : "text-[#06b6d4]",
    selectItemFocus: isCalm
      ? "focus:bg-stone-700 focus:text-stone-200"
      : isFrost
        ? "focus:bg-indigo-50 focus:text-indigo-700"
        : isPink
          ? "focus:bg-pink-500/20 focus:text-pink-300"
          : "focus:bg-cyan-500/20 focus:text-cyan-300",
    selectItemIcon: isCalm
      ? "text-stone-400"
      : isFrost
        ? "text-indigo-500"
        : isPink
          ? "text-pink-400"
          : "text-[#06b6d4]",

    // Checkbox
    checkboxChecked: isCalm
      ? "data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
      : isFrost
        ? "data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
        : isPink
          ? "data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
          : "data-[state=checked]:bg-primary data-[state=checked]:border-primary",

    // Radio Group
    radioChecked: isCalm
      ? "text-emerald-500"
      : isFrost
        ? "text-indigo-500"
        : isPink
          ? "text-pink-500"
          : "text-primary",
    radioDot: isCalm
      ? "fill-emerald-500"
      : isFrost
        ? "fill-indigo-500"
        : isPink
          ? "fill-pink-500"
          : "fill-primary",

    // Switch Specific
    switchChecked: isCalm
      ? "data-[state=checked]:bg-emerald-600"
      : isFrost
        ? "data-[state=checked]:bg-indigo-500"
        : isPink
          ? "data-[state=checked]:bg-pink-500"
          : "data-[state=checked]:bg-cyan-500",
    switchThumb: isCalm
      ? "bg-stone-100"
      : isFrost
        ? "bg-white"
        : isPink
          ? "bg-white"
          : "bg-white",

    // Tabs Specific
    tabsListBg: isCalm
      ? "bg-stone-800"
      : isFrost
        ? "bg-slate-100"
        : isPink
          ? "bg-[#2d1b29]"
          : "bg-muted",
    tabsTriggerActive: isCalm
      ? "data-[state=active]:bg-stone-700 data-[state=active]:text-stone-200 data-[state=active]:shadow-sm"
      : isFrost
        ? "data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
        : isPink
          ? "data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-300"
          : "data-[state=active]:bg-background",

    // Textarea Specific
    textareaBorder: isCalm
      ? "border-stone-600 focus-visible:border-stone-400"
      : isFrost
        ? "border-slate-200 focus-visible:border-indigo-400"
        : isPink
          ? "border-pink-400/30 focus-visible:border-pink-400"
          : "border-input focus-visible:border-ring",
    textareaRing: isCalm
      ? "focus-visible:ring-stone-600"
      : isFrost
        ? "focus-visible:ring-indigo-200"
        : isPink
          ? "focus-visible:ring-pink-400/20"
          : "focus-visible:ring-ring/50",

    // Calculator Specific - Calm uses warm stone tones
    calculatorBg: isCalm
      ? "bg-[#292524] border-stone-700"
      : isFrost
        ? "bg-white border-slate-200"
        : isPink
          ? "bg-[#2d1b29] border-pink-500/20"
          : "bg-[#0f1d2e] border-[#3b82f6]/20",
    calculatorDisplayBg: isCalm
      ? "bg-[#1c1917]"
      : isFrost
        ? "bg-slate-50"
        : isPink
          ? "bg-[#1a0a14]"
          : "bg-[#0a1628]",
    calculatorShadow: isCalm
      ? "shadow-lg shadow-stone-900/30"
      : isFrost
        ? "shadow-lg shadow-slate-200/50"
        : isPink
          ? "shadow-xl shadow-pink-900/10"
          : "shadow-xl shadow-blue-900/10",
    calculatorOperatorBtn: isCalm
      ? "bg-none shadow-none hover:shadow-none bg-stone-700 hover:bg-stone-600 border-stone-600 text-stone-300"
      : isFrost
        ? "bg-none shadow-none hover:shadow-none bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700"
        : isPink
          ? "bg-none shadow-none hover:shadow-none bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20 text-pink-200"
          : "bg-none shadow-none hover:shadow-none bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/20 text-cyan-200",
    calculatorNumberBtn: isCalm
      ? "bg-none shadow-none hover:shadow-none bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-200"
      : isFrost
        ? "bg-none shadow-none hover:shadow-none bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
        : isPink
          ? "bg-none shadow-none hover:shadow-none bg-[#3d2435] hover:bg-[#4d2d42] border-pink-500/10 text-pink-100"
          : "bg-none shadow-none hover:shadow-none bg-[#1e293b] hover:bg-[#334155] border-slate-700/50 text-slate-200",
    calculatorEqualBtn: isCalm
      ? "bg-none shadow-none hover:shadow-none bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-600"
      : isFrost
        ? "bg-none shadow-none hover:shadow-none bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-400"
        : isPink
          ? "bg-none shadow-none hover:shadow-none bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50"
          : "bg-none shadow-none hover:shadow-none bg-emerald-600/80 hover:bg-emerald-600 text-white border border-emerald-500/50",
    calculatorClearBtn: isCalm
      ? "bg-none shadow-none hover:shadow-none bg-red-900/50 hover:bg-red-900/70 border border-red-800 text-red-300"
      : isFrost
        ? "bg-none shadow-none hover:shadow-none bg-red-50 hover:bg-red-100 border border-red-200 text-red-600"
        : isPink
          ? "bg-none shadow-none hover:shadow-none bg-red-500/40 hover:bg-red-500/60 border border-red-400/40 text-red-100"
          : "bg-none shadow-none hover:shadow-none bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-red-200",
    calculatorBackspaceBtn: isCalm
      ? "bg-none shadow-none hover:shadow-none bg-red-900/50 hover:bg-red-900/70 border border-red-800 text-red-300"
      : isFrost
        ? "bg-none shadow-none hover:shadow-none bg-red-50 hover:bg-red-100 border border-red-200 text-red-600"
        : isPink
          ? "bg-none shadow-none hover:shadow-none bg-red-500/40 hover:bg-red-500/60 border border-red-400/40 text-red-100"
          : "bg-none shadow-none hover:shadow-none bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-red-200",
    calculatorTipBtn: isCalm
      ? "bg-none shadow-none hover:shadow-none bg-emerald-900/50 hover:bg-emerald-900/70 border-emerald-800 text-emerald-300"
      : isFrost
        ? "bg-none shadow-none hover:shadow-none bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-600"
        : isPink
          ? "bg-none shadow-none hover:shadow-none bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20 text-pink-200"
          : "bg-none shadow-none hover:shadow-none bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-200",

    // Badge/Notification Specific
    badgeBg: isCalm
      ? "bg-emerald-600"
      : isFrost
        ? "bg-indigo-500"
        : isPink
          ? "bg-pink-500"
          : "bg-[#06b6d4]",
    badgeText: isCalm
      ? "text-stone-100"
      : isFrost
        ? "text-white"
        : isPink
          ? "text-white"
          : "text-white",

    // Modal/Sheet Specific
    modalBg: isCalm
      ? "bg-[#292524]"
      : isFrost
        ? "bg-white"
        : isPink
          ? "bg-[#1a0a14]"
          : "bg-[#0f1d2e]",
    modalBorder: isCalm
      ? "border-stone-700"
      : isFrost
        ? "border-slate-200"
        : isPink
          ? "border-pink-500/20"
          : "border-[#3b82f6]/20",

    // Icon Drop Shadows - Calm uses no glows, just subtle shadows
    iconGlow: isCalm
      ? "drop-shadow-none"
      : isFrost
        ? "drop-shadow-[0_1px_2px_rgba(99,102,241,0.2)]"
        : isPink
          ? "drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]"
          : "drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]",
    iconGlowStrong: isCalm
      ? "drop-shadow-[0_1px_2px_rgba(28,25,23,0.4)]"
      : isFrost
        ? "drop-shadow-[0_2px_4px_rgba(99,102,241,0.25)]"
        : isPink
          ? "drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]"
          : "drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]",
    iconGlowMuted: isCalm
      ? "drop-shadow-none"
      : isFrost
        ? "drop-shadow-[0_1px_1px_rgba(99,102,241,0.15)]"
        : isPink
          ? "drop-shadow-[0_0_6px_rgba(236,72,153,0.4)]"
          : "drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]",

    // Spinner/Loading
    spinnerBorder: isCalm
      ? "border-stone-400"
      : isFrost
        ? "border-indigo-500"
        : isPink
          ? "border-pink-500"
          : "border-[#06b6d4]",
    spinnerGlow: isCalm
      ? "drop-shadow-none"
      : isFrost
        ? "drop-shadow-[0_1px_3px_rgba(99,102,241,0.3)]"
        : isPink
          ? "drop-shadow-[0_0_15px_rgba(236,72,153,0.6)]"
          : "drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]",
    loadingText: isCalm
      ? "text-stone-400"
      : isFrost
        ? "text-indigo-600"
        : isPink
          ? "text-pink-400"
          : "text-[#38bdf8]",

    // Nav specific
    navShadow: isCalm
      ? "0 -2px 8px rgba(28, 25, 23, 0.4)"
      : isFrost
        ? "0 -1px 3px rgba(15, 23, 42, 0.04), 0 -1px 2px rgba(99, 102, 241, 0.03)"
        : isPink
          ? "0 -4px 12px rgba(0, 0, 0, 0.1), 0 -1px 3px rgba(236, 72, 153, 0.05)"
          : "0 -4px 12px rgba(0, 0, 0, 0.1), 0 -1px 3px rgba(59, 130, 246, 0.05)",

    // Action Buttons (Edit, Delete, etc)
    editText: isCalm
      ? "text-stone-400"
      : isFrost
        ? "text-indigo-600"
        : isPink
          ? "text-pink-400"
          : "text-blue-400",
    editGlow: isCalm
      ? "drop-shadow-none"
      : isFrost
        ? "drop-shadow-[0_1px_2px_rgba(99,102,241,0.2)]"
        : isPink
          ? "drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]"
          : "drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]",

    // Separators
    separatorBg: isCalm
      ? "bg-stone-700"
      : isFrost
        ? "bg-slate-200"
        : isPink
          ? "bg-pink-500/20"
          : "bg-[#3b82f6]/20",

    // Hover states for clickable items
    hoverBgSubtle: isCalm
      ? "hover:bg-stone-800"
      : isFrost
        ? "hover:bg-slate-50"
        : isPink
          ? "hover:bg-pink-500/10"
          : "hover:bg-[#3b82f6]/10",

    // Ring for selection states
    ringSelection: isCalm
      ? "ring-2 ring-stone-600"
      : isFrost
        ? "ring-2 ring-indigo-200"
        : isPink
          ? "ring-2 ring-pink-400/30"
          : "ring-2 ring-[#06b6d4]/30",
    ringSelectionStrong: isCalm
      ? "ring-2 ring-emerald-600 shadow-[0_2px_8px_rgba(28,25,23,0.3)]"
      : isFrost
        ? "ring-2 ring-indigo-500 shadow-[0_2px_8px_rgba(99,102,241,0.15)]"
        : isPink
          ? "ring-2 ring-pink-400 shadow-[0_0_30px_rgba(236,72,153,0.3)]"
          : "ring-2 ring-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.3)]",

    // Label text
    labelText: isCalm
      ? "text-stone-300"
      : isFrost
        ? "text-slate-700"
        : isPink
          ? "text-pink-400"
          : "text-[#06b6d4]",
    labelTextMuted: isCalm
      ? "text-stone-500"
      : isFrost
        ? "text-slate-500"
        : isPink
          ? "text-pink-400/70"
          : "text-[#06b6d4]/70",

    // Form Input Combined (for quick use)
    formInput: isCalm
      ? "bg-[#292524] shadow-[0_0_0_1px_rgba(120,113,108,0.3)_inset] text-stone-200 focus:shadow-[0_0_0_2px_rgba(120,113,108,0.5)_inset]"
      : isFrost
        ? "bg-white shadow-[0_0_0_1px_rgba(99,102,241,0.12)_inset] text-slate-800 focus:shadow-[0_0_0_2px_rgba(99,102,241,0.25)_inset]"
        : isPink
          ? "bg-[#1a0a14]/50 shadow-[0_0_0_1px_rgba(236,72,153,0.3)_inset] text-white focus:shadow-[0_0_0_2px_rgba(236,72,153,0.6)_inset,0_0_20px_rgba(236,72,153,0.3)]"
          : "bg-[#0a1628]/50 shadow-[0_0_0_1px_rgba(6,182,212,0.3)_inset] text-white focus:shadow-[0_0_0_2px_rgba(6,182,212,0.6)_inset,0_0_20px_rgba(6,182,212,0.3)]",
    formInputReadonly: isCalm
      ? "bg-[#1c1917] shadow-[0_0_0_1px_rgba(120,113,108,0.2)_inset] text-stone-400"
      : isFrost
        ? "bg-slate-50 shadow-[0_0_0_1px_rgba(99,102,241,0.08)_inset] text-slate-600"
        : isPink
          ? "bg-[#1a0a14]/50 shadow-[0_0_0_1px_rgba(236,72,153,0.2)_inset] text-white"
          : "bg-[#0a1628]/50 shadow-[0_0_0_1px_rgba(6,182,212,0.2)_inset] text-white",

    // Header text
    headerText: isCalm
      ? "text-stone-200"
      : isFrost
        ? "text-slate-900"
        : isPink
          ? "text-pink-300"
          : "text-[#38bdf8]",
    headerTextMuted: isCalm
      ? "text-stone-500"
      : isFrost
        ? "text-slate-500"
        : isPink
          ? "text-pink-400/60"
          : "text-[#38bdf8]/60",

    // Page and Header Backgrounds
    pageBg: isCalm
      ? "bg-[#1c1917]"
      : isFrost
        ? "bg-[#f8fafc]"
        : isPink
          ? "bg-[#1a0a14]"
          : "bg-[#0a1628]",
    headerGradient: isCalm
      ? "bg-gradient-to-b from-[#44403c] to-[#292524]"
      : isFrost
        ? "bg-gradient-to-b from-white to-[#f8fafc]"
        : isPink
          ? "bg-gradient-to-b from-[#2d1b29] to-[#1a0a14]"
          : "bg-gradient-to-b from-[#1a2942] to-[#0f1d2e]",
    surfaceBg: isCalm
      ? "bg-[#44403c]"
      : isFrost
        ? "bg-white"
        : isPink
          ? "bg-[#2d1b29]"
          : "bg-[#1a2942]",
    surfaceBgMuted: isCalm
      ? "bg-[#44403c]/60"
      : isFrost
        ? "bg-slate-50"
        : isPink
          ? "bg-[#2d1b29]/60"
          : "bg-[#1a2942]/60",

    // Progress bars
    progressBg: isCalm
      ? "bg-stone-800"
      : isFrost
        ? "bg-slate-100"
        : isPink
          ? "bg-[#2d1b29]/60"
          : "bg-[#1a2942]/60",
    progressFill: isCalm
      ? "bg-emerald-600"
      : isFrost
        ? "bg-indigo-500"
        : isPink
          ? "bg-pink-500"
          : "bg-cyan-500",

    // Default fallback colors (for when category color is not set)
    defaultAccentColor: isCalm
      ? "#84a98c"
      : isFrost
        ? "#6366f1"
        : isPink
          ? "#ec4899"
          : "#38bdf8",
    defaultAccentColorAlt: isCalm
      ? "#a8a29e"
      : isFrost
        ? "#8b5cf6"
        : isPink
          ? "#f472b6"
          : "#06b6d4",

    // Card/Section with hover effects
    sectionCard: isCalm
      ? "bg-[#292524] shadow-[0_2px_6px_rgba(28,25,23,0.3)] hover:shadow-[0_4px_12px_rgba(28,25,23,0.4)]"
      : isFrost
        ? "bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_12px_rgba(99,102,241,0.08)]"
        : isPink
          ? "bg-[#1a0a14]/60 shadow-[0_0_0_1px_rgba(236,72,153,0.25)_inset] hover:shadow-[0_0_0_1px_rgba(236,72,153,0.4)_inset,0_0_20px_rgba(236,72,153,0.3)]"
          : "bg-[#0f1d2e]/60 shadow-[0_0_0_1px_rgba(6,182,212,0.25)_inset] hover:shadow-[0_0_0_1px_rgba(6,182,212,0.4)_inset,0_0_20px_rgba(59,130,246,0.3)]",

    // Feature cards for landing pages
    featureCard: isCalm
      ? "bg-[#292524] shadow-[0_2px_8px_rgba(28,25,23,0.4)] hover:shadow-[0_4px_16px_rgba(28,25,23,0.5)]"
      : isFrost
        ? "bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_24px_rgba(99,102,241,0.1)]"
        : isPink
          ? "bg-[#1a0a14]/80 shadow-[0_0_0_1px_rgba(236,72,153,0.2)_inset] hover:bg-[#1a0a14] hover:shadow-[0_0_0_1px_rgba(236,72,153,0.4)_inset,0_0_30px_rgba(236,72,153,0.3)]"
          : "bg-[#0f1d2e]/80 shadow-[0_0_0_1px_rgba(6,182,212,0.2)_inset] hover:bg-[#0f1d2e] hover:shadow-[0_0_0_1px_rgba(6,182,212,0.4)_inset,0_0_30px_rgba(59,130,246,0.3)]",

    // Form control styling for drawers/dialogs
    formControlBg: isCalm
      ? "bg-[#292524] border-stone-700"
      : isFrost
        ? "bg-white border-slate-200"
        : isPink
          ? "bg-[#1a0a14] border-pink-500/30"
          : "bg-[#0a1628] border-[#3b82f6]/30",

    // Theme booleans for conditional logic
    isPink,
    isFrost,
    isCalm,
  };
}
