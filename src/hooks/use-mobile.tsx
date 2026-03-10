export const useIsMobile = () => {
	if (typeof window === "undefined") return false;

	return window.innerWidth < 768;
};
