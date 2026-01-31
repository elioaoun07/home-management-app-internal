/**
 * Futuristic SVG Icon Library
 * Custom-designed icons matching the neon, cyberpunk aesthetic of the app
 * All icons feature:
 * - Clean, geometric shapes
 * - Smooth animations
 * - Neon glow effects
 * - Optimized paths for performance
 */

import { cn } from "@/lib/utils";

type IconProps = {
  className?: string;
  size?: number;
};

export const DollarSignIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2V22M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const TrendingUpIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M23 6L13.5 15.5L8.5 10.5L1 18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 6H23V12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const FilterIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const RefreshIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M21 3V9H15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 21V15H9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 9C20.2044 7.27636 19.0258 5.79547 17.5519 4.68293C16.078 3.57039 14.357 2.86118 12.5456 2.62046C10.7342 2.37974 8.8923 2.61682 7.20697 3.30557C5.52164 3.99431 4.05188 5.11191 2.95 6.55"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 15C3.79564 16.7236 4.97422 18.2045 6.44811 19.3171C7.922 20.4296 9.64302 21.1388 11.4544 21.3795C13.2658 21.6203 15.1077 21.3832 16.793 20.6944C18.4784 20.0057 19.9481 18.8881 21.05 17.45"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const XIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18 6L6 18M6 6L18 18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CheckIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20 6L9 17L4 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronLeftIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15 18L9 12L15 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronRightIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 18L15 12L9 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronDownIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 9L12 15L18 9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronUpIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18 15L12 9L6 15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const PlusIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 5V19M5 12H19"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const PlusCircleIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 8V16M8 12H16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MicIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2C10.3431 2 9 3.34315 9 5V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V5C15 3.34315 13.6569 2 12 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 19V23M8 23H16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ScanIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* QR code corners */}
    <path
      d="M3 7V5C3 3.89543 3.89543 3 5 3H7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 3H19C20.1046 3 21 3.89543 21 5V7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 17V19C21 20.1046 20.1046 21 19 21H17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 21H5C3.89543 21 3 20.1046 3 19V17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Scan line */}
    <path
      d="M4 12H20"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const CalculatorIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="4"
      y="2"
      width="16"
      height="20"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="8" y="6" width="8" height="3" rx="1" fill="currentColor" />
    <circle cx="9" cy="13" r="0.5" fill="currentColor" />
    <circle cx="12" cy="13" r="0.5" fill="currentColor" />
    <circle cx="15" cy="13" r="0.5" fill="currentColor" />
    <circle cx="9" cy="16" r="0.5" fill="currentColor" />
    <circle cx="12" cy="16" r="0.5" fill="currentColor" />
    <circle cx="15" cy="16" r="0.5" fill="currentColor" />
    <circle cx="9" cy="19" r="0.5" fill="currentColor" />
    <circle cx="12" cy="19" r="0.5" fill="currentColor" />
    <circle cx="15" cy="19" r="0.5" fill="currentColor" />
  </svg>
);

