"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toUserFriendlyMessage } from "@/lib/utils";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
	CREATE_OUTLET_MUTATION,
	type CreateOutletMutationData,
} from "@/lib/graphql/outlets";
import {
	REGIONS_QUERY,
	type RegionsQueryData,
	type RegionsQueryVariables,
} from "@/lib/graphql/regions";

function getErrorMessage(err: unknown): string {
	const fallback = "Failed to create outlet. Please try again.";
	if (err && typeof err === "object" && "graphQLErrors" in err) {
		const graphQLErrors = (
			err as { graphQLErrors?: Array<{ message?: string }> }
		).graphQLErrors;
		if (graphQLErrors?.length) {
			const messages = graphQLErrors
				.map((e) => e?.message?.trim())
				.filter(Boolean);
			if (messages.length)
				return toUserFriendlyMessage(messages.join(" "), fallback);
		}
	}
	if (err && typeof err === "object" && "response" in err) {
		const errors = (
			err as { response?: { errors?: Array<{ message?: string }> } }
		).response?.errors;
		if (errors?.length) {
			const messages = errors.map((e) => e?.message?.trim()).filter(Boolean);
			if (messages.length)
				return toUserFriendlyMessage(messages.join(" "), fallback);
		}
	}
	if (err instanceof Error && err.message?.trim())
		return toUserFriendlyMessage(err.message.trim(), fallback);
	return fallback;
}

export type OutletOption = {
	outletId: string;
	outletName: string;
	outletCode: string;
};

export type OutletComboboxProps = {
	value: string;
	onChange: (outletId: string) => void;
	outlets: OutletOption[];
	/** Call to refetch outlets after creating one; then the new outlet can be selected. */
	onOutletCreated?: () => void | Promise<void>;
	placeholder?: string;
	disabled?: boolean;
	id?: string;
	className?: string;
	"aria-invalid"?: boolean;
};

