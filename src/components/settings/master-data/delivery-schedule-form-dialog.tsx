import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Region } from "@/lib/graphql/types";
import { DAYS_OF_WEEK } from "./shared";

export interface DeliveryScheduleFormValues {
	regionId?: string;
	dayOfWeek: number;
	cutoffDaysBefore: number;
	cutoffTime: string;
	isActive?: boolean;
}

export function DeliveryScheduleFormDialog({
	open,
	onOpenChange,
	regions,
	initial,
	onSubmit,
	loading,
	title,
	description,
	hideRegion = false,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	regions: Region[];
	initial?: DeliveryScheduleFormValues;
	onSubmit: (v: DeliveryScheduleFormValues) => void;
	loading: boolean;
	title: string;
	description: string;
	hideRegion?: boolean;
}) {
	const [regionId, setRegionId] = useState(initial?.regionId ?? "");
	const [dayOfWeek, setDayOfWeek] = useState(initial?.dayOfWeek ?? 1);
	const [cutoffDaysBefore, setCutoffDaysBefore] = useState(
		initial?.cutoffDaysBefore ?? 1,
	);
	const [cutoffTime, setCutoffTime] = useState(initial?.cutoffTime ?? "17:00");
	const [isActive, setIsActive] = useState(initial?.isActive ?? true);

	useEffect(() => {
		if (open) {
			setRegionId(initial?.regionId ?? "");
			setDayOfWeek(initial?.dayOfWeek ?? 1);
			setCutoffDaysBefore(initial?.cutoffDaysBefore ?? 1);
			setCutoffTime(initial?.cutoffTime ?? "17:00");
			setIsActive(initial?.isActive ?? true);
		}
	}, [
		open,
		initial?.regionId,
		initial?.dayOfWeek,
		initial?.cutoffDaysBefore,
		initial?.cutoffTime,
		initial?.isActive,
	]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setRegionId(initial?.regionId ?? "");
			setDayOfWeek(initial?.dayOfWeek ?? 1);
			setCutoffDaysBefore(initial?.cutoffDaysBefore ?? 1);
			setCutoffTime(initial?.cutoffTime ?? "17:00");
			setIsActive(initial?.isActive ?? true);
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="rounded-2xl border-2 border-border bg-background shadow-xl">
				<DialogHeader className="border-b bg-muted/50">
					<DialogTitle
						className="text-xl"
						style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
					>
						{title}
					</DialogTitle>
					<DialogDescription style={{ fontFamily: '"Figtree", sans-serif' }}>
						{description}
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					{!hideRegion && (
						<div className="grid gap-2">
							<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
								Region
							</Label>
							<Select
								value={regionId || undefined}
								onValueChange={setRegionId}
								required
							>
								<SelectTrigger className="rounded-lg border-muted-foreground/20">
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
					)}
					<div className="grid gap-2">
						<Label style={{ fontFamily: '"Figtree", sans-serif' }}>
							Day of week
						</Label>
						<Select
							value={String(dayOfWeek)}
							onValueChange={(v) => setDayOfWeek(Number(v))}
						>
							<SelectTrigger className="rounded-lg border-muted-foreground/20">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DAYS_OF_WEEK.map((d) => (
									<SelectItem key={d.value} value={String(d.value)}>
										{d.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-2">
						<Label
							htmlFor="cutoff-days"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Cutoff (days before)
						</Label>
						<Input
							id="cutoff-days"
							type="number"
							min={0}
							value={cutoffDaysBefore}
							onChange={(e) => setCutoffDaysBefore(Number(e.target.value) || 0)}
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="grid gap-2">
						<Label
							htmlFor="cutoff-time"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Cutoff time
						</Label>
						<Input
							id="cutoff-time"
							value={cutoffTime}
							onChange={(e) => setCutoffTime(e.target.value)}
							placeholder="e.g. 17:00"
							className="rounded-lg border-muted-foreground/20"
						/>
					</div>
					<div className="flex items-center justify-between">
						<Label
							htmlFor="schedule-active"
							style={{ fontFamily: '"Figtree", sans-serif' }}
						>
							Active
						</Label>
						<Switch
							id="schedule-active"
							checked={isActive}
							onCheckedChange={setIsActive}
						/>
					</div>
				</div>
				<DialogFooter className="border-t bg-muted/20">
					<Button
						variant="outline"
						onClick={() => handleOpenChange(false)}
						className="rounded-lg"
					>
						Cancel
					</Button>
					<Button
						disabled={
							(!hideRegion && !regionId) || cutoffTime.trim() === "" || loading
						}
						onClick={() =>
							onSubmit({
								...(hideRegion ? {} : { regionId }),
								dayOfWeek,
								cutoffDaysBefore,
								cutoffTime: cutoffTime.trim(),
								isActive,
							})
						}
						className="rounded-lg bg-amber-600 text-white hover:bg-amber-700"
					>
						{loading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
