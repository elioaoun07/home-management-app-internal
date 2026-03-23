---
created: 2026-03-23
type: ui
module: cross-cutting
module-type: n/a
status: active
tags:
  - type/ui
  - scope/routes
---
# App Routes & Icons Reference

> **Purpose**: Central documentation of all app routes and their associated icons. All new routes/icons should be added here.

---

## 📱 Mobile Navigation (Main App)

| Route        | Tab ID      | Icon                        | Source                |
| ------------ | ----------- | --------------------------- | --------------------- |
| `/expense`   | `expense`   | `ExpenseIcon` (Dollar Sign) | `SemiDonutFAB` custom |
| `/dashboard` | `dashboard` | `BarChart3Icon`             | `FuturisticIcons.tsx` |
| `/reminder`  | `reminder`  | `ReminderIcon` (Bell)       | `SemiDonutFAB` custom |
| `/recurring` | `recurring` | `CalendarClockIcon`         | `FuturisticIcons.tsx` |

---

## 🎯 Standalone App Routes

| Route        | Name               | Icon                       | Color Gradient                    |
| ------------ | ------------------ | -------------------------- | --------------------------------- |
| `/focus`     | Focus              | `FocusIcon`                | Theme-based                       |
| `/catalogue` | Catalogue          | `BookOpen` (lucide)        | `from-emerald-400 to-emerald-600` |
| `/recipe`    | Recipes            | `UtensilsCrossed` (lucide) | `from-orange-400 to-orange-600`   |
| `/chat`      | Hub Chat           | `HubIcon` / `MessageIcon`  | `from-cyan-400 to-cyan-600`       |
| `/alerts`    | Notifications      | `AlertBellIcon`            | Theme-based                       |
| `/reminders` | Reminders          | `CalendarClockIcon`        | `from-amber-400 to-amber-600`     |
| `/recurring` | Recurring Payments | `CalendarClockIcon`        | Theme-based                       |

---

## 🖥️ Web View Navigation

### Top-Level View Modes

| View Mode | Icon              | Icon Source  |
| --------- | ----------------- | ------------ |
| Events    | `CalendarDays`    | lucide-react |
| Budget    | `Wallet`          | lucide-react |
| Catalogue | `BookOpen`        | lucide-react |
| Recipes   | `UtensilsCrossed` | lucide-react |

### Budget Sub-tabs

| Tab       | Icon        | Icon Source  |
| --------- | ----------- | ------------ |
| Dashboard | `BarChart3` | lucide-react |
| Budget    | `Wallet`    | lucide-react |
| Goals     | `Rocket`    | lucide-react |

### Recipes Sub-tabs

| Tab          | Icon           | Icon Source  |
| ------------ | -------------- | ------------ |
| Recipes      | `BookOpen`     | lucide-react |
| Meal Planner | `CalendarDays` | lucide-react |

---

## 🔐 Authentication Routes (No Icons in Nav)

| Route             | Purpose               |
| ----------------- | --------------------- |
| `/login`          | User login            |
| `/signup`         | New user registration |
| `/reset-password` | Password reset        |
| `/welcome`        | Onboarding flow       |

---

## 🔧 Utility Routes

| Route            | Purpose               | Icon (if any)  |
| ---------------- | --------------------- | -------------- |
| `/settings`      | User settings         | `SettingsIcon` |
| `/quick-expense` | Quick add expense     | N/A            |
| `/error-logs`    | Debug error logs      | N/A            |
| `/qr/expense`    | QR code expense entry | N/A            |
| `/g/[tag]`       | Guest portal (public) | N/A            |

---

## 🎨 Available Futuristic Icons

All icons are in `src/components/icons/FuturisticIcons.tsx`:

### Navigation & Actions

- `BarChart3Icon` - Dashboard/analytics
- `HubIcon` - Hub/chat area
- `FocusIcon` - Focus mode
- `SettingsIcon` - Settings
- `PlusIcon` / `PlusCircleIcon` - Add actions
- `MicIcon` - Voice input
- `ScanIcon` - QR scanning
- `SendIcon` - Send message
- `AlertBellIcon` - Notifications

### Finance & Categories

- `DollarSignIcon` - Currency/expense
- `IncomeIcon` - Income
- `TrendingUpIcon` - Trends
- `WalletIcon` (use lucide) - Budget
- `BillIcon` - Bills
- `BankFeesIcon` - Bank fees
- `InsuranceIcon` - Insurance

