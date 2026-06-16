import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** Relative time from a nullable date string (e.g. "5m ago", "3h ago", "2d ago"). Returns "Never" for null/empty. */
export function timeAgo(dateStr: string | null): string {
	if (!dateStr) return "Never";
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60_000);
	const hours = Math.floor(diff / 3_600_000);
	const days = Math.floor(diff / 86_400_000);
	if (mins < 1) return "Just now";
	if (mins < 60) return `${mins}m ago`;
	if (hours < 24) return `${hours}h ago`;
	return `${days}d ago`;
}

/** Format a nullable date string as medium date + short time (e.g. "8 Apr 2026, 10:30 am"). Returns "—" for null/empty. */
export function formatDateMedium(dateStr: string | null): string {
	if (!dateStr) return "—";
	return new Intl.DateTimeFormat("en-MY", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(dateStr));
}

// Utility function to format dates
export function formatDate(
	dateValue: string | number | Date | null | undefined,
): string {
	if (dateValue == null || dateValue === "") return "—";
	try {
		let date: Date;
		if (typeof dateValue === "number") {
			date = new Date(dateValue);
		} else if (dateValue instanceof Date) {
			date = dateValue;
		} else if (typeof dateValue === "string" && /^\d+$/.test(dateValue.trim())) {
			date = new Date(Number(dateValue));
		} else {
			date = new Date(dateValue);
		}
		if (isNaN(date.getTime())) {
			return String(dateValue);
		}
		return new Intl.DateTimeFormat("en-MY", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		}).format(date);
	} catch {
		return String(dateValue);
	}
}

/** Format date and time in 12-hour format (e.g. 2/26/2026, 3:19:21 PM). */
export function formatDateTime12h(
	value: string | number | Date | null | undefined,
): string | null {
	if (value == null || value === "") return null;
	try {
		const date =
			typeof value === "number"
				? new Date(value)
				: value instanceof Date
					? value
					: new Date(value);
		if (isNaN(date.getTime())) return null;
		return new Intl.DateTimeFormat("en-US", {
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			second: "2-digit",
			hour12: true,
		}).format(date);
	} catch {
		return null;
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

		return new Intl.DateTimeFormat("en-MY", {
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
	if (
		typeof message === "string" &&
		message.includes("INTERNAL_SERVER_ERROR")
	) {
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

	return toUserFriendlyMessage(
		err.message || "An unexpected error occurred",
		"An unexpected error occurred",
	);
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
		"Failed query",
		"insert into",
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

/** Start of the current week (Monday) at midnight for comparison. */
export function getStartOfWeek(date: Date = new Date()): Date {
	const d = new Date(date);
	const day = d.getDay();
	const diff = d.getDate() - day + (day === 0 ? -6 : 1);
	d.setDate(diff);
	d.setHours(0, 0, 0, 0);
	return d;
}

/** Backend day-of-week: Monday = 1, ..., Sunday = 7. Delivery days are Tuesday (2) and Thursday (4). */
export function isDeliveryDay(date: Date): boolean {
	const dayOfWeek = getBackendDayOfWeek(date);
	return (
		dayOfWeek === BACKEND_DAY_OF_WEEK.TUESDAY ||
		dayOfWeek === BACKEND_DAY_OF_WEEK.THURSDAY
	);
}

/** Whether the date falls in the current week (Monday–Sunday) and is a delivery day. */
export function isInCurrentWeek(date: Date): boolean {
	const now = new Date();
	const startOfCurrentWeek = getStartOfWeek(now);
	const startOfDateWeek = getStartOfWeek(date);
	return (
		startOfCurrentWeek.getTime() === startOfDateWeek.getTime() &&
		isDeliveryDay(date)
	);
}

/** Whether the date falls within the next 7 days (today + 6 days). */
export function isInNext7Days(date: Date): boolean {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const targetDate = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	);

	const endDate = new Date(today);
	endDate.setDate(endDate.getDate() + 7);

	return targetDate >= today && targetDate < endDate;
}

/** Whether the date is before today (past deliveries). */
export function isInPastDays(date: Date): boolean {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const targetDate = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	);

	return targetDate < today;
}

/** Whether the date is in a past week and is a delivery day. */
export function isInPastWeeks(date: Date): boolean {
	const now = new Date();
	const startOfCurrentWeek = getStartOfWeek(now);
	const startOfDateWeek = getStartOfWeek(date);
	return (
		startOfDateWeek.getTime() < startOfCurrentWeek.getTime() &&
		isDeliveryDay(date)
	);
}

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

/** Format a delivery date as "DayName (dd/mm/yyyy)" for table headers. */
export function formatDeliveryDateHeader(date: Date): string {
	const dayName = DAY_NAMES[date.getDay()];
	const dd = String(date.getDate()).padStart(2, "0");
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const yyyy = date.getFullYear();
	return `${dayName} (${dd}/${mm}/${yyyy})`;
}

/**
 * Convert an Excel serial date (Windows epoch) into YYYY-MM-DD.
 * Example: 46387 -> 2026-12-31
 */
export function excelSerialToDateString(serial: number): string {
	if (!Number.isFinite(serial) || serial <= 0) return "";
	// Excel serial date origin (Windows): 1899-12-30
	const epoch = new Date(Date.UTC(1899, 11, 30));
	const days = Math.floor(serial);
	const date = new Date(epoch.getTime() + days * 24 * 60 * 60 * 1000);
	if (Number.isNaN(date.getTime())) return "";
	const yyyy = date.getUTCFullYear();
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(date.getUTCDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

/** Date key in local date (YYYY-MM-DD). Use local, not UTC, so day-of-week stays correct. */
export function getDateKey(date: Date): string {
	const d = new Date(date);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/**
 * Convert backend date key (DD/MM/YYYY UTC) to frontend date key (YYYY-MM-DD)
 * so table headers and sorting stay consistent.
 */
export function dateKeyFromDDMMYYYY(ddMmYyyy: string): string {
	const [dd, mm, yyyy] = ddMmYyyy.split("/");
	if (!dd || !mm || !yyyy) return ddMmYyyy;
	return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/** Format a week range from two date keys (YYYY-MM-DD), e.g. "6 Mar – 12 Mar 2026". */
export function formatWeekRange(fromKey: string, toKey: string): string {
	try {
		const from = new Date(fromKey + "T12:00:00");
		const to = new Date(toKey + "T12:00:00");
		const opts: Intl.DateTimeFormatOptions = {
			day: "numeric",
			month: "short",
			year: "numeric",
		};
		const fromStr = from.toLocaleDateString("en-GB", opts);
		const toStr = to.toLocaleDateString("en-GB", opts);
		return from.getFullYear() === to.getFullYear() &&
			from.getMonth() === to.getMonth()
			? `${from.getDate()} – ${to.getDate()} ${to.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
			: `${fromStr} – ${toStr}`;
	} catch {
		return `${fromKey} – ${toKey}`;
	}
}