export const FileTextIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 2V8H20M16 13H8M16 17H8M10 9H8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CalendarIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="4"
      width="18"
      height="18"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 2V6M8 2V6M3 10H21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Edit2Icon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M17 3C17.2626 2.73735 17.5744 2.52901 17.9176 2.38687C18.2608 2.24473 18.6286 2.17157 19 2.17157C19.3714 2.17157 19.7392 2.24473 20.0824 2.38687C20.4256 2.52901 20.7374 2.73735 21 3C21.2626 3.26264 21.471 3.57444 21.6131 3.9176C21.7553 4.26077 21.8284 4.62856 21.8284 5C21.8284 5.37143 21.7553 5.73923 21.6131 6.08239C21.471 6.42555 21.2626 6.73735 21 7L7.5 20.5L2 22L3.5 16.5L17 3Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const PencilIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 20H21M16.5 3.50001C16.8978 3.10219 17.4374 2.87869 18 2.87869C18.2786 2.87869 18.5544 2.93355 18.8118 3.04017C19.0692 3.14679 19.303 3.30303 19.5 3.50001C19.697 3.697 19.8532 3.93085 19.9598 4.18822C20.0665 4.44559 20.1213 4.72144 20.1213 5.00001C20.1213 5.27859 20.0665 5.55444 19.9598 5.81181C19.8532 6.06918 19.697 6.30303 19.5 6.50001L7 19L3 20L4 16L16.5 3.50001Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Trash2Icon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 6H5H21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10 11V17M14 11V17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SaveIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16L21 8V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 21V13H7V21M7 3V8H15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const BarChart3Icon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 3V21H21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 16V11M12 16V8M17 16V13"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SparklesIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 3L13.5 7.5L18 9L13.5 10.5L12 15L10.5 10.5L6 9L10.5 7.5L12 3Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.3"
    />
    <path
      d="M19 6L19.5 7.5L21 8L19.5 8.5L19 10L18.5 8.5L17 8L18.5 7.5L19 6Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.3"
    />
    <path
      d="M6 16L6.5 17.5L8 18L6.5 18.5L6 20L5.5 18.5L4 18L5.5 17.5L6 16Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.3"
    />
  </svg>
);

export const ZapIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.2"
    />
  </svg>
);

export const ArrowLeftIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M19 12H5M12 19L5 12L12 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ListIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ArrowRightIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 12H19M12 5L19 12L12 19"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ArrowUpRightIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7 17L17 7M17 7H7M17 7V17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ArrowDownRightIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7 7L17 17M17 17H7M17 17V7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SquareIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="5"
      y="5"
      width="14"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
    />
  </svg>
);

export const CircleIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const GripVerticalIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="9" cy="5" r="1.5" fill="currentColor" />
    <circle cx="15" cy="5" r="1.5" fill="currentColor" />
    <circle cx="9" cy="12" r="1.5" fill="currentColor" />
    <circle cx="15" cy="12" r="1.5" fill="currentColor" />
    <circle cx="9" cy="19" r="1.5" fill="currentColor" />
    <circle cx="15" cy="19" r="1.5" fill="currentColor" />
  </svg>
);

export const RotateCcwIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 4V10H7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.51 15C4.15839 16.8404 5.38734 18.4202 7.01166 19.5014C8.63598 20.5826 10.5677 21.1066 12.5157 20.9945C14.4637 20.8824 16.3226 20.1402 17.8121 18.8798C19.3017 17.6193 20.3413 15.9089 20.7742 14.0064C21.2072 12.1038 21.0101 10.1104 20.2126 8.33214C19.4152 6.55383 18.0605 5.08254 16.3528 4.13276C14.6451 3.18299 12.6769 2.80638 10.7447 3.05771C8.81245 3.30905 7.01505 4.17433 5.64 5.52L1 10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const PanelLeftIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 3V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ShieldIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ClockIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 6V12L16 14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CalendarClockIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="4"
      width="18"
      height="18"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 2V6M8 2V6M3 10H21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="15"
      cy="16"
      r="3.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15 14.5V16L16 16.75"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const UserIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="7"
      r="4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MailIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="2"
      y="4"
      width="20"
      height="16"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M22 7L13.03 12.7C12.7213 12.8934 12.3643 12.996 12 12.996C11.6357 12.996 11.2787 12.8934 10.97 12.7L2 7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const KeyRoundIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="7.5"
      cy="15.5"
      r="5.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11.83 12.83L22 2.5L19.5 0L17 2.5L19.5 5L17 7.5L14.5 5L11.83 7.67"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const LockIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="11"
      width="18"
      height="11"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const LogOutIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 17L21 12L16 7M21 12H9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SettingsIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15V15Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const StarIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.2"
    />
  </svg>
);

