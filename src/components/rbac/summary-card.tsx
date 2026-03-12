import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

// Summary Card Component
interface SummaryCardProps {
	title: string;
	value: number | string;
	icon: React.ComponentType<{ className?: string }>;
	isLoading: boolean;
	description: string;
	/** Optional class for the root Card (e.g. for page-specific styling) */
	className?: string;
}

function SummaryCard({
	title,
	value,
	icon: Icon,
	isLoading,
	description,
	className,
}: SummaryCardProps) {
	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-8 w-16" />
				) : (
					<div className="text-2xl font-bold tabular-nums">{value}</div>
				)}
				<p className="text-xs text-muted-foreground mt-1">{description}</p>
			</CardContent>
		</Card>
	);
}

export { SummaryCard, type SummaryCardProps };
