import { useMutation, useQuery } from "@tanstack/react-query";
import { Bookmark, CalendarRange, Package, User } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createReservation, updateReservation } from "@/data/reservations";
import { fetchCustomerPriorities } from "@/data/customer-priority";
import { qk } from "@/lib/api/query-keys";
import type { StockReservation } from "@/lib/graphql/reservations";
import { cn, getErrorMessage } from "@/lib/utils";
import { ReservationCustomerCombobox } from "./reservation-customer-combobox";
import { ReservationSkuCombobox } from "./reservation-sku-combobox";

type ReservationFormDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	reservation?: StockReservation | null;
	onSuccess: () => void;
};

function toLocalDatetimeInput(iso: string): string {
	const d = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string {
	return new Date(value).toISOString();
}

function ColumnHeader({
	icon: Icon,
	title,
	className,
}: {
	icon: typeof User;
	title: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"mb-2 flex items-center gap-2 border-b border-amber-500/15 pb-2",
				className,
			)}
		>
			<span className="flex h-6 w-6 items-center justify-center rounded bg-amber-500/10 text-amber-700">
				<Icon className="h-3 w-3" aria-hidden />
			</span>
			<h3
				className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
				style={{ fontFamily: "var(--dashboard-body)" }}
			>
				{title}
			</h3>
		</div>
	);
}

function Field({
	id,
	label,
	children,
	hint,
	className,
}: {
	id?: string;
	label: string;
	children: ReactNode;
	hint?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("space-y-1", className)}>
			<Label
				htmlFor={id}
				className="text-[11px] font-medium text-foreground/75"
				style={{ fontFamily: "var(--dashboard-body)" }}
			>
				{label}
			</Label>
			{children}
			{hint}
		</div>
	);
}

