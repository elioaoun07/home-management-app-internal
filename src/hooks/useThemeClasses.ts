import { useTheme } from "@/contexts/ThemeContext";

export function useThemeClasses() {
  const { theme: colorTheme } = useTheme();
  const isPink = colorTheme === "pink";

  return {
    // Text Colors
    text: isPink ? "text-pink-400" : "text-cyan-400",
    textMuted: isPink ? "text-pink-400/70" : "text-cyan-400/70",
    textFaint: isPink ? "text-pink-400/60" : "text-cyan-400/60",
    textHover: isPink ? "hover:text-pink-400" : "hover:text-cyan-400",
    textHighlight: isPink ? "text-pink-300" : "text-cyan-300",
    textActive: isPink ? "text-amber-400" : "text-teal",
    textButton: isPink ? "!text-pink-100" : "!text-cyan-100",
    textSecondary: isPink ? "text-amber-400" : "text-blue-400",
    textAccent: isPink ? "text-pink-500" : "text-cyan-500",

    // Backgrounds
    bgActive: isPink ? "bg-amber-500/20" : "bg-teal/20",
    bgHover: isPink ? "hover:bg-pink-500/20" : "hover:bg-cyan-500/20",
    bgSurface: isPink ? "bg-pink-500/10" : "bg-cyan-500/10",
    bgPage: isPink ? "bg-[#1a0a14]" : "bg-[#0a1628]",

    // Borders & Rings
    border: isPink ? "border-pink-400/30" : "border-cyan-400/30",
    borderHover: isPink
      ? "hover:border-pink-400/50"
      : "hover:border-cyan-400/50",
    borderActive: isPink ? "border-pink-400" : "border-cyan-400",
    ringActive: isPink ? "ring-amber-400" : "ring-teal",
    focusRing: isPink ? "focus:ring-pink-400/20" : "focus:ring-cyan-400/20",
    focusBorder: isPink ? "focus:border-pink-400" : "focus:border-cyan-400",

    // Input Specific
    inputBorder: isPink
      ? "shadow-[0_0_0_1px_rgba(236,72,153,0.3)_inset]"
      : "shadow-[0_0_0_1px_rgba(6,182,212,0.3)_inset]",
    inputFocus: isPink
      ? "focus-visible:shadow-[0_0_0_2px_rgba(236,72,153,0.6)_inset,0_0_20px_rgba(236,72,153,0.3)]"
      : "focus-visible:shadow-[0_0_0_2px_rgba(6,182,212,0.6)_inset,0_0_20px_rgba(6,182,212,0.3)]",
    inputFocusForce: isPink
      ? "focus:shadow-[0_0_0_2px_rgba(236,72,153,0.6)_inset,0_0_20px_rgba(236,72,153,0.3)]"
      : "focus:shadow-[0_0_0_2px_rgba(6,182,212,0.6)_inset,0_0_20px_rgba(6,182,212,0.3)]",
    inputBg: isPink ? "bg-[#1a0a14]/50" : "bg-[#0a1628]/50",
    inputFocusBg: isPink
      ? "focus-visible:bg-[#2d1b29]"
      : "focus-visible:bg-[#0f1d2e]",
    placeholder: isPink
      ? "placeholder:text-pink-400/50"
      : "placeholder:text-cyan-400/50",
    selection: isPink ? "selection:bg-pink-400" : "selection:bg-cyan-400",

    // Gradients
    titleGradient: isPink
      ? "from-pink-400 via-amber-400 to-pink-300"
      : "from-cyan-400 via-teal to-cyan-300",
    activeItemGradient: isPink
      ? "from-pink-500/20 to-amber-500/20"
      : "from-cyan-500/20 to-teal/20",
    iconBg: isPink
      ? "from-pink-500/20 to-amber-500/20"
      : "from-cyan-500/20 to-teal/20",
    cardGradient: isPink
      ? "from-pink-500/10 to-amber-500/5"
      : "from-cyan-500/10 to-teal/5",

    // Shadows
    activeItemShadow: isPink
      ? "shadow-[0_0_20px_rgba(236,72,153,0.2)]"
      : "shadow-[0_0_20px_rgba(6,182,212,0.2)]",
    shadowActive: isPink
      ? "shadow-[0_0_20px_rgba(251,191,36,0.3)]"
      : "shadow-[0_0_20px_rgba(20,184,166,0.3)]",
    glow: isPink
      ? "drop-shadow-[0_0_8px_rgba(236,72,153,0.4)]"
      : "drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]",

    // Button Specific
    buttonPrimary: isPink
      ? "bg-gradient-to-r from-pink-500 to-amber-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)]"
      : "bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]",
    buttonSecondary: isPink
      ? "bg-[#2d1b29] text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.2)] hover:bg-[#3d2435] hover:shadow-[0_0_20px_rgba(236,72,153,0.3)]"
      : "bg-[#1a2942] text-[#38bdf8] shadow-[0_0_15px_rgba(59,130,246,0.2)] hover:bg-[#1e3a5f] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]",
    buttonOutline: isPink
      ? "bg-transparent shadow-[0_0_0_2px_rgba(236,72,153,0.4)_inset] hover:shadow-[0_0_0_2px_rgba(236,72,153,0.8)_inset,0_0_20px_rgba(236,72,153,0.3)] hover:bg-pink-500/10 text-pink-400"
      : "bg-transparent shadow-[0_0_0_2px_rgba(6,182,212,0.4)_inset] hover:shadow-[0_0_0_2px_rgba(6,182,212,0.8)_inset,0_0_20px_rgba(6,182,212,0.3)] hover:bg-[#06b6d4]/10 text-[#06b6d4]",
    buttonGhost: isPink
      ? "hover:bg-pink-500/10 hover:text-pink-300"
      : "hover:bg-accent hover:text-accent-foreground",
    buttonFocus: isPink
      ? "focus-visible:shadow-[0_0_0_3px_rgba(236,72,153,0.4)]"
      : "focus-visible:shadow-[0_0_0_3px_rgba(6,182,212,0.4)]",

    // Card Specific
    cardBg: isPink
      ? "bg-white/80 text-slate-900 backdrop-blur-md border-pink-200/50"
      : "bg-[#0f1d2e] text-white",
    cardShadow: isPink
      ? "shadow-[0_8px_32px_rgba(236,72,153,0.15)] hover:shadow-[0_8px_32px_rgba(236,72,153,0.25)]"
      : "shadow-[0_0_20px_rgba(59,130,246,0.2)]",
    cardTitle: isPink
      ? "text-slate-900"
      : "text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]",
    cardDescription: isPink ? "text-slate-500" : "text-muted-foreground",

    // Dialog Specific
    dialogBg: isPink ? "bg-[#1a0a14]/95 border-pink-500/20" : "bg-[#0f1d2e]",
    dialogShadow: isPink
      ? "shadow-[0_0_40px_rgba(236,72,153,0.4)]"
      : "shadow-[0_0_40px_rgba(59,130,246,0.4)]",
    dialogClose: isPink ? "text-pink-400" : "text-[#38bdf8]",
    dialogTitle: isPink ? "text-pink-400" : "text-[#06b6d4]",
    dialogDescription: isPink ? "text-pink-400/80" : "text-[#38bdf8]/80",

    // Select Specific
    selectTriggerBg: isPink ? "bg-[#1a0a14]/50" : "bg-[#0a1628]/50",
    selectTriggerBorder: isPink
      ? "shadow-[0_0_0_1px_rgba(236,72,153,0.3)_inset]"
      : "shadow-[0_0_0_1px_rgba(6,182,212,0.3)_inset]",
    selectTriggerFocus: isPink
      ? "focus-visible:shadow-[0_0_0_2px_rgba(236,72,153,0.6)_inset,0_0_20px_rgba(236,72,153,0.3)] focus-visible:bg-[#2d1b29]"
      : "focus-visible:shadow-[0_0_0_2px_rgba(6,182,212,0.6)_inset,0_0_20px_rgba(6,182,212,0.3)] focus-visible:bg-[#0f1d2e]",
    selectContentBg: isPink ? "bg-[#1a0a14]" : "bg-[#0f1d2e]",
    selectContentShadow: isPink
      ? "shadow-[0_0_30px_rgba(236,72,153,0.4)]"
      : "shadow-[0_0_30px_rgba(59,130,246,0.4)]",
    selectIcon: isPink ? "text-pink-400" : "text-[#06b6d4]",
    selectItemFocus: isPink
      ? "focus:bg-pink-500/20 focus:text-pink-300"
      : "focus:bg-cyan-500/20 focus:text-cyan-300",
    selectItemIcon: isPink ? "text-pink-400" : "text-[#06b6d4]",

    // Checkbox
    checkboxChecked: isPink
      ? "data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
      : "data-[state=checked]:bg-primary data-[state=checked]:border-primary",

    // Radio Group
    radioChecked: isPink ? "text-pink-500" : "text-primary",
    radioDot: isPink ? "fill-pink-500" : "fill-primary",

    // Switch Specific
    switchChecked: isPink
      ? "data-[state=checked]:bg-pink-500"
      : "data-[state=checked]:bg-cyan-500",
    switchThumb: isPink ? "bg-white" : "bg-white",

    // Tabs Specific
    tabsListBg: isPink ? "bg-[#2d1b29]" : "bg-muted",
    tabsTriggerActive: isPink
      ? "data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-300"
      : "data-[state=active]:bg-background",

    // Textarea Specific
    textareaBorder: isPink
      ? "border-pink-400/30 focus-visible:border-pink-400"
      : "border-input focus-visible:border-ring",
    textareaRing: isPink
      ? "focus-visible:ring-pink-400/20"
      : "focus-visible:ring-ring/50",

    // Calculator Specific
    calculatorBg: isPink
      ? "bg-[#2d1b29] border-pink-500/20"
      : "bg-[#0f1d2e] border-[#3b82f6]/20",
    calculatorDisplayBg: isPink ? "bg-[#1a0a14]" : "bg-[#0a1628]",
    calculatorShadow: isPink
      ? "shadow-xl shadow-pink-900/10"
      : "shadow-xl shadow-blue-900/10",
    calculatorOperatorBtn: isPink
      ? "bg-none shadow-none hover:shadow-none bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20 text-pink-200"
      : "bg-none shadow-none hover:shadow-none bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/20 text-cyan-200",
    calculatorNumberBtn: isPink
      ? "bg-none shadow-none hover:shadow-none bg-[#3d2435] hover:bg-[#4d2d42] border-pink-500/10 text-pink-100"
      : "bg-none shadow-none hover:shadow-none bg-[#1e293b] hover:bg-[#334155] border-slate-700/50 text-slate-200",
    calculatorEqualBtn: isPink
      ? "bg-none shadow-none hover:shadow-none bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50"
      : "bg-none shadow-none hover:shadow-none bg-emerald-600/80 hover:bg-emerald-600 text-white border border-emerald-500/50",
    calculatorClearBtn: isPink
      ? "bg-none shadow-none hover:shadow-none bg-red-500/40 hover:bg-red-500/60 border border-red-400/40 text-red-100"
      : "bg-none shadow-none hover:shadow-none bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-red-200",
    calculatorBackspaceBtn: isPink
      ? "bg-none shadow-none hover:shadow-none bg-red-500/40 hover:bg-red-500/60 border border-red-400/40 text-red-100"
      : "bg-none shadow-none hover:shadow-none bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-red-200",
    calculatorTipBtn: isPink
      ? "bg-none shadow-none hover:shadow-none bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20 text-pink-200"
      : "bg-none shadow-none hover:shadow-none bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-200",
  };
}