// Category-specific icons
export const FoodIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Bowl */}
    <path
      d="M4 10C4 10 5 6 12 6C19 6 20 10 20 10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4 10H20V14C20 16.2091 18.2091 18 16 18H8C5.79086 18 4 16.2091 4 14V10Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Spoon */}
    <path
      d="M12 2V6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="3"
      r="1.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const TransportIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 17C3.89543 17 3 17.8954 3 19C3 20.1046 3.89543 21 5 21C6.10457 21 7 20.1046 7 19C7 17.8954 6.10457 17 5 17Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19 17C17.8954 17 17 17.8954 17 19C17 20.1046 17.8954 21 19 21C20.1046 21 21 20.1046 21 19C21 17.8954 20.1046 17 19 17Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 17H17M5 17H2V6C2 5.44772 2.44772 5 3 5H14C14.5523 5 15 5.44772 15 6V17M19 17H22V13M15 5H17.5L22 13M22 13H15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ShoppingBagIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 6H21M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Bills / Receipt icon
export const BillIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Receipt paper with zigzag bottom */}
    <path
      d="M4 2V22L6 20L8 22L10 20L12 22L14 20L16 22L18 20L20 22V2L18 4L16 2L14 4L12 2L10 4L8 2L6 4L4 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Bill lines */}
    <line
      x1="8"
      y1="8"
      x2="16"
      y2="8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="8"
      y1="12"
      x2="16"
      y2="12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="8"
      y1="16"
      x2="12"
      y2="16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Dollar sign or amount */}
    <circle cx="15" cy="16" r="1.5" stroke="currentColor" strokeWidth="1" />
  </svg>
);

export const HealthIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20.84 4.61C20.3292 4.099 19.7228 3.69365 19.0554 3.41708C18.3879 3.14052 17.6725 2.99817 16.95 2.99817C16.2275 2.99817 15.5121 3.14052 14.8446 3.41708C14.1772 3.69365 13.5708 4.099 13.06 4.61L12 5.67L10.94 4.61C9.9083 3.57831 8.50903 2.99871 7.05 2.99871C5.59096 2.99871 4.19169 3.57831 3.16 4.61C2.1283 5.64169 1.54871 7.04097 1.54871 8.5C1.54871 9.95903 2.1283 11.3583 3.16 12.39L4.22 13.45L12 21.23L19.78 13.45L20.84 12.39C21.351 11.8792 21.7563 11.2728 22.0329 10.6054C22.3095 9.93789 22.4518 9.22248 22.4518 8.5C22.4518 7.77752 22.3095 7.06211 22.0329 6.39464C21.7563 5.72718 21.351 5.12075 20.84 4.61V4.61Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const EntertainmentIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="2"
      y="7"
      width="20"
      height="15"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 3L12 7L8 3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const HomeIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 22V12H15V22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const EducationIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22 10V16M2 10L12 5L22 10L12 15L2 10Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 12V17C6 17 8 19 12 19C16 19 18 17 18 17V12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const GiftIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="8"
      width="18"
      height="4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 8V21M5 12V20C5 20.5304 5.21071 21.0391 5.58579 21.4142C5.96086 21.7893 6.46957 22 7 22H17C17.5304 22 18.0391 21.7893 18.4142 21.4142C18.7893 21.0391 19 20.5304 19 20V12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.5 8C6.83696 8 6.20107 7.73661 5.73223 7.26777C5.26339 6.79893 5 6.16304 5 5.5C5 4.83696 5.26339 4.20107 5.73223 3.73223C6.20107 3.26339 6.83696 3 7.5 3C11 3 12 8 12 8M16.5 8C17.163 8 17.7989 7.73661 18.2678 7.26777C18.7366 6.79893 19 6.16304 19 5.5C19 4.83696 18.7366 4.20107 18.2678 3.73223C17.7989 3.26339 17.163 3 16.5 3C13 3 12 8 12 8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CoffeeIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18 8H19C20.0609 8 21.0783 8.42143 21.8284 9.17157C22.5786 9.92172 23 10.9391 23 12C23 13.0609 22.5786 14.0783 21.8284 14.8284C21.0783 15.5786 20.0609 16 19 16H18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 8H18V17C18 18.0609 17.5786 19.0783 16.8284 19.8284C16.0783 20.5786 15.0609 21 14 21H6C4.93913 21 3.92172 20.5786 3.17157 19.8284C2.42143 19.0783 2 18.0609 2 17V8Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 1V4M10 1V4M14 1V4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IncomeIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2V22M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="12"
      r="11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.2"
    />
  </svg>
);

