import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Route as RouteIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ConfirmDeleteDialog } from "@/components/settings/master-data/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	CREATE_TMS_ROUTE_MUTATION,
	DELETE_TMS_ROUTE_MUTATION,
	TMS_ROUTES_QUERY,
	UPDATE_TMS_ROUTE_MUTATION,
	type CreateTmsRouteData,
	type CreateTmsRouteVariables,
	type DeleteTmsRouteData,
	type DeleteTmsRouteVariables,
	type TmsRoutesQueryData,
	type UpdateTmsRouteData,
	type UpdateTmsRouteVariables,
} from "@/lib/graphql/routes";
import type { TmsRoute } from "@/lib/graphql/types";
import { toUserFriendlyMessage } from "@/lib/utils";

export const Route = createFileRoute("/admin/tms/routing")({
	component: TmsRoutingPage,
	head: () => ({
		meta: [
			{
				title: "Routing - SME Edaran WMS",
				description: "Defined delivery routes.",
			},
		],
	}),
});

type FormState = {
	name: string;
	origin: string;
	destination: string;
	distanceKm: string;
	estimatedDurationMins: string;
	status: string;
};

const EMPTY_FORM: FormState = {
	name: "",
	origin: "",
	destination: "",
	distanceKm: "",
	estimatedDurationMins: "",
	status: "ACTIVE",
};

function getErrorMessage(err: unknown): string {
	if (err && typeof err === "object" && "graphQLErrors" in err) {
		const first = (err as { graphQLErrors?: Array<{ message?: string }> })
			.graphQLErrors?.[0];
		if (first?.message) {
			return toUserFriendlyMessage(
				first.message,
				"Something went wrong. Please try again.",
			);
		}
	}
	if (err instanceof Error) {
		return toUserFriendlyMessage(
			err.message,
			"Something went wrong. Please try again.",
		);
	}
	return "Something went wrong. Please try again.";
}