export function ReservationFormDialog({
	open,
	onOpenChange,
	reservation,
	onSuccess,
}: ReservationFormDialogProps) {
	const isEdit = Boolean(reservation);

	const [customerCode, setCustomerCode] = useState("");
	const [skuId, setSkuId] = useState("");
	const [qtyReserved, setQtyReserved] = useState("");
	const [reserveStart, setReserveStart] = useState("");
	const [reserveEnd, setReserveEnd] = useState("");
	const [priorityFlag, setPriorityFlag] = useState(false);
	const [notes, setNotes] = useState("");

	const { data: customers } = useQuery({
		queryKey: qk.customerPriorities.all,
		queryFn: fetchCustomerPriorities,
		enabled: open,
	});

	useEffect(() => {
		if (!open) return;
		if (reservation) {
			setCustomerCode(reservation.customerCode);
			setSkuId(reservation.skuId);
			setQtyReserved(reservation.qtyReserved);
			setReserveStart(toLocalDatetimeInput(reservation.reserveStart));
			setReserveEnd(toLocalDatetimeInput(reservation.reserveEnd));
			setPriorityFlag(reservation.priorityFlag);
			setNotes(reservation.notes ?? "");
		} else {
			const now = new Date();
			const end = new Date(now);
			end.setDate(end.getDate() + 7);
			setCustomerCode(customers?.[0]?.customerCode ?? "");
			setSkuId("");
			setQtyReserved("");
			setReserveStart(toLocalDatetimeInput(now.toISOString()));
			setReserveEnd(toLocalDatetimeInput(end.toISOString()));
			setPriorityFlag(false);
			setNotes("");
		}
	}, [open, reservation, customers]);

	const saveMutation = useMutation({
		mutationFn: async () => {
			const qty = Number.parseFloat(qtyReserved);
			if (!customerCode || !skuId || !Number.isFinite(qty) || qty <= 0) {
				throw new Error("Customer, SKU, and a positive quantity are required.");
			}
			if (!reserveStart || !reserveEnd) {
				throw new Error("Reserve window start and end are required.");
			}

			if (isEdit && reservation) {
				return updateReservation(reservation.id, {
					customerCode,
					qtyReserved: qty,
					reserveStart: localInputToIso(reserveStart),
					reserveEnd: localInputToIso(reserveEnd),
					priorityFlag,
					notes: notes.trim() || null,
				});
			}

			return createReservation({
				customerCode,
				skuId,
				qtyReserved: qty,
				reserveStart: localInputToIso(reserveStart),
				reserveEnd: localInputToIso(reserveEnd),
				priorityFlag,
				notes: notes.trim() || null,
				sourceType: "MANUAL",
			});
		},
		onSuccess: () => {
			toast.success(isEdit ? "Reservation updated" : "Reservation created");
			onSuccess();
			onOpenChange(false);
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="!flex w-[min(94vw,40rem)] !max-w-[min(94vw,40rem)] max-h-[min(90vh,640px)] flex-col gap-0 overflow-hidden rounded-xl border border-border/80 p-0 shadow-2xl sm:!max-w-[min(94vw,40rem)]">
				<div
					className="h-1 shrink-0 bg-linear-to-r from-amber-600 via-amber-500 to-amber-400/60"
					aria-hidden
				/>

				<DialogHeader className="shrink-0 space-y-0.5 border-b border-border/60 bg-muted/20 px-5 py-3.5 sm:px-6">
					<div className="flex items-center gap-2.5 pr-8">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-700">
							<Bookmark className="h-3.5 w-3.5" aria-hidden />
						</span>
						<div className="min-w-0">
							<DialogTitle
								className="text-base font-semibold leading-snug"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								{isEdit ? "Edit reservation" : "Create reservation"}
							</DialogTitle>
							<DialogDescription
								className="line-clamp-1 text-xs text-muted-foreground"
								style={{ fontFamily: "var(--dashboard-body)" }}
							>
								{isEdit
									? "Update quantity, window, or priority."
									: "Hold stock for a priority customer within a date range."}
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
					<div className="flex flex-col gap-4">
						<div className="space-y-3">
							<ColumnHeader icon={User} title="Allocation" />
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<Field id="reservation-customer" label="Customer">
									<ReservationCustomerCombobox
										id="reservation-customer"
										value={customerCode}
										onChange={setCustomerCode}
										customers={customers}
										enabled={open}
									/>
								</Field>
								<Field
									id="reservation-sku"
									label="SKU"
									hint={
										isEdit ? (
											<p className="text-[10px] text-muted-foreground">
												SKU is locked after creation.
											</p>
										) : undefined
									}
								>
									<ReservationSkuCombobox
										id="reservation-sku"
										value={skuId}
										onChange={setSkuId}
										disabled={isEdit}
										enabled={open}
									/>
								</Field>
							</div>
							<Field id="qty-reserved" label="Quantity" className="max-w-44">
								<div className="relative">
									<Package
										className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
										aria-hidden
									/>
									<Input
										id="qty-reserved"
										type="number"
										min="0.01"
										step="0.01"
										value={qtyReserved}
										onChange={(e) => setQtyReserved(e.target.value)}
										className="h-9 rounded-md border-muted-foreground/20 pl-8 font-mono text-sm tabular-nums"
									/>
								</div>
							</Field>
						</div>

						<div className="space-y-3 border-t border-border/40 pt-4">
							<ColumnHeader icon={CalendarRange} title="Reserve window" />
							<div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
								<Field id="reserve-start" label="Start">
									<Input
										id="reserve-start"
										type="datetime-local"
										value={reserveStart}
										onChange={(e) => setReserveStart(e.target.value)}
										className="h-9 w-full min-w-0 rounded-md border-muted-foreground/20 text-sm"
									/>
								</Field>
								<Field id="reserve-end" label="End">
									<Input
										id="reserve-end"
										type="datetime-local"
										value={reserveEnd}
										onChange={(e) => setReserveEnd(e.target.value)}
										className="h-9 w-full min-w-0 rounded-md border-muted-foreground/20 text-sm"
									/>
								</Field>
							</div>
						</div>

						<div className="space-y-3 border-t border-border/40 pt-4">
							<div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
								<div className="min-w-0">
									<Label
										htmlFor="priority-flag"
										className="text-xs font-medium"
										style={{ fontFamily: "var(--dashboard-body)" }}
									>
										Batch priority
									</Label>
									<p className="text-[10px] leading-snug text-muted-foreground">
										Elevates pick allocation order.
									</p>
								</div>
								<Switch
									id="priority-flag"
									checked={priorityFlag}
									onCheckedChange={setPriorityFlag}
								/>
							</div>

							<Field id="notes" label="Notes">
								<Textarea
									id="notes"
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									rows={2}
									placeholder="Optional context for warehouse staff…"
									className="min-h-18 resize-none rounded-md border-muted-foreground/20 text-sm"
								/>
							</Field>
						</div>
					</div>
				</div>

				<DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-muted/25 px-5 py-3 sm:px-6 sm:justify-end">
					<Button
						variant="outline"
						size="sm"
						className="rounded-md"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						size="sm"
						className="rounded-md bg-amber-600 text-white hover:bg-amber-700"
						onClick={() => saveMutation.mutate()}
						disabled={saveMutation.isPending}
					>
						{saveMutation.isPending
							? isEdit
								? "Saving…"
								: "Creating…"
							: isEdit
								? "Save changes"
								: "Create reservation"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
