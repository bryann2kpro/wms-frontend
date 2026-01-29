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

// Extract error message from various error types
export function getErrorMessage(err: Error | null): string {
  if (!err) return "An unexpected error occurred";

  // Check for Axios error response
  const axiosError = err as { response?: { data?: { message?: string }; status?: number } };
  if (axiosError.response?.data?.message) {
    return axiosError.response.data.message;
  }
  if (axiosError.response?.status === 401) {
    return "Session expired. Please log in again.";
  }
  if (axiosError.response?.status === 403) {
    return "You don't have permission to perform this action.";
  }
  if (axiosError.response?.status === 500) {
    return "Server error. Please try again later.";
  }

  // Network error
  if (err.message === "Network Error") {
    return "Unable to connect to server. Please check your connection.";
  }

  return err.message || "An unexpected error occurred";
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