function TmsRoutingPage() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<TmsRoute | null>(null);
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [toDelete, setToDelete] = useState<TmsRoute | null>(null);

	const { data, isLoading, isFetching } = useQuery({
		queryKey: qk.tmsRoutes.all,
		queryFn: () => gqlRequest<TmsRoutesQueryData>(TMS_ROUTES_QUERY),
	});

	const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.tmsRoutes.all });

	const createMutation = useMutation({
		mutationFn: (vars: CreateTmsRouteVariables) =>
			gqlRequest<CreateTmsRouteData, CreateTmsRouteVariables>(CREATE_TMS_ROUTE_MUTATION, vars),
		onSuccess: () => {
			toast.success("Route created");
			setDialogOpen(false);
			invalidate();
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const updateMutation = useMutation({
		mutationFn: (vars: UpdateTmsRouteVariables) =>
			gqlRequest<UpdateTmsRouteData, UpdateTmsRouteVariables>(UPDATE_TMS_ROUTE_MUTATION, vars),
		onSuccess: () => {
			toast.success("Route updated");
			setDialogOpen(false);
			invalidate();
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const deleteMutation = useMutation({
		mutationFn: (vars: DeleteTmsRouteVariables) =>
			gqlRequest<DeleteTmsRouteData, DeleteTmsRouteVariables>(DELETE_TMS_ROUTE_MUTATION, vars),
		onSuccess: () => {
			toast.success("Route deleted");
			setToDelete(null);
			invalidate();
		},
		onError: (err) => toast.error(getErrorMessage(err)),
	});

	const routes = data?.tmsRoutes ?? [];
	const loading = isLoading || isFetching;

	function openCreate() {
		setEditing(null);
		setForm(EMPTY_FORM);
		setDialogOpen(true);
	}

	function openEdit(r: TmsRoute) {
		setEditing(r);
		setForm({
			name: r.name,
			origin: r.origin,
			destination: r.destination,
			distanceKm: r.distanceKm,
			estimatedDurationMins: r.estimatedDurationMins,
			status: r.status,
		});
		setDialogOpen(true);
	}

	function submit(e: React.FormEvent) {
		e.preventDefault();
		const input = {
			name: form.name,
			origin: form.origin,
			destination: form.destination,
			distanceKm: form.distanceKm,
			estimatedDurationMins: form.estimatedDurationMins,
			status: form.status,
		};
		if (editing) {
			updateMutation.mutate({ id: editing.id, input });
		} else {
			createMutation.mutate({ input });
		}
	}

	const saving = createMutation.isPending || updateMutation.isPending;

	return (
		<main
			className="container mx-auto p-6 space-y-6"
			aria-labelledby="tms-routing-title"
			aria-describedby="tms-routing-description"
			aria-busy={loading}
		>
			<GlobalLoadingShadow />
			<AdminPageHeader
				icon={RouteIcon}
				title="Routing"
				description="Defined delivery routes."
				titleId="tms-routing-title"
				descriptionId="tms-routing-description"
			/>

			<Card className="rounded-2xl border-2 border-border">
				<CardHeader className="flex flex-row items-center justify-between gap-4">
					<div>
						<CardTitle>Routes</CardTitle>
						<CardDescription>
							{routes.length} route{routes.length === 1 ? "" : "s"}
						</CardDescription>
					</div>
					<Button size="sm" onClick={openCreate}>
						<Plus className="mr-1.5 h-4 w-4" />
						Add route
					</Button>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto rounded-xl border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Origin</TableHead>
									<TableHead>Destination</TableHead>
									<TableHead>Distance (km)</TableHead>
									<TableHead>Duration (min)</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="w-24 text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{routes.length === 0 && !loading ? (
									<TableRow>
										<TableCell colSpan={7} className="text-center text-muted-foreground py-8">
											No routes yet. Define your first route to get started.
										</TableCell>
									</TableRow>
								) : (
									routes.map((r) => (
										<TableRow key={r.id}>
											<TableCell className="font-medium">{r.name}</TableCell>
											<TableCell>{r.origin}</TableCell>
											<TableCell>{r.destination}</TableCell>
											<TableCell>{r.distanceKm}</TableCell>
											<TableCell>{r.estimatedDurationMins}</TableCell>
											<TableCell>
												<Badge variant={r.status === "ACTIVE" ? "default" : "secondary"}>
													{r.status}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
													<Pencil className="h-4 w-4" />
												</Button>
												<Button size="icon" variant="ghost" onClick={() => setToDelete(r)}>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{editing ? "Edit route" : "Add route"}</DialogTitle>
					</DialogHeader>
					<form onSubmit={submit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								required
								value={form.name}
								onChange={(e) => setForm({ ...form, name: e.target.value })}
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label htmlFor="origin">Origin</Label>
								<Input
									id="origin"
									required
									value={form.origin}
									onChange={(e) => setForm({ ...form, origin: e.target.value })}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="dest">Destination</Label>
								<Input
									id="dest"
									required
									value={form.destination}
									onChange={(e) => setForm({ ...form, destination: e.target.value })}
								/>
							</div>
						</div>
						<div className="grid grid-cols-3 gap-3">
							<div className="space-y-2">
								<Label htmlFor="dist">Distance (km)</Label>
								<Input
									id="dist"
									type="number"
									min="0"
									step="0.01"
									required
									value={form.distanceKm}
									onChange={(e) => setForm({ ...form, distanceKm: e.target.value })}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="dur">Duration (min)</Label>
								<Input
									id="dur"
									type="number"
									min="0"
									required
									value={form.estimatedDurationMins}
									onChange={(e) => setForm({ ...form, estimatedDurationMins: e.target.value })}
								/>
							</div>
							<div className="space-y-2">
								<Label>Status</Label>
								<Select
									value={form.status}
									onValueChange={(v) => setForm({ ...form, status: v })}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ACTIVE">Active</SelectItem>
										<SelectItem value="INACTIVE">Inactive</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={saving}>
								{saving ? "Saving…" : "Save"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<ConfirmDeleteDialog
				open={!!toDelete}
				onOpenChange={(o) => !o && setToDelete(null)}
				loading={deleteMutation.isPending}
				itemName={toDelete?.name ?? "route"}
				onConfirm={() => toDelete && deleteMutation.mutate({ id: toDelete.id })}
			/>
		</main>
	);
}
