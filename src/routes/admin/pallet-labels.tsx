import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import { requirePermission } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { AdminPageHeader } from "@/components/admin-page-header";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  PALLET_LABELS_QUERY,
  CREATE_PALLET_LABEL_MUTATION,
  UPDATE_PALLET_LABEL_MUTATION,
  DELETE_PALLET_LABEL_MUTATION,
  DELETE_PALLET_LABELS_MUTATION,
  type PalletLabelsQueryData,
  type PalletLabelsQueryVariables,
  type CreatePalletLabelMutationData,
  type UpdatePalletLabelMutationData,
  type DeletePalletLabelMutationData,
  type DeletePalletLabelsMutationData,
} from "@/lib/graphql/pallet-labels";
import { RACKS_QUERY, type RacksQueryData } from "@/lib/graphql/racks";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { PalletLabelImportDialog } from "@/components/settings/master-data/pallet-label-import-dialog";
import { Plus, Edit, Trash2, Search, Database, ArrowUpDown, Upload } from "lucide-react";
import { toast } from "sonner";
import type { PalletLabel, Rack } from "@/lib/graphql/types";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export const Route = createFileRoute("/admin/pallet-labels")({
  beforeLoad: async ({ context }) => {
    await requirePermission(context.queryClient, ["Inventory"]);
  },
  component: StorageBinItemsPage,
  head: () => ({ meta: [{ title: "Pallet Labels - SME Edaran WMS" }] }),
});

function StorageBinItemsPage() {
  const { user } = useCurrentUser();
  const createdBy = user?.id ?? "";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [sortField, setSortField] = useState<string>("UPDATED_AT");
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editing, setEditing] = useState<PalletLabel | null>(null);
  const [deleting, setDeleting] = useState<PalletLabel | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const queryVars: PalletLabelsQueryVariables = {
    pageSize: PAGE_SIZE,
    pageNumber: page,
    sort: { sortBy: sortField, direction: sortDirection },
    filter: debouncedSearch.trim()
      ? { search: debouncedSearch.trim() }
      : undefined,
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: [...qk.palletLabels.all, queryVars],
    queryFn: () => gqlRequest<PalletLabelsQueryData, PalletLabelsQueryVariables>(PALLET_LABELS_QUERY, queryVars),
  });

  const { data: racksData } = useQuery({
    queryKey: [...qk.racks.all, "storage-bin-items-page"],
    queryFn: () => gqlRequest<RacksQueryData>(RACKS_QUERY, { pageSize: 500, pageNumber: 1 }),
  });

  const list = data?.palletLabels?.query ?? [];
  const pagination = data?.palletLabels?.pagination;
  const racks = racksData?.racks?.query ?? [];

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => list.some((x) => x.id === id)));
  }, [list]);

  const allVisibleSelected = list.length > 0 && list.every((r) => selectedIds.includes(r.id));

  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      const merged = new Set([...selectedIds, ...list.map((x) => x.id)]);
      setSelectedIds(Array.from(merged));
    } else {
      setSelectedIds((prev) => prev.filter((id) => !list.some((x) => x.id === id)));
    }
  };

  const { mutate: createItem, isPending: createLoading } = useMutation({
    mutationFn: (input: object) => gqlRequest<CreatePalletLabelMutationData>(CREATE_PALLET_LABEL_MUTATION, { input }),
    onSuccess: () => {
      void refetch();
      setIsCreateOpen(false);
      toast.success("Storage bin item created.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to create record."),
  });

  const { mutate: updateItem, isPending: updateLoading } = useMutation({
    mutationFn: (variables: { id: string; input: object }) => gqlRequest<UpdatePalletLabelMutationData>(UPDATE_PALLET_LABEL_MUTATION, variables),
    onSuccess: () => {
      void refetch();
      setEditing(null);
      toast.success("Storage bin item updated.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to update record."),
  });

  const { mutate: deleteItem, isPending: deleteLoading } = useMutation({
    mutationFn: (variables: { id: string; updatedBy: string }) => gqlRequest<DeletePalletLabelMutationData>(DELETE_PALLET_LABEL_MUTATION, variables),
    onSuccess: () => {
      void refetch();
      setDeleting(null);
      toast.success("Storage bin item deleted.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to delete record."),
  });

  const { mutate: bulkDelete, isPending: bulkDeleteLoading } = useMutation({
    mutationFn: (variables: { ids: string[]; updatedBy: string }) => gqlRequest<DeletePalletLabelsMutationData>(DELETE_PALLET_LABELS_MUTATION, variables),
    onSuccess: (res) => {
      void refetch();
      setSelectedIds([]);
      toast.success(`Deleted ${res.deletePalletLabels.deletedCount}/${res.deletePalletLabels.requestedCount} records.`);
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to delete records."),
  });

  return (
    <div className="space-y-6 p-6">
      <AdminPageHeader
        icon={Database}
        title="Pallet Labels"
        description="Manage item placement by pallet labels"
        titleId="storage-bin-items-title"
        descriptionId="storage-bin-items-description"
      />

      <Card className="dashboard-card">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl" style={{ fontFamily: "var(--dashboard-display)" }}>
                Pallet Label Management
              </CardTitle>
              <CardDescription style={{ fontFamily: "var(--dashboard-body)" }}>
                Tracks movement of pallet labels
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search item code or description..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border-muted-foreground/20 pl-9 sm:w-64"
                />
              </div>
              <div className="flex items-center gap-1">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={sortField}
                  onValueChange={(v) => {
                    setSortField(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-36 rounded-lg text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STORAGE_BIN">Storage Bin</SelectItem>
                    <SelectItem value="ITEM_CODE">Item Code</SelectItem>
                    <SelectItem value="DESCRIPTION">Description</SelectItem>
                    <SelectItem value="ITEM_DESC_02">Item Desc 02</SelectItem>
                    <SelectItem value="UPDATED_AT">Last Updated</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={sortDirection}
                  onValueChange={(v) => {
                    setSortDirection(v as "ASC" | "DESC");
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-20 rounded-lg text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASC">ASC</SelectItem>
                    <SelectItem value="DESC">DESC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="destructive"
                disabled={!createdBy || selectedIds.length === 0 || bulkDeleteLoading}
                onClick={() => bulkDelete({ ids: selectedIds, updatedBy: createdBy })}
                className="rounded-lg"
              >
                Delete Selected ({selectedIds.length})
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsImportOpen(true)}
                disabled={!createdBy}
                className="rounded-lg"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import Excel
              </Button>
              <Button
                onClick={() => setIsCreateOpen(true)}
                disabled={!createdBy}
                className="rounded-lg bg-[var(--dashboard-accent)] text-white hover:opacity-90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Record
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative px-0 pb-6">
          <GlobalLoadingShadow />
          <div className="mx-6 overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 px-4">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={(v) => toggleSelectAllVisible(Boolean(v))} />
                  </TableHead>
                  <TableHead className="px-4 text-xs font-medium">Storage Bin</TableHead>
                  <TableHead className="px-4 text-xs font-medium">Item Code</TableHead>
                  <TableHead className="px-4 text-xs font-medium">Description</TableHead>
                  <TableHead className="px-4 text-xs font-medium">Item Desc 02</TableHead>
                  <TableHead className="px-4 text-right text-xs font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No records found.</TableCell>
                  </TableRow>
                ) : (
                  list.map((row) => (
                    <TableRow key={row.id} className="transition-colors hover:bg-muted/50">
                      <TableCell className="px-4">
                        <Checkbox
                          checked={selectedIds.includes(row.id)}
                          onCheckedChange={(v) => {
                            if (v) setSelectedIds((prev) => [...prev, row.id]);
                            else setSelectedIds((prev) => prev.filter((id) => id !== row.id));
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-4 font-mono text-sm">{row.storageBinCode ?? "—"}</TableCell>
                      <TableCell className="px-4 font-mono text-sm">{row.itemCode}</TableCell>
                      <TableCell className="px-4 text-sm">{row.description ?? "—"}</TableCell>
                      <TableCell className="px-4 text-sm">{row.itemDesc02 ?? "—"}</TableCell>
                      <TableCell className="px-4 text-right">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(row)} className="rounded-lg">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg text-destructive"
                          onClick={() => setDeleting(row)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {pagination && (pagination.totalPages ?? 1) > 1 && (
            <div className="mx-6 mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--dashboard-body)" }}>
                Page <span className="font-semibold tabular-nums text-foreground">{pagination.currentPage}</span> of {pagination.totalPages} ({pagination.totalCount} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="rounded-lg"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <PalletLabelImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        createdBy={createdBy}
        onImported={() => void refetch()}
      />

      <StorageBinItemFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        racks={racks}
        onSubmit={(values) =>
          createItem({
            ...values,
            createdBy,
            updatedBy: createdBy,
            labelCode: values.itemCode,
          })
        }
        loading={createLoading}
        title="Add Storage Bin Item"
        description="Create a new mapping between storage bin and item code."
      />

      {editing && (
        <StorageBinItemFormDialog
          key={editing.id}
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
          racks={racks}
          initial={editing}
          onSubmit={(values) =>
            updateItem({
              id: editing.id,
              input: {
                ...values,
                labelCode: values.itemCode,
                version: editing.version,
                updatedBy: createdBy,
              },
            })
          }
          loading={updateLoading}
          title="Edit Storage Bin Item"
          description="Update storage bin item details."
        />
      )}

      {deleting && (
        <ConfirmDeleteDialog
          open={!!deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
          itemName={`${deleting.itemCode} @ ${deleting.storageBinCode ?? "No Bin"}`}
          onConfirm={() => deleteItem({ id: deleting.id, updatedBy: createdBy })}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}

type FormValues = {
  itemCode: string;
  storageBinId: string | null;
  description: string;
  itemDesc02: string;
};

function StorageBinItemFormDialog({
  open,
  onOpenChange,
  initial,
  racks,
  onSubmit,
  loading,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PalletLabel;
  racks: Rack[];
  onSubmit: (v: FormValues) => void;
  loading: boolean;
  title: string;
  description: string;
}) {
  const [itemCode, setItemCode] = useState(initial?.itemCode ?? "");
  const [storageBinId, setStorageBinId] = useState<string | null>(initial?.storageBinId ?? null);
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [itemDesc02, setItemDesc02] = useState(initial?.itemDesc02 ?? "");

  useEffect(() => {
    if (open) {
      setItemCode(initial?.itemCode ?? "");
      setStorageBinId(initial?.storageBinId ?? null);
      setDesc(initial?.description ?? "");
      setItemDesc02(initial?.itemDesc02 ?? "");
    }
  }, [open, initial?.id]);

  const handleSubmit = () => {
    if (!itemCode.trim() || !desc.trim()) {
      toast.error("Item code and description are required.");
      return;
    }

    const binRegex = /^[A-Za-z0-9-]+$/;
    const itemCodeRegex = /^[A-Za-z0-9._-]+$/;
    const rack = racks.find((r) => r.rackId === storageBinId);
    const storageBinCode = rack?.binCode ?? "";

    if (storageBinCode && !binRegex.test(storageBinCode)) {
      toast.error("Storage bin format is invalid.");
      return;
    }

    if (!itemCodeRegex.test(itemCode.trim())) {
      toast.error("Item code format is invalid.");
      return;
    }

    onSubmit({
      itemCode: itemCode.trim(),
      storageBinId,
      description: desc.trim(),
      itemDesc02: itemDesc02.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-2 border-border bg-background shadow-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="itemCode">Item Code <span className="text-destructive">*</span></Label>
            <Input id="itemCode" value={itemCode} onChange={(e) => setItemCode(e.target.value)} placeholder="e.g. 80694404" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="storageBinId">Storage Bin</Label>
            <select
              id="storageBinId"
              value={storageBinId ?? ""}
              onChange={(e) => setStorageBinId(e.target.value || null)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">-- Select Bin --</option>
              {racks.map((rack) => (
                <option key={rack.rackId} value={rack.rackId}>
                  {rack.binCode ?? `${rack.rackRow}-${rack.rackColumn}-${rack.rackLevel}`}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
            <Input id="description" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Item description" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="itemDesc02">Item Desc 02</Label>
            <Input id="itemDesc02" value={itemDesc02} onChange={(e) => setItemDesc02(e.target.value)} placeholder="Secondary description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={loading} onClick={handleSubmit} className="bg-[var(--dashboard-accent)] text-white hover:opacity-90">
            {loading ? "Saving..." : initial ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDeleteDialog({
  open,
  onOpenChange,
  itemName,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-2 border-border bg-background shadow-xl">
        <DialogHeader>
          <DialogTitle>Delete Storage Bin Item</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{itemName}"?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={loading} onClick={onConfirm}>
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}