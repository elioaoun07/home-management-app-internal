/**
 * Helper to get category color from transactions or defaults
 */

type Transaction = {
  category?: string | null;
  category_color?: string;
  [key: string]: any;
};

/**
 * Extracts a map of category names to their colors from transaction data
 */
export function getCategoryColorsMap(
  transactions: Transaction[]
): Map<string, string> {
  const colorMap = new Map<string, string>();

  transactions.forEach((tx) => {
    if (tx.category && tx.category_color) {
      colorMap.set(tx.category, tx.category_color);
    }
  });

  return colorMap;
}

/**
 * Gets the color for a specific category, with fallback to default
 */
export function getCategoryColor(
  categoryName: string | null | undefined,
  colorMap: Map<string, string>,
  defaultColor: string = "#38bdf8"
): string {
  if (!categoryName) return defaultColor;
  return colorMap.get(categoryName) || defaultColor;
}