export const SmartphoneIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="5"
      y="2"
      width="14"
      height="20"
      rx="2"
      ry="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="12"
      y1="18"
      x2="12.01"
      y2="18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Subscription icon (recurring calendar)
export const SubscriptionIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="4"
      width="18"
      height="18"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 2V6M8 2V6M3 10H21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 14L10.5 16.5L16 11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Travel / Plane icon
export const TravelIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M21 16V8C21 7.44772 20.5523 7 20 7H16L13 2H11L12 7H8L6 5H4L5 8L4 11H6L8 9H12L11 14H13L16 9H20C20.5523 9 21 9.44772 21 10V16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 21H21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Household / House icon
export const HouseholdIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 22V12H15V22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="7" r="1.5" fill="currentColor" />
  </svg>
);

// Groceries / Cart icon
export const GroceriesIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="9" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
    <circle cx="20" cy="21" r="1" stroke="currentColor" strokeWidth="2" />
    <path
      d="M1 1H5L7.68 14.39C7.77 14.83 8.02 15.22 8.38 15.5C8.74 15.78 9.19 15.93 9.64 15.92H19.4C19.85 15.93 20.28 15.78 20.62 15.5C20.97 15.22 21.2 14.83 21.27 14.39L23 6H6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Restaurant / Utensils icon
export const RestaurantIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 2V11C3 12.1 3.9 13 5 13H7V22H9V13H11C12.1 13 13 12.1 13 11V2H11V9H9V2H7V9H5V2H3Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17 2V8C17 10.21 18.79 12 21 12V22H19V12C17.9 12 17 11.1 17 10V2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Fuel / Gas pump icon
export const FuelIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 22H15V7C15 5.9 14.1 5 13 5H5C3.9 5 3 5.9 3 7V22Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 9H12V13H6V9Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15 12H17C18.1 12 19 12.9 19 14V18C19 19.1 19.9 20 21 20C22.1 20 23 19.1 23 18V9L19 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 5L5 2H13L15 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Taxi / Car icon
export const TaxiIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10 3H14L16 6H19C20.1 6 21 6.9 21 8V16C21 17.1 20.1 18 19 18H17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 18H5C3.9 18 3 17.1 3 16V8C3 6.9 3.9 6 5 6H8L10 3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="17" cy="18" r="2" stroke="currentColor" strokeWidth="2" />
    <path
      d="M7 14H17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// Parking icon
export const ParkingIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 17V7H13C13.7956 7 14.5587 7.31607 15.1213 7.87868C15.6839 8.44129 16 9.20435 16 10C16 10.7956 15.6839 11.5587 15.1213 12.1213C14.5587 12.6839 13.7956 13 13 13H9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Clothing / Clothes icon
export const ClothesIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 2L4 6L6 8L8 6V22H16V6L18 8L20 6L16 2C16 2 14 4 12 4C10 4 8 2 8 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 4V8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Electronics icon
export const ElectronicsIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="2"
      y="3"
      width="20"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 21H16M12 17V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

// Pharmacy / Pill icon
export const PharmacyIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M10.5 20.5L3.5 13.5C2.12 12.12 2.12 9.88 3.5 8.5C4.88 7.12 7.12 7.12 8.5 8.5L15.5 15.5C16.88 16.88 16.88 19.12 15.5 20.5C14.12 21.88 11.88 21.88 10.5 20.5Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 14L14 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 8L18.5 5.5C19.88 4.12 19.88 1.88 18.5 0.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.5"
    />
  </svg>
);

// Doctor / Stethoscope icon
export const DoctorIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 4V7C4 10.31 6.69 13 10 13H14C17.31 13 20 10.31 20 7V4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 13V17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="20" r="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="20" cy="4" r="2" stroke="currentColor" strokeWidth="2" />
  </svg>
);

