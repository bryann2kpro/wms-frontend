import { useEffect, useState } from "react";

/**
 * Returns a value that updates only after the source has been stable for `delayMs`.
 * Useful for search inputs to avoid querying on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const id = window.setTimeout(() => setDebounced(value), delayMs);
		return () => window.clearTimeout(id);
	}, [value, delayMs]);

	return debounced;
}
