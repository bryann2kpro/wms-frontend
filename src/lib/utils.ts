import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Utility function to format dates
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-MY", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}

// Utility function to format dates (date only, no time)
export function formatDateOnly(dateValue: string | number | Date): string {
  try {
    let date: Date;
    
    // Handle number (timestamp)
    if (typeof dateValue === "number") {
      date = new Date(dateValue);
    }
    // Handle Date object
    else if (dateValue instanceof Date) {
      date = dateValue;
    }
    // Handle string - check if it's a numeric string (timestamp)
    else if (typeof dateValue === "string") {
      // Check if string is a pure number (timestamp)
      if (/^\d+$/.test(dateValue.trim())) {
        date = new Date(Number(dateValue));
      } else {
        date = new Date(dateValue);
      }
    } else {
      return String(dateValue);
    }
    
    if (isNaN(date.getTime())) {
      return String(dateValue);
    }
    
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return String(dateValue);
  }
}

// Extract error message from various error types
export function getErrorMessage(err: Error | null): string {
  if (!err) return "An unexpected error occurred";

  // Check for Axios error response
  const axiosError = err as {
    response?: { data?: { message?: string; code?: string }; status?: number };
  };
  const status = axiosError.response?.status;
  const data = axiosError.response?.data;
  const code = data?.code;
  const message = data?.message;

  if (status === 500 || code === "INTERNAL_SERVER_ERROR") {
    return "Internal Server Error";
  }
  if (typeof message === "string" && message.includes("INTERNAL_SERVER_ERROR")) {
    return "Internal Server Error";
  }
  if (data?.message) {
    return toUserFriendlyMessage(data.message, "An unexpected error occurred");
  }
  if (status === 401) {
    return "Session expired. Please log in again.";
  }
  if (status === 403) {
    return "You don't have permission to perform this action.";
  }

  // Network error
  if (err.message === "Network Error") {
    return "Unable to connect to server. Please check your connection.";
  }

  if (err.message === "INTERNAL_SERVER_ERROR") {
    return "Internal Server Error";
  }

  return toUserFriendlyMessage(err.message || "An unexpected error occurred", "An unexpected error occurred");
}

/**
 * Replace raw technical/log messages with a user-friendly fallback.
 * Backend sometimes returns audit params, JSON dumps, or stack traces as the "message".
 */
export function toUserFriendlyMessage(raw: string, fallback: string): string {
  if (!raw || typeof raw !== "string") return fallback;
  const s = raw.trim();
  if (s === "INTERNAL_SERVER_ERROR") return "Internal Server Error";
  if (s.length > 400) return fallback;
  const technicalMarkers = [
    "audit_log_id",
    "params:",
    "user_agent",
    "old_data",
    "new_data",
    "graphQLErrors",
    '"query":[',
    "pagination",
    "Mozilla/5.0",
  ];
  const looksTechnical = technicalMarkers.some((m) => s.includes(m));
  return looksTechnical ? fallback : s;
}

// Role badge colors
export const roleBadgeColors: Record<string, string> = {
  Admin: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Storekeeper: "bg-green-500/10 text-green-600 border-green-500/20",
  Logistic: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Management: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

// Status badge colors
export const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  inactive: "bg-red-500/10 text-red-600 border-red-500/20",
};

// Permission type colors
export const permissionTypeColors: Record<string, string> = {
  View: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Read: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  Create: "bg-green-500/10 text-green-600 border-green-500/20",
  Update: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  Delete: "bg-red-500/10 text-red-600 border-red-500/20",
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(amount);
}

/**
 * Backend day-of-week convention: Monday = 1, Tuesday = 2, ..., Sunday = 7.
 * Use these when comparing or sending dayOfWeek to the API.
 */
export const BACKEND_DAY_OF_WEEK = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
} as const;

/** Convert a Date to backend day-of-week (Monday = 1, ..., Sunday = 7). */
export function getBackendDayOfWeek(date: Date): number {
  const js = date.getDay(); // JS: 0 = Sun, 1 = Mon, ..., 6 = Sat
  return js === 0 ? BACKEND_DAY_OF_WEEK.SUNDAY : js;
}