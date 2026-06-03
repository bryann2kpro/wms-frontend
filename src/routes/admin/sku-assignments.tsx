import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
  SKU_ASSIGNMENTS_QUERY,
  CREATE_SKU_ASSIGNMENT_MUTATION,
  UPDATE_SKU_ASSIGNMENT_MUTATION,
  DELETE_SKU_ASSIGNMENT_MUTATION,
  type SkuAssignmentsQueryData,
  type SkuAssignmentsQueryVariables,
  type CreateSkuAssignmentMutationData,
  type CreateSkuAssignmentMutationVariables,
  type UpdateSkuAssignmentMutationData,
  type UpdateSkuAssignmentMutationVariables,
  type DeleteSkuAssignmentMutationData,
  type DeleteSkuAssignmentMutationVariables,
} from "@/lib/graphql/sku-assignments";
import type { SkuAssignment } from "@/lib/graphql/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ConfirmDeleteDialog } from "@/components/settings/master-data/shared";
import { SkuAssignmentFormDialog } from "@/components/sku-assignments/sku-assignment-form-dialog";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2, ClipboardList } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/sku-assignments")({
  component: SkuAssignmentsComponent,
});

const PAGE_SIZE = 10;

function SkuAssignmentsComponent() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<SkuAssignment | null>(null);
  const [deleting, setDeleting] = useState<SkuAssignment | null>(null);

  const createInFlightRef = useRef(false);
  const updateInFlightRef = useRef(false);
  const deleteInFlightRef = useRef(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [...qk.skuAssignments.all, page],
    queryFn: () =>
      gqlRequest<SkuAssignmentsQueryData, SkuAssignmentsQueryVariables>(
        SKU_ASSIGNMENTS_QUERY,
        { pageSize: PAGE_SIZE, pageNumber: page },
      ),
    staleTime: 0,
    gcTime: 0,
  });

  const rows: SkuAssignment[] = data?.skuAssignments?.query ?? [];
  const pagination = data?.skuAssignments?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  const { mutate: createAssignment, isPending: createLoading } = useMutation({
    mutationFn: (vars: CreateSkuAssignmentMutationVariables) =>
      gqlRequest<CreateSkuAssignmentMutationData, CreateSkuAssignmentMutationVariables>(
        CREATE_SKU_ASSIGNMENT_MUTATION,
        vars,
      ),
    onSuccess: async () => {
      createInFlightRef.current = false;
      await refetch();
      queryClient.invalidateQueries({ queryKey: qk.skuAssignments.all });
      setIsCreateOpen(false);
      toast.success("Assignment created");
    },
    onError: (error: Error) => {
      createInFlightRef.current = false;
      toast.error("Failed to create assignment", { description: error.message });
    },
  });

  const { mutate: updateAssignment, isPending: updateLoading } = useMutation({
    mutationFn: (vars: UpdateSkuAssignmentMutationVariables) =>
      gqlRequest<UpdateSkuAssignmentMutationData, UpdateSkuAssignmentMutationVariables>(
        UPDATE_SKU_ASSIGNMENT_MUTATION,
        vars,
      ),
    onSuccess: async () => {
      updateInFlightRef.current = false;
      await refetch();
      queryClient.invalidateQueries({ queryKey: qk.skuAssignments.all });
      setEditing(null);
      toast.success("Assignment updated");
    },
    onError: (error: Error) => {
      updateInFlightRef.current = false;
      toast.error("Failed to update assignment", { description: error.message });
    },
  });

  const { mutate: deleteAssignment, isPending: deleteLoading } = useMutation({
    mutationFn: (vars: DeleteSkuAssignmentMutationVariables) =>
      gqlRequest<DeleteSkuAssignmentMutationData, DeleteSkuAssignmentMutationVariables>(
        DELETE_SKU_ASSIGNMENT_MUTATION,
        vars,
      ),
    onSuccess: async () => {
      deleteInFlightRef.current = false;
      await refetch();
      queryClient.invalidateQueries({ queryKey: qk.skuAssignments.all });
      setDeleting(null);
      toast.success("Assignment deleted");
    },
    onError: (error: Error) => {
      deleteInFlightRef.current = false;
      toast.error("Failed to delete assignment", { description: error.message });
    },
  });

  function handleCreate(values: { outletId: string; skuId: string; minExpiryMonth: number; }) {
    if (createInFlightRef.current) return;
    createInFlightRef.current = true;
    createAssignment({
      input: {
        outletId: values.outletId,
        skuId: values.skuId,
        minExpiryMonth: values.minExpiryMonth,
        createdBy: user?.id ?? "",
        updatedBy: user?.id ?? "",
      },
    });
  }

  function handleUpdate(values: { outletId: string; skuId: string; minExpiryMonth: number; }) {
    if (!editing || updateInFlightRef.current) return;
    updateInFlightRef.current = true;
    updateAssignment({
      id: editing.id,
      input: {
        ...values,
        updatedBy: user?.id ?? "",
      },
    });
  }

  function handleDelete() {
    if (!deleting || deleteInFlightRef.current) return;
    deleteInFlightRef.current = true;
    deleteAssignment({ id: deleting.id });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <AdminPageHeader
        icon={ClipboardList}
        title="SKU Assignments"
        description="Manage delivery point SKU rules with minimum expiry requirements."
        titleId="sku-assignments-title"
        descriptionId="sku-assignments-desc"
        rightSlot={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Assignment
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>
            {pagination?.totalCount ?? 0} total records
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Debtor</TableHead>
                  <TableHead>Delivery Point</TableHead>
                  <TableHead>Storage Class</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Min Expiry Month</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="py-8 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="py-8 text-center text-muted-foreground">
                      No assignments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground">—</TableCell>
                      <TableCell className="text-muted-foreground">—</TableCell>
                      <TableCell>{row.outlet.chain ?? "—"}</TableCell>
                      <TableCell>{row.outlet.channel ?? "—"}</TableCell>
                      <TableCell>{row.outlet.debtor ?? "—"}</TableCell>
                      <TableCell className="font-medium">
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.outlet.outletCode}
                        </span>
                        {"|"}
                        {row.outlet.outletName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">NULL</TableCell>
                      <TableCell>{row.sku.brand ?? "—"}</TableCell>
                      <TableCell>{row.sku.category ?? "—"}</TableCell>
                      <TableCell>{row.sku.manufacturer ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-muted-foreground">
                            {row.sku.skuCode}
                          </span>
                          <span className="max-w-[200px] truncate text-sm" title={row.sku.skuDescription}>
                            {row.sku.skuDescription}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{row.minExpiryMonth}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(row)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleting(row)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SkuAssignmentFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        initial={null}
        onSubmit={handleCreate}
        loading={createLoading}
        title="Add Assignment"
      />

      <SkuAssignmentFormDialog
        open={!!editing}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
        initial={editing}
        onSubmit={handleUpdate}
        loading={updateLoading}
        title="Edit Assignment"
      />

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        onConfirm={handleDelete}
        loading={deleteLoading}
        itemName={deleting ? `${deleting.outlet.outletCode} / ${deleting.sku.skuCode}` : ""}
      />
    </div>
  );
}
