// ExpenseComponents.jsx — ERA.AI expense form building blocks
// All components share brand tokens from colors_and_type.css

const { useState, useRef, useEffect } = React;

// ---- Small atoms -------------------------------------------------------
const MicroLabel = ({ children, style = {} }) => (
  <div
    style={{
      fontSize: 10,
      fontWeight: 500,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: "var(--era-fg-2)",
      ...style,
    }}
  >
    {children}
  </div>
);

const HeroMoney = ({ children, size = 24 }) => (
  <div
    style={{
      fontSize: size,
      fontWeight: 700,
      fontVariantNumeric: "tabular-nums",
      background: "var(--era-gradient-title)",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      filter: "drop-shadow(var(--era-glow-sm))",
      lineHeight: 1.1,
    }}
  >
    {children}
  </div>
);

const IconButton = ({ children, active, onClick, title }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 36,
      height: 36,
      borderRadius: 9999,
      background: active ? "rgba(6,182,212,0.18)" : "rgba(6,182,212,0.08)",
      boxShadow: active
        ? "0 0 0 1px rgba(6,182,212,0.6) inset, 0 0 12px rgba(6,182,212,0.25)"
        : "0 0 0 1px rgba(6,182,212,0.3) inset",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--era-secondary)",
      border: "none",
      cursor: "pointer",
      transition: "all 0.2s var(--era-ease-default)",
      filter: "drop-shadow(var(--era-glow-sm))",
    }}
  >
    {children}
  </button>
);

// ---- Icons (Lucide-style inline SVGs, stand-in for FuturisticIcons) ----
const ic = {
  dollar: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  calc: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10" />
      <line x1="12" y1="10" x2="12" y2="10" />
      <line x1="16" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="8" y2="14" />
      <line x1="12" y1="14" x2="12" y2="14" />
      <line x1="16" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="8" y2="18" />
      <line x1="12" y1="18" x2="12" y2="18" />
      <line x1="16" y1="18" x2="16" y2="18" />
    </svg>
  ),
  mic: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  ),
  wifi_off: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  check: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  x: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  arrow_right: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  chevron_left: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  save: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  calendar: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  cart: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  coffee: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  ),
  car: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
      <circle cx="6.5" cy="16.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
    </svg>
  ),
  home: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  heart: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  bolt: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  folder: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  list: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  chat: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  plus: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
};

// ---- Sticky header -----------------------------------------------------
function AppHeader({ online = true, drafts = 0 }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        padding: "10px 16px 10px",
        background: "color-mix(in srgb, var(--era-bg) 85%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 0 var(--era-border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img
          src="../../assets/expense-icon.svg"
          style={{
            width: 26,
            height: 26,
            filter: "drop-shadow(var(--era-glow-sm))",
          }}
        />
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: -0.01,
            background: "var(--era-gradient-title)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          New Expense
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!online && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 9999,
              background: "rgba(245,158,11,0.12)",
              color: "#f59e0b",
              boxShadow: "0 0 0 1px rgba(245,158,11,0.35) inset",
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {ic.wifi_off} Offline
          </div>
        )}
        {drafts > 0 && (
          <div
            style={{
              padding: "4px 8px",
              borderRadius: 9999,
              background: "rgba(251,191,36,0.12)",
              color: "#fbbf24",
              boxShadow: "0 0 0 1px rgba(251,191,36,0.35) inset",
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {drafts} drafts
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Balance row -------------------------------------------------------
function BalanceRow({
  balance = "$1,248.50",
  lbp = "L.L. 110,000,000",
  theme = "blue",
}) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        background: "var(--era-bg-card)",
        boxShadow: "var(--era-ring-inset), var(--era-shadow-card)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
      }}
    >
      <div>
        <MicroLabel>Account Balance</MicroLabel>
        <HeroMoney>{balance}</HeroMoney>
        <div
          style={{
            fontSize: 11,
            color: "var(--era-fg-3)",
            fontVariantNumeric: "tabular-nums",
            marginTop: 2,
          }}
        >
          {lbp}
        </div>
      </div>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 9999,
          background: "rgba(6,182,212,0.1)",
          boxShadow: "0 0 0 1px rgba(6,182,212,0.3) inset",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--era-secondary)",
          filter: "drop-shadow(var(--era-glow-sm))",
        }}
      >
        {ic.dollar}
      </div>
    </div>
  );
}