// Fitness / Dumbbell icon
export const FitnessIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 12H18M2 9H4V15H2V9ZM20 9H22V15H20V9ZM4 7H6V17H4V7ZM18 7H20V17H18V7Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Movies / Film icon
export const MoviesIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="2"
      y="2"
      width="20"
      height="20"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 2V22M17 2V22M2 12H22M2 7H7M2 17H7M17 7H22M17 17H22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Games / Gaming / PS5 Controller icon
export const GamesIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* PS5 DualSense controller shape */}
    <path
      d="M6 8C4 8 2 10 2 13C2 16 3 18 5 19C6 19.5 7 19 7.5 18L9 15H15L16.5 18C17 19 18 19.5 19 19C21 18 22 16 22 13C22 10 20 8 18 8H6Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Left D-pad */}
    <path
      d="M6 12H8M7 11V13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Right buttons - PlayStation style */}
    <circle cx="16" cy="11" r="1" fill="currentColor" />
    <circle cx="18" cy="12" r="1" fill="currentColor" />
    <circle cx="16" cy="13" r="1" fill="currentColor" />
    <circle cx="17" cy="12" r="1" stroke="currentColor" strokeWidth="0.5" />
    {/* Center touchpad */}
    <rect
      x="10"
      y="10"
      width="4"
      height="2"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1"
    />
    {/* Analog sticks */}
    <circle cx="9" cy="14" r="1.5" stroke="currentColor" strokeWidth="1" />
    <circle cx="15" cy="14" r="1.5" stroke="currentColor" strokeWidth="1" />
  </svg>
);

// Music / Note icon
export const MusicIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
    <circle cx="18" cy="14" r="3" stroke="currentColor" strokeWidth="2" />
    <path
      d="M9 18V5L21 3V14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Flights / Plane icon
export const FlightsIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M21 16V8C21 7.44772 20.5523 7 20 7H16L13 2H11L12 7H8L6 5H4L5 8L4 11H6L8 9H12L11 14H13L16 9H20C20.5523 9 21 9.44772 21 10V16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 21H21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Hotels / Bed icon
export const HotelsIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 4V20M2 16H22V20M22 16V12C22 10.3431 20.6569 9 19 9H11V16M2 9H6C7.10457 9 8 9.89543 8 11V16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="5" cy="11" r="2" stroke="currentColor" strokeWidth="2" />
  </svg>
);

// Rent / Housing / Apartment Building icon
export const RentIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Main building structure */}
    <path
      d="M4 21V8L12 3L20 8V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Ground line */}
    <path
      d="M2 21H22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Door */}
    <path
      d="M10 21V17C10 16.4 10.4 16 11 16H13C13.6 16 14 16.4 14 17V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Windows - top row */}
    <rect
      x="7"
      y="9"
      width="3"
      height="2.5"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="14"
      y="9"
      width="3"
      height="2.5"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    {/* Windows - bottom row */}
    <rect
      x="7"
      y="13"
      width="3"
      height="2.5"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="14"
      y="13"
      width="3"
      height="2.5"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

// Maintenance / Wrench icon
export const MaintenanceIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14.7 6.3C14.5 6.1 14.1 6 13.9 6C12.5 6 11.3 6.7 10.6 7.8C9.9 8.9 9.8 10.3 10.3 11.5L3 18.8L3.5 21L5.7 21.5L13 14.2C14.2 14.7 15.5 14.5 16.6 13.8C17.7 13.1 18.4 11.9 18.4 10.5C18.4 10.3 18.3 9.9 18.1 9.7L15.6 12.2C15.2 12.6 14.6 12.6 14.2 12.2L12.2 10.2C11.8 9.8 11.8 9.2 12.2 8.8L14.7 6.3Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Books icon
export const BooksIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2V2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 6H16M8 10H12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Donations / Heart-hand icon
export const DonationsIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 8C12 6.4 10.6 5 9 5C7.4 5 6 6.4 6 8C6 11 12 14 12 14C12 14 18 11 18 8C18 6.4 16.6 5 15 5C13.4 5 12 6.4 12 8Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19 14V18C19 19.1 18.1 20 17 20H7C5.9 20 5 19.1 5 18V14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Internet / Wifi icon
export const InternetIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 12.55C6.97 10.58 9.37 9.5 12 9.5C14.63 9.5 17.03 10.58 19 12.55"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M1.42 9C4.34 6.08 8.03 4.5 12 4.5C15.97 4.5 19.66 6.08 22.58 9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8.53 16.11C9.46 15.18 10.68 14.67 12 14.67C13.32 14.67 14.54 15.18 15.47 16.11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="20" r="1" fill="currentColor" />
  </svg>
);

