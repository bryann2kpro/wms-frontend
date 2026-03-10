import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import type { Pagination as PaginationType } from "@/lib/pagination/pagination";

// Pagination Component
interface PaginationProps {
	pagination: PaginationType | undefined;
	page: number;
	onPageChange: (page: number) => void;
	itemName: string;
}

function Pagination({
	pagination,
	page,
	onPageChange,
	itemName,
}: PaginationProps) {
	if (!pagination || pagination.totalCount === 0) return null;

	const { totalCount, totalPages, hasNextPage, hasPrevPage } = pagination;

	return (
		<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
			<div>
				Showing page <span className="font-medium">{page}</span> of{" "}
				<span className="font-medium">{totalPages}</span> ({totalCount}{" "}
				{itemName}
				{totalCount !== 1 ? "s" : ""})
			</div>
			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="icon"
					disabled={!hasPrevPage}
					onClick={() => onPageChange(page - 1)}
					aria-label="Previous page"
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<span>
					Page {page} of {totalPages}
				</span>
				<Button
					variant="outline"
					size="icon"
					disabled={!hasNextPage}
					onClick={() => onPageChange(page + 1)}
					aria-label="Next page"
				>
					<ChevronRight className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

export { Pagination, type PaginationProps };