### Time & Calendar

- `CalendarIcon` - Date picker
- `CalendarClockIcon` - Recurring/scheduled
- `ClockIcon` - Time
- `DatesIcon` - Date ranges

### Categories (Expense)

- `FoodIcon` - Food
- `TransportIcon` - Transport
- `ShoppingBagIcon` - Shopping
- `HealthIcon` - Health
- `EntertainmentIcon` - Entertainment
- `HomeIcon` - Home
- `EducationIcon` - Education
- `GiftIcon` - Gifts
- `CoffeeIcon` - Coffee/drinks
- `TravelIcon` - Travel
- `GroceriesIcon` - Groceries
- `RestaurantIcon` - Restaurants
- `FuelIcon` - Fuel
- `TaxiIcon` - Taxi
- `ParkingIcon` - Parking
- `ClothesIcon` - Clothes
- `ElectronicsIcon` - Electronics
- `PharmacyIcon` - Pharmacy
- `DoctorIcon` - Medical
- `FitnessIcon` - Fitness
- `MoviesIcon` - Movies
- `GamesIcon` - Games
- `MusicIcon` - Music
- `FlightsIcon` - Flights
- `HotelsIcon` - Hotels
- `RentIcon` - Rent
- `MaintenanceIcon` - Maintenance
- `BooksIcon` - Books
- `DonationsIcon` - Donations
- `InternetIcon` - Internet
- `ElectricityIcon` - Electricity
- `WaterIcon` - Water
- `PhoneIcon` - Phone
- `PublicTransitIcon` - Public transit
- `TuitionIcon` - Tuition
- `StreamingIcon` - Streaming
- `SubscriptionIcon` - Subscriptions
- `HouseholdIcon` - Household
- `UtilitiesIcon` - Utilities
- `GeneratorIcon` - Generator
- `DeliveryIcon` - Delivery
- `OutingIcon` - Outing
- `AppliancesIcon` - Appliances

### UI Elements

- `ChevronLeftIcon` / `ChevronRightIcon` / `ChevronDownIcon` / `ChevronUpIcon`
- `ArrowLeftIcon` / `ArrowRightIcon` / `ArrowUpRightIcon` / `ArrowDownRightIcon`
- `XIcon` - Close
- `CheckIcon` - Confirm
- `Edit2Icon` / `PencilIcon` - Edit
- `Trash2Icon` - Delete
- `SaveIcon` - Save
- `RefreshIcon` - Refresh
- `RotateCcwIcon` - Undo
- `FilterIcon` - Filter
- `ListIcon` - List view
- `GripVerticalIcon` - Drag handle
- `EyeIcon` / `EyeOffIcon` - Visibility toggle
- `SparklesIcon` - AI/special
- `ZapIcon` - Quick action
- `StarIcon` - Favorite
- `TrophyIcon` - Achievement
- `ShieldIcon` - Security
- `LockIcon` - Locked
- `KeyRoundIcon` - Key
- `AIIcon` - AI assistant

### User & Communication

- `UserIcon` - User/profile
- `MailIcon` - Email
- `LogOutIcon` - Logout
- `MessageIcon` - Messages
- `FeedIcon` - Activity feed

### Devices

- `SmartphoneIcon` - Phone
- `MonitorIcon` - Monitor
- `WatchIcon` - Watch
- `CloudIcon` - Cloud

### Miscellaneous

- `SquareIcon` / `CircleIcon` - Shapes
- `PanelLeftIcon` - Sidebar
- `CodeIcon` - Development
- `LensesIcon` - Contact lenses
- `MidisIcon` - Midis (custom)
- `PoGIcon` - Pokemon Go (custom)

---

## ✅ Adding New Routes Checklist

When adding a new route with an icon:

1. [ ] Add route to this document
2. [ ] Create/use appropriate icon from `FuturisticIcons.tsx` or `lucide-react`
3. [ ] If standalone app, add to `STANDALONE_APPS` in `ConditionalHeader.tsx`
4. [ ] If main nav item, update `MobileNav.tsx`
5. [ ] Update PWA manifest shortcuts if needed (`public/manifest.json`)
6. [ ] Add to `standaloneRoutes` array in `MobileNav.tsx` if applicable

---

_Last Updated: February 15, 2026_