// Electricity / Bolt icon
export const ElectricityIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Water / Droplet icon
export const WaterIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2.69L17.66 8.35C18.7724 9.45988 19.5275 10.8774 19.8343 12.4214C20.1411 13.9654 19.986 15.5651 19.3885 17.0172C18.791 18.4694 17.7782 19.7096 16.4781 20.5867C15.178 21.4639 13.6479 21.9398 12.08 21.9598H11.92C10.3521 21.9398 8.82199 21.4639 7.52191 20.5867C6.22183 19.7096 5.20898 18.4694 4.61151 17.0172C4.01404 15.5651 3.85892 13.9654 4.16572 12.4214C4.47253 10.8774 5.22761 9.45988 6.34 8.35L12 2.69Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Phone / Mobile icon
export const PhoneIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="5"
      y="2"
      width="14"
      height="20"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 18H12.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// Public Transit / Bus icon
export const PublicTransitIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 6C4 4.34315 5.34315 3 7 3H17C18.6569 3 20 4.34315 20 6V16C20 17.1046 19.1046 18 18 18H6C4.89543 18 4 17.1046 4 16V6Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4 10H20"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="7.5" cy="14.5" r="1.5" fill="currentColor" />
    <circle cx="16.5" cy="14.5" r="1.5" fill="currentColor" />
    <path
      d="M6 18V21M18 18V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// Tuition / Graduation cap icon
export const TuitionIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22 10V16M2 10L12 5L22 10L12 15L2 10Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 12V17C6 17 8 19 12 19C16 19 18 17 18 17V12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MonitorIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="2"
      y="3"
      width="20"
      height="14"
      rx="2"
      ry="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="8"
      y1="21"
      x2="16"
      y2="21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="12"
      y1="17"
      x2="12"
      y2="21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const WatchIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="6"
      y="8"
      width="12"
      height="8"
      rx="2"
      ry="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 8V4H15V8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 16V20H15V16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

// Midis / Lunch box icon
export const MidisIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="6"
      width="18"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 10H21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="8" cy="15" r="1.5" fill="currentColor" />
    <circle cx="16" cy="15" r="1.5" fill="currentColor" />
  </svg>
);

// Outing / Social icon
export const OutingIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="2" />
    <circle cx="15" cy="7" r="3" stroke="currentColor" strokeWidth="2" />
    <path
      d="M3 21V19C3 16.79 4.79 15 7 15H11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13 21V19C13 16.79 14.79 15 17 15H17C19.21 15 21 16.79 21 19V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Delivery / Scooter / Motorcycle icon
export const DeliveryIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Front wheel */}
    <circle cx="5" cy="17" r="3" stroke="currentColor" strokeWidth="2" />
    {/* Back wheel */}
    <circle cx="19" cy="17" r="3" stroke="currentColor" strokeWidth="2" />
    {/* Scooter body frame */}
    <path
      d="M8 17L10 12L16 12L19 14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Seat */}
    <path
      d="M10 12L9 10H13L12 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Handlebar */}
    <path
      d="M5 14V10L3 8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5 10L7 8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Delivery box on back */}
    <rect
      x="14"
      y="6"
      width="6"
      height="5"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M15.5 8.5H19"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    />
  </svg>
);