function CreateOutletDialog({
	open,
	onOpenChange,
	onSubmit,
	loading,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (v: {
		outletName: string;
		outletCode: string;
		regionId: string;
	}) => void;
	loading: boolean;
}) {
	const [outletName, setOutletName] = useState("");
	const [outletCode, setOutletCode] = useState("");
	const [regionId, setRegionId] = useState<string>("");

	const { data: regionsData } = useQuery({
		queryKey: [...qk.regions.all, { pageSize: 200, pageNumber: 1 }],
		queryFn: () =>
			gqlRequest<RegionsQueryData, RegionsQueryVariables>(REGIONS_QUERY, {
				pageSize: 200,
				pageNumber: 1,
			}),
		enabled: open,
	});
	const regions = regionsData?.regions?.query ?? [];

	useEffect(() => {
		if (open) {
			setOutletName("");
			setOutletCode("");
			setRegionId("");
		}
	}, [open]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setOutletName("");
			setOutletCode("");
			setRegionId("");
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create outlet</DialogTitle>
					<DialogDescription>
						Add a new outlet. Code, name, and region are required.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="create-outlet-code">Code</Label>
						<Input
							id="create-outlet-code"
							value={outletCode}
							onChange={(e) => setOutletCode(e.target.value)}
							placeholder="e.g. OUT001"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="create-outlet-name">Name</Label>
						<Input
							id="create-outlet-name"
							value={outletName}
							onChange={(e) => setOutletName(e.target.value)}
							placeholder="Outlet name"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="create-outlet-region">Region</Label>
						<Select value={regionId || ""} onValueChange={setRegionId}>
							<SelectTrigger id="create-outlet-region">
								<SelectValue placeholder="Select region" />
							</SelectTrigger>
							<SelectContent>
								{regions.map((r) => (
									<SelectItem key={r.regionId} value={r.regionId}>
										{r.regionName} ({r.regionCode})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={loading}
					>
						Cancel
					</Button>
					<Button
						disabled={
							!outletName.trim() ||
							!outletCode.trim() ||
							!regionId.trim() ||
							loading
						}
						onClick={() =>
							onSubmit({
								outletName: outletName.trim(),
								outletCode: outletCode.trim(),
								regionId: regionId.trim(),
							})
						}
					>
						{loading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
								Creating...
							</>
						) : (
							"Create outlet"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function OutletCombobox({
	value,
	onChange,
	outlets,
	onOutletCreated,
	placeholder = "Search or select outlet...",
	disabled = false,
	id,
	className,
	"aria-invalid": ariaInvalid,
}: OutletComboboxProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const { user } = useCurrentUser();
	const createdBy = user?.id ?? "";

	const { mutate: createOutlet, isPending: createLoading } = useMutation({
		mutationFn: (input: {
			outletName: string;
			outletCode: string;
			regionId: string;
			createdBy: string;
			updatedBy: string;
		}) =>
			gqlRequest<CreateOutletMutationData>(CREATE_OUTLET_MUTATION, { input }),
		onError: (err) => toast.error(getErrorMessage(err)),
		onSuccess: async (data) => {
			const newId = data?.createOutlet?.outletId;
			if (!newId) return;
			await onOutletCreated?.();
			onChange(newId);
			setCreateOpen(false);
			setOpen(false);
			toast.success("Outlet created.");
		},
	});

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return outlets;
		return outlets.filter(
			(o) =>
				o.outletName.toLowerCase().includes(q) ||
				o.outletCode.toLowerCase().includes(q),
		);
	}, [outlets, search]);

	const selectedOutlet = useMemo(
		() => outlets.find((o) => o.outletId === value),
		[outlets, value],
	);
	const displayLabel = selectedOutlet
		? `${selectedOutlet.outletName} (${selectedOutlet.outletCode})`
		: null;

	const handleSelect = (outletId: string) => {
		onChange(outletId);
		setOpen(false);
		setSearch("");
	};

	return (
		<div className={cn("flex gap-1", className)}>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={disabled}
						aria-invalid={ariaInvalid}
						className="h-8 w-full justify-between gap-1 font-normal text-sm"
						id={id}
					>
						<span className="truncate text-left">
							{displayLabel ?? placeholder}
						</span>
						<ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="min-w-[280px] w-[var(--radix-popover-trigger-width)] max-w-[360px] p-0 shadow-md"
					align="start"
				>
					<div className="flex flex-col rounded-md">
						<div className="border-b bg-muted/30 px-2 py-1.5">
							<Input
								placeholder="Search outlet..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="h-7 border-0 bg-background text-sm focus-visible:ring-2"
								autoFocus
							/>
						</div>
						<div className="h-[240px] overflow-y-auto overscroll-contain">
							{filtered.length === 0 ? (
								<div className="py-6 text-center text-xs text-muted-foreground">
									{search.trim()
										? "No outlets match your search."
										: "No outlets in the system."}
								</div>
							) : (
								<ul className="py-1 px-1">
									{filtered.map((o) => (
										<li key={o.outletId}>
											<button
												type="button"
												title={`${o.outletName} (${o.outletCode})`}
												className={cn(
													"flex w-full cursor-pointer items-start gap-1.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-accent",
													value === o.outletId && "bg-accent",
												)}
												onClick={() => handleSelect(o.outletId)}
											>
												{value === o.outletId ? (
													<Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
												) : (
													<span className="mt-0.5 w-3.5 shrink-0" />
												)}
												<div className="min-w-0 flex-1 overflow-hidden">
													<div className="text-sm font-semibold text-foreground">
														{o.outletName}
													</div>
													<div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
														{o.outletCode}
													</div>
												</div>
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
						<div className="border-t bg-muted/20 px-2 py-1">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 w-full justify-start gap-1.5 rounded px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
								onClick={() => setCreateOpen(true)}
							>
								<Plus className="h-3.5 w-3.5 shrink-0" />
								Create new outlet
							</Button>
							<CreateOutletDialog
								open={createOpen}
								onOpenChange={setCreateOpen}
								onSubmit={(values) =>
									createOutlet({
										outletName: values.outletName,
										outletCode: values.outletCode,
										regionId: values.regionId,
										createdBy,
										updatedBy: createdBy,
									})
								}
								loading={createLoading}
							/>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