// ---- Step indicator ----------------------------------------------------
function StepIndicator({
  steps = ["Amount", "Category", "Subcategory", "Confirm"],
  current = 0,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 18,
        justifyContent: "center",
      }}
    >
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 9999,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "var(--era-font-mono)",
              background:
                i < current
                  ? "rgba(16,185,129,0.15)"
                  : i === current
                    ? "var(--era-gradient-primary)"
                    : "rgba(6,182,212,0.08)",
              color:
                i < current
                  ? "#10b981"
                  : i === current
                    ? "#fff"
                    : "var(--era-fg-3)",
              boxShadow:
                i === current
                  ? "0 0 16px rgba(6,182,212,0.45)"
                  : i < current
                    ? "0 0 0 1px rgba(16,185,129,0.45) inset"
                    : "0 0 0 1px rgba(6,182,212,0.2) inset",
            }}
          >
            {i < current ? "✓" : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div
              style={{
                flex: 1,
                height: 2,
                maxWidth: 28,
                background: i < current ? "#10b981" : "rgba(6,182,212,0.18)",
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---- Amount step -------------------------------------------------------
function AmountStep({ value, onChange, onNext, onCalc, onMic, micActive }) {
  return (
    <div>
      <MicroLabel style={{ marginBottom: 8 }}>Amount</MicroLabel>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <span
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--era-secondary)",
            fontWeight: 700,
            fontSize: 20,
            filter: "drop-shadow(var(--era-glow-sm))",
          }}
        >
          $
        </span>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0.00"
          inputMode="decimal"
          className="era-input"
          style={{
            height: 56,
            fontSize: 22,
            fontWeight: 700,
            paddingLeft: 36,
            paddingRight: 96,
            fontVariantNumeric: "tabular-nums",
            background: "color-mix(in srgb, var(--era-bg) 40%, transparent)",
            boxShadow: "var(--era-ring-inset-focus)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            gap: 6,
          }}
        >
          <IconButton onClick={onCalc} title="Calculator">
            {ic.calc}
          </IconButton>
          <IconButton active={micActive} onClick={onMic} title="Voice">
            {ic.mic}
          </IconButton>
        </div>
      </div>

      {/* Quick amounts */}
      <div
        style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}
      >
        {["5", "10", "25", "50", "100"].map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 9999,
              background: "rgba(6,182,212,0.08)",
              color: "var(--era-secondary)",
              boxShadow: "0 0 0 1px rgba(6,182,212,0.3) inset",
              border: "none",
              fontWeight: 500,
              fontSize: 13,
              cursor: "pointer",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${v}
          </button>
        ))}
      </div>

      <MicroLabel style={{ marginBottom: 8 }}>
        Description (optional)
      </MicroLabel>
      <input
        placeholder="e.g. Groceries at Carrefour"
        className="era-input"
        style={{ marginBottom: 24 }}
      />

      <button
        onClick={onNext}
        disabled={!value}
        className="era-btn-primary"
        style={{
          width: "100%",
          opacity: value ? 1 : 0.45,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          Next {ic.arrow_right}
        </span>
      </button>
    </div>
  );
}

// ---- Category step -----------------------------------------------------
const CATEGORIES = [
  { name: "Groceries", color: "#10b981", icon: ic.cart },
  { name: "Dining", color: "#f59e0b", icon: ic.coffee },
  { name: "Transport", color: "#3b82f6", icon: ic.car },
  { name: "Rent", color: "#8b5cf6", icon: ic.home },
  { name: "Health", color: "#ef4444", icon: ic.heart },
  { name: "Utilities", color: "#06b6d4", icon: ic.bolt },
  { name: "Shopping", color: "#ec4899", icon: ic.cart },
  { name: "Other", color: "#78716c", icon: ic.folder },
];

