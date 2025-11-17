/**
 * Secure credential caching for "Remember Me" functionality
 * Uses browser's localStorage with basic obfuscation
 * Note: For production, consider more secure alternatives like encrypted storage
 */

const STORAGE_KEY = "hm_auth_remember";
const EXPIRY_DAYS = 30;

interface StoredCredentials {
  username: string;
  rememberMe: boolean;
  timestamp: number;
}

/**
 * Simple obfuscation (not encryption) - keeps credentials from being plaintext
 */
function encode(str: string): string {
  try {
    return btoa(encodeURIComponent(str));
  } catch {
    return str;
  }
}

function decode(str: string): string {
  try {
    return decodeURIComponent(atob(str));
  } catch {
    return str;
  }
}

export function saveCredentials(username: string, rememberMe: boolean): void {
  if (typeof window === "undefined") return;

  try {
    if (rememberMe) {
      const data: StoredCredentials = {
        username: encode(username),
        rememberMe,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      // Clear stored credentials if user unchecks "Remember Me"
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Failed to save credentials:", error);
  }
}

export function loadCredentials(): {
  username: string;
  rememberMe: boolean;
} | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data: StoredCredentials = JSON.parse(stored);

    // Check if credentials have expired
    const daysSinceStored =
      (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceStored > EXPIRY_DAYS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      username: decode(data.username),
      rememberMe: data.rememberMe,
    };
  } catch (error) {
    console.warn("Failed to load credentials:", error);
    return null;
  }
}

export function clearCredentials(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear credentials:", error);
  }
}
