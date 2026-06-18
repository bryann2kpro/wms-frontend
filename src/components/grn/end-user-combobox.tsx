import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type EndUserComboboxProps = {
	value?: string;
	onChange?: (endUserId: string) => void;
	disabled?: boolean;
	id?: string;
	className?: string;
};

/**
 * Placeholder until m_end_users table + GraphQL API exist.
 * End User = customer's customer (distinct from supplier / ASN entity).
 */
export function EndUserCombobox({
	value: _value,
	onChange: _onChange,
	disabled = true,
	id,
	className,
}: EndUserComboboxProps) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					role="combobox"
					disabled={disabled}
					className={cn(
						"h-9 w-full justify-between gap-1 rounded-lg border-muted-foreground/20 bg-muted/30 font-normal text-sm text-muted-foreground",
						className,
					)}
					id={id}
				>
					<span className="truncate text-left">End User — pending DB schema</span>
					<ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-(--radix-popover-trigger-width) p-3 text-xs text-muted-foreground">
				<p>
					End User master data is not in the database yet. A proposed{" "}
					<code className="rounded bg-muted px-1">m_end_users</code> schema is documented in
					Notion (Task 8). Combobox will activate after migration approval.
				</p>
			</PopoverContent>
		</Popover>
	);
}