// Generator / Power icon
export const GeneratorIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="6"
      width="18"
      height="12"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 9L10 12H14L12 15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 6V4M18 6V4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 18V20M18 18V20"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Utilities / Electric / Power icon
export const UtilitiesIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Lightning bolt for electricity */}
    <path
      d="M13 2L4 14H11L10 22L19 10H12L13 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Water drop */}
    <path
      d="M20 14C20 14 22 16.5 22 18C22 19.7 20.7 21 19 21C17.3 21 16 19.7 16 18C16 16.5 18 14 18 14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Insurance / Shield check icon
export const InsuranceIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 12L11 14L15 10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Bank Fees / Bank charges icon (building with minus sign)
export const BankFeesIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Bank building base */}
    <path
      d="M3 21H21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Bank roof/pediment */}
    <path
      d="M5 21V11L12 4L19 11V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Columns */}
    <path
      d="M9 21V14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15 21V14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Minus sign representing fee/deduction */}
    <circle
      cx="18"
      cy="7"
      r="4"
      fill="currentColor"
      fillOpacity="0.2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M16 7H20"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// AI / ChatGPT / Robot icon
export const AIIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="4"
      y="8"
      width="16"
      height="12"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="13" r="1.5" fill="currentColor" />
    <circle cx="15" cy="13" r="1.5" fill="currentColor" />
    <path
      d="M9 17H15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 4V8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="3" r="1" fill="currentColor" />
    <path
      d="M2 12H4M20 12H22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Dates / Heart icon
export const DatesIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M20.84 4.61C20.3292 4.099 19.7228 3.69365 19.0554 3.41708C18.3879 3.14052 17.6725 2.99817 16.95 2.99817C16.2275 2.99817 15.5121 3.14052 14.8446 3.41708C14.1772 3.69365 13.5708 4.099 13.06 4.61L12 5.67L10.94 4.61C9.9083 3.57831 8.50903 2.99871 7.05 2.99871C5.59096 2.99871 4.19169 3.57831 3.16 4.61C2.1283 5.64169 1.54871 7.04097 1.54871 8.5C1.54871 9.95903 2.1283 11.3583 3.16 12.39L4.22 13.45L12 21.23L19.78 13.45L20.84 12.39C21.351 11.8792 21.7563 11.2728 22.0329 10.6054C22.3095 9.93789 22.4518 9.22248 22.4518 8.5C22.4518 7.77752 22.3095 7.06211 22.0329 6.39464C21.7563 5.72718 21.351 5.12075 20.84 4.61V4.61Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="currentColor"
      fillOpacity="0.2"
    />
  </svg>
);

// Cloud / GoogleOne icon
export const CloudIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18 10H16.74C16.36 8.58 15.52 7.35 14.38 6.44C13.25 5.54 11.86 5.01 10.4 5.01C8.94 5.01 7.55 5.54 6.41 6.44C5.27 7.35 4.43 8.58 4.05 10H3C2.20435 10 1.44129 10.3161 0.87868 10.8787C0.316071 11.4413 0 12.2044 0 13C0 13.7956 0.316071 14.5587 0.87868 15.1213C1.44129 15.6839 2.20435 16 3 16H18C18.7956 16 19.5587 15.6839 20.1213 15.1213C20.6839 14.5587 21 13.7956 21 13C21 12.2044 20.6839 11.4413 20.1213 10.8787C19.5587 10.3161 18.7956 10 18 10Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 19L10 21L8 23"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 19L14 21L16 23"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Lenses / Eye icon
export const LensesIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="12"
      r="3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Streaming / Netflix icon
export const StreamingIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="2"
      y="4"
      width="20"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polygon points="10,8 16,11 10,14" fill="currentColor" />
    <path
      d="M7 21H17"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 18V21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Code / GitHub Copilot icon
export const CodeIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <polyline
      points="16,18 22,12 16,6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="8,6 2,12 8,18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="14"
      y1="4"
      x2="10"
      y2="20"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Appliances / Washing Machine icon
