import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createReservation, updateReservation } from "@/data/reservations";
import { fetchCustomerPriorities } from "@/data/customer-priority";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import type { StockReservation } from "@/lib/graphql/reservations";
import { SKUS_AND_UOM_QUERY, type SkusAndUomQueryData } from "@/lib/graphql/skus";
import { getErrorMessage } from "@/lib/utils";

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

	const { data: skusData } = useQuery({
		queryKey: [...qk.skus.all, "reservation-form"] as const,
		queryFn: () =>
			gqlRequest<SkusAndUomQueryData>(SKUS_AND_UOM_QUERY, {
				pageSize: 500,
				pageNumber: 1,
			}),
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

	const skus = skusData?.skus?.query ?? [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{isEdit ? "Edit reservation" : "Create reservation"}
					</DialogTitle>
				</DialogHeader>

				<div className="grid gap-4 py-2">
					<div className="space-y-2">
						<Label>Customer</Label>
						<Select value={customerCode} onValueChange={setCustomerCode}>
							<SelectTrigger>
								<SelectValue placeholder="Select customer" />
							</SelectTrigger>
							<SelectContent>
								{(customers ?? []).map((c) => (
									<SelectItem key={c.id} value={c.customerCode}>
										{c.customerCode}
										{c.customerName ? ` — ${c.customerName}` : ""}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>SKU</Label>
						<Select
							value={skuId}
							onValueChange={setSkuId}
							disabled={isEdit}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select SKU" />
							</SelectTrigger>
							<SelectContent>
								{skus.map((sku) => (
									<SelectItem key={sku.skuId} value={sku.skuId}>
										{sku.skuCode} — {sku.skuDescription}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="qty-reserved">Quantity to reserve</Label>
						<Input
							id="qty-reserved"
							type="number"
							min="0.01"
							step="0.01"
							value={qtyReserved}
							onChange={(e) => setQtyReserved(e.target.value)}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="reserve-start">Reserve start</Label>
							<Input
								id="reserve-start"
								type="datetime-local"
								value={reserveStart}
								onChange={(e) => setReserveStart(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="reserve-end">Reserve end</Label>
							<Input
								id="reserve-end"
								type="datetime-local"
								value={reserveEnd}
								onChange={(e) => setReserveEnd(e.target.value)}
							/>
						</div>
					</div>

					<div className="flex items-center justify-between rounded-md border px-3 py-2">
						<Label htmlFor="priority-flag">Batch priority flag</Label>
						<Switch
							id="priority-flag"
							checked={priorityFlag}
							onCheckedChange={setPriorityFlag}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="notes">Notes</Label>
						<Textarea
							id="notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={2}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={() => saveMutation.mutate()}
						disabled={saveMutation.isPending}
					>
						{isEdit ? "Save changes" : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