function CategoryStep({ selected, onSelect, onBack }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <IconButton onClick={onBack} title="Back">
          {ic.chevron_left}
        </IconButton>
        <MicroLabel>Category</MicroLabel>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {CATEGORIES.map((c) => {
          const sel = selected === c.name;
          return (
            <button
              key={c.name}
              onClick={() => onSelect(c.name)}
              style={{
                padding: "14px 8px",
                borderRadius: 12,
                background: sel
                  ? "color-mix(in srgb, var(--era-secondary) 12%, var(--era-bg-card))"
                  : "var(--era-bg-card)",
                boxShadow: sel
                  ? "0 0 0 2px rgba(6,182,212,0.6) inset, 0 0 16px rgba(6,182,212,0.25)"
                  : "var(--era-ring-inset)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                color: "var(--era-fg-1)",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                transition: "all 0.2s var(--era-ease-default)",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9999,
                  background: c.color,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {c.icon}
              </div>
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Confirm step ------------------------------------------------------
function ConfirmStep({ amount, category, desc, onBack, onConfirm, saving }) {
  const cat = CATEGORIES.find((c) => c.name === category) || CATEGORIES[0];
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <IconButton onClick={onBack} title="Back">
          {ic.chevron_left}
        </IconButton>
        <MicroLabel>Review</MicroLabel>
      </div>

      <div
        style={{
          padding: 18,
          borderRadius: 14,
          background: "var(--era-bg-card)",
          boxShadow: "var(--era-ring-inset), var(--era-shadow-card)",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <MicroLabel>Amount</MicroLabel>
          <div
            style={{
              fontSize: 11,
              color: "var(--era-fg-3)",
              fontFamily: "var(--era-font-mono)",
            }}
          >
            Today · 2:14 PM
          </div>
        </div>
        <HeroMoney size={32}>
          {"$" + parseFloat(amount || 0).toFixed(2)}
        </HeroMoney>
        <div
          style={{
            fontSize: 12,
            color: "var(--era-fg-3)",
            fontVariantNumeric: "tabular-nums",
            marginTop: 4,
          }}
        >
          ≈ L.L. {(parseFloat(amount || 0) * 89500).toLocaleString()}
        </div>

        <div
          style={{
            height: 1,
            background: "var(--era-border)",
            margin: "16px 0",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9999,
              background: cat.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            {cat.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{cat.name}</div>
            {desc && (
              <div style={{ fontSize: 12, color: "var(--era-fg-3)" }}>
                {desc}
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={onConfirm}
        className="era-btn-primary"
        style={{ width: "100%", marginBottom: 8 }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {saving ? "Saving…" : <>Confirm {ic.check}</>}
        </span>
      </button>
      <button className="era-btn-outline" style={{ width: "100%" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {ic.save} Save as draft
        </span>
      </button>
    </div>
  );
}

// ---- Success toast -----------------------------------------------------
function SuccessToast({ show, amount, category }) {
  if (!show) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 70,
        left: 16,
        right: 16,
        zIndex: 100,
        padding: 14,
        borderRadius: 12,
        background: "rgba(16,185,129,0.12)",
        boxShadow:
          "0 0 0 1px rgba(16,185,129,0.5) inset, 0 8px 28px rgba(16,185,129,0.25)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: "#10b981",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 9999,
          background: "rgba(16,185,129,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {ic.check}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#fff" }}>
          Expense added!
        </div>
        <div style={{ fontSize: 12, color: "var(--era-fg-3)" }}>
          ${amount} for {category}
        </div>
      </div>
    </div>
  );
}

// ---- Bottom nav --------------------------------------------------------
function BottomNav({ active = "expense" }) {
  const items = [
    {
      id: "dashboard",
      label: "Home",
      icon: ic.home,
      src: "../../assets/dashboard-icon.svg",
    },
    {
      id: "catalogue",
      label: "Catalog",
      icon: ic.list,
      src: "../../assets/catalogue-icon.svg",
    },
    {
      id: "expense",
      label: "Expense",
      icon: ic.plus,
      src: "../../assets/expense-icon.svg",
      primary: true,
    },
    {
      id: "chat",
      label: "Chat",
      icon: ic.chat,
      src: "../../assets/chat-icon.svg",
    },
    {
      id: "reminders",
      label: "Reminders",
      icon: ic.calendar,
      src: "../../assets/reminders-icon.svg",
    },
  ];
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 34,
        zIndex: 40,
        padding: "8px 12px 10px",
        background: "color-mix(in srgb, var(--era-bg-card) 88%, transparent)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        boxShadow: "0 -1px 0 var(--era-border), 0 -8px 32px rgba(0,0,0,0.3)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "flex-end",
      }}
    >
      {items.map((it) => {
        const act = it.id === active;
        if (it.primary) {
          return (
            <button
              key={it.id}
              style={{
                width: 54,
                height: 54,
                borderRadius: 9999,
                marginTop: -18,
                background: "var(--era-gradient-primary)",
                boxShadow:
                  "0 0 24px rgba(6,182,212,0.5), 0 0 0 3px var(--era-bg-card)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {it.icon}
            </button>
          );
        }
        return (
          <button
            key={it.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: act ? "var(--era-secondary)" : "var(--era-fg-4)",
              padding: "4px 8px",
              filter: act ? "drop-shadow(var(--era-glow-sm))" : "none",
            }}
          >
            <img
              src={it.src}
              style={{ width: 22, height: 22, opacity: act ? 1 : 0.55 }}
            />
            <div style={{ fontSize: 10, fontWeight: 500 }}>{it.label}</div>
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  MicroLabel,
  HeroMoney,
  IconButton,
  AppHeader,
  BalanceRow,
  StepIndicator,
  AmountStep,
  CategoryStep,
  ConfirmStep,
  SuccessToast,
  BottomNav,
  EXPENSE_ICONS: ic,
  CATEGORIES,
});