export const AppliancesIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Main body */}
    <rect
      x="3"
      y="2"
      width="18"
      height="20"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Control panel line */}
    <line x1="3" y1="7" x2="21" y2="7" stroke="currentColor" strokeWidth="2" />
    {/* Drum door circle */}
    <circle cx="12" cy="14" r="5" stroke="currentColor" strokeWidth="2" />
    {/* Inner drum */}
    <circle cx="12" cy="14" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    {/* Control buttons */}
    <circle cx="6" cy="4.5" r="1" fill="currentColor" />
    <circle cx="9" cy="4.5" r="1" fill="currentColor" />
    {/* Display/dial */}
    <rect
      x="15"
      y="3.5"
      width="4"
      height="2"
      rx="0.5"
      stroke="currentColor"
      strokeWidth="1"
    />
  </svg>
);

// PoG / Church / Christian Community icon
export const PoGIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Church building */}
    <path
      d="M3 22V12L12 5L21 12V22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Ground line */}
    <path
      d="M1 22H23"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Church door */}
    <path
      d="M9 22V17C9 16.4 9.4 16 10 16H14C14.6 16 15 16.4 15 17V22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Steeple/tower */}
    <path
      d="M10 5V3L12 1L14 3V5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Cross on top */}
    <path
      d="M12 1V-1M10.5 0H13.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Window - circular rose window */}
    <circle cx="12" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    {/* Cross inside window */}
    <path
      d="M12 9V13M10.5 11H13.5"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    />
  </svg>
);

// Hub / Social / Community icon (message bubble with people)
export const HubIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Chat bubble */}
    <path
      d="M21 11.5C21 16.1944 16.9706 20 12 20C10.8053 20 9.66373 19.7965 8.61102 19.4285L3 21L4.39543 16.5917C3.51444 15.1378 3 13.3843 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Person 1 */}
    <circle cx="9" cy="10" r="1.5" fill="currentColor" />
    <path
      d="M9 13C7.5 13 6.5 13.5 6.5 14.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Person 2 */}
    <circle cx="15" cy="10" r="1.5" fill="currentColor" />
    <path
      d="M15 13C16.5 13 17.5 13.5 17.5 14.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

// Message / Chat bubble icon
export const MessageIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M21 11.5C21 16.1944 16.9706 20 12 20C10.8053 20 9.66373 19.7965 8.61102 19.4285L3 21L4.39543 16.5917C3.51444 15.1378 3 13.3843 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 10H16M8 14H12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// Activity Feed icon
export const FeedIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3"
      y="3"
      width="18"
      height="5"
      rx="1"
      stroke="currentColor"
      strokeWidth="2"
    />
    <rect
      x="3"
      y="10"
      width="18"
      height="5"
      rx="1"
      stroke="currentColor"
      strokeWidth="2"
    />
    <rect
      x="3"
      y="17"
      width="18"
      height="5"
      rx="1"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="6" cy="5.5" r="1" fill="currentColor" />
    <circle cx="6" cy="12.5" r="1" fill="currentColor" />
    <circle cx="6" cy="19.5" r="1" fill="currentColor" />
  </svg>
);

// Trophy / Scoreboard icon
export const TrophyIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 9H4C3.44772 9 3 8.55228 3 8V6C3 5.44772 3.44772 5 4 5H6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M18 9H20C20.5523 9 21 8.55228 21 8V6C21 5.44772 20.5523 5 20 5H18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M6 5H18V10C18 13.3137 15.3137 16 12 16C8.68629 16 6 13.3137 6 10V5Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M12 16V19"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M8 22H16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M10 19H14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// Bell / Alert icon
export const AlertBellIcon = ({
  className,
  size = 24,
  showDot = true,
}: IconProps & { showDot?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Notification dot */}
    {showDot && (
      <circle
        cx="18"
        cy="5"
        r="3"
        fill="currentColor"
        className="text-red-500"
      />
    )}
  </svg>
);

export const SendIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const EyeIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="12"
      r="3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const EyeOffIcon = ({ className, size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={cn("transition-all duration-300", className)}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="1"
      y1="1"
      x2="23"
      y2="23"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
