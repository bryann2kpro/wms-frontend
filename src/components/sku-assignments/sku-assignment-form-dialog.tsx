import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OUTLETS_QUERY,
  type OutletsQueryData,
  type OutletsQueryVariables,
} from "@/lib/graphql/outlets";
import { SKUS_QUERY, type SkusQueryData } from "@/lib/graphql/skus";
import type { SkuAssignment } from "@/lib/graphql/types";

interface FormValues {
  outletId: string;
  skuId: string;
  minExpiryMonth: string;
}

interface AssignmentFormValues {
  outletId: string;
  skuId: string;
  minExpiryMonth: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: SkuAssignment | null;
  onSubmit: (values: AssignmentFormValues) => void;
  loading: boolean;
  title: string;
}

export function SkuAssignmentFormDialog({ open, onOpenChange, initial, onSubmit, loading, title }: Props) {
  const [outletSearch, setOutletSearch] = useState("");
  const [outletOpen, setOutletOpen] = useState(false);
  const [skuSearch, setSkuSearch] = useState("");
  const [skuOpen, setSkuOpen] = useState(false);

  const [values, setValues] = useState<FormValues>({
    outletId: "",
    skuId: "",
    minExpiryMonth: "",
  });

  useEffect(() => {
    if (open) {
      setValues({
        outletId: initial?.outlet.outletId ?? "",
        skuId: initial?.sku.skuId ?? "",
        minExpiryMonth: initial?.minExpiryMonth?.toString() ?? "",
      });
      setOutletSearch("");
      setSkuSearch("");
    }
  }, [open, initial]);

  const { data: outletsData } = useQuery({
    queryKey: qk.outlets.all,
    queryFn: () => gqlRequest<OutletsQueryData, OutletsQueryVariables>(OUTLETS_QUERY, {}),
    enabled: open,
  });
  const outlets = outletsData?.outlets?.query ?? [];

  const { data: itemsData } = useQuery({
    queryKey: qk.items.all,
    queryFn: () => gqlRequest<SkusQueryData>(SKUS_QUERY, {}),
    enabled: open,
  });
  const skus = itemsData?.skus?.query ?? [];

  const filteredOutlets = outlets.filter((o) => {
    const q = outletSearch.toLowerCase();
    return (
      o.outletCode.toLowerCase().includes(q) ||
      o.outletName.toLowerCase().includes(q)
    );
  });

  const filteredSkus = skus.filter((s) => {
    const q = skuSearch.toLowerCase();
    return (
      s.skuCode.toLowerCase().includes(q) ||
      s.skuDescription.toLowerCase().includes(q)
    );
  });

  const selectedOutlet = outlets.find((o) => o.outletId === values.outletId);
  const selectedSku = skus.find((s) => s.skuId === values.skuId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const minExpiryMonth = parseInt(values.minExpiryMonth, 10);
    if (!values.outletId || !values.skuId || isNaN(minExpiryMonth) || minExpiryMonth < 1) return;

    onSubmit({
      outletId: values.outletId,
      skuId: values.skuId,
      minExpiryMonth,
    });
  }

  const isEdit = !!initial;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the SKU assignment details." : "Assign a SKU to a delivery point with a minimum expiry rule."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Outlet */}
          <div className="space-y-1">
            <Label>Delivery Point</Label>
            <Popover open={outletOpen} onOpenChange={setOutletOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedOutlet
                    ? `${selectedOutlet.outletCode} | ${selectedOutlet.outletName}`
                    : "Select delivery point..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <div className="p-2">
                  <Input
                    placeholder="Search outlet..."
                    value={outletSearch}
                    onChange={(e) => setOutletSearch(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filteredOutlets.map((o) => (
                    <div
                      key={o.outletId}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent",
                        values.outletId === o.outletId && "bg-accent",
                      )}
                      onClick={() => {
                        setValues((v) => ({ ...v, outletId: o.outletId }));
                        setOutletOpen(false);
                      }}
                    >
                      <Check className={cn("h-4 w-4", values.outletId === o.outletId ? "opacity-100" : "opacity-0")} />
                      <span className="font-mono text-xs text-muted-foreground">{o.outletCode}</span>
                      <span>{o.outletName}</span>
                    </div>
                  ))}
                  {filteredOutlets.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No results.</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {selectedOutlet && (
              <div className="grid grid-cols-3 gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                <span>Chain: {selectedOutlet.chain ?? "—"}</span>
                <span>Channel: {selectedOutlet.channel ?? "—"}</span>
                <span>Debtor: {selectedOutlet.debtor ?? "—"}</span>
              </div>
            )}
          </div>

          {/* SKU */}
          <div className="space-y-1">
            <Label>Item (SKU)</Label>
            <Popover open={skuOpen} onOpenChange={setSkuOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedSku
                    ? `${selectedSku.skuCode} ${selectedSku.skuDescription}`
                    : "Select item..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <div className="p-2">
                  <Input
                    placeholder="Search SKU..."
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {filteredSkus.map((s) => (
                    <div
                      key={s.skuId}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent",
                        values.skuId === s.skuId && "bg-accent",
                      )}
                      onClick={() => {
                        setValues((v) => ({ ...v, skuId: s.skuId }));
                        setSkuOpen(false);
                      }}
                    >
                      <Check className={cn("h-4 w-4", values.skuId === s.skuId ? "opacity-100" : "opacity-0")} />
                      <span className="font-mono text-xs text-muted-foreground">{s.skuCode}</span>
                      <span className="truncate">{s.skuDescription}</span>
                    </div>
                  ))}
                  {filteredSkus.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No results.</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {selectedSku && (
              <div className="grid grid-cols-3 gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                <span>Brand: {selectedSku.brand ?? "—"}</span>
                <span>Category: {selectedSku.category ?? "—"}</span>
                <span>Manufacturer: {selectedSku.manufacturer ?? "—"}</span>
              </div>
            )}
          </div>

          {/* Min Expiry Month */}
          <div className="space-y-1">
            <Label htmlFor="minExpiryMonth">Min Expiry Month</Label>
            <Input
              id="minExpiryMonth"
              type="number"
              min={1}
              placeholder="e.g. 8"
              value={values.minExpiryMonth}
              onChange={(e) => setValues((v) => ({ ...v, minExpiryMonth: e.target.value }))}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !values.outletId || !values.skuId || !values.minExpiryMonth}
            >
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
