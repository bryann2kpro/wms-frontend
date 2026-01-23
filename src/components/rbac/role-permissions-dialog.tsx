import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Shield } from "lucide-react";
import { Loader2 } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { getErrorMessage } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchRolePermissions, RbacRole } from "@/lib/rbac";
import { RolePermissionModule } from "@/lib/rbac";
import { RefreshCw } from "lucide-react";
import { Key } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Package } from "lucide-react";
import { Check } from "lucide-react";
import { X } from "lucide-react";


// Role Permissions Dialog Component
interface RolePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RbacRole | null;
  logout: () => void;
}
function RolePermissionsDialog({
  open,
  onOpenChange,
  role,
  logout,
}: RolePermissionsDialogProps) {
  // Fetch role permissions when dialog opens
  const {
    data: permissionsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["rbac-role-permissions", role?.roleId],
    queryFn: () => fetchRolePermissions({ roleId: role!.roleId, pageSize: 100 }, logout),
    enabled: open && !!role?.roleId,
    staleTime: 30_000,
  });

  const permissionModules = permissionsData?.data ?? [];

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" aria-hidden="true" />
            Permissions for {role.roleName}
          </DialogTitle>
          <DialogDescription>
            View all module permissions assigned to this role.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-3" aria-hidden="true" />
              <span>Loading permissions...</span>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-8 w-8 text-destructive mb-3" aria-hidden="true" />
              <p className="font-medium text-destructive">Failed to load permissions</p>
              <p className="text-sm text-muted-foreground mt-1">
                {getErrorMessage(error)}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Try Again
              </Button>
            </div>
          ) : permissionModules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Key className="h-8 w-8 mb-3" aria-hidden="true" />
              <span>No permissions assigned to this role</span>
            </div>
          ) : (
            <div className="space-y-4">
              {permissionModules.map((moduleData) => (
                <PermissionModuleCard key={moduleData.module} moduleData={moduleData} />
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Permission Module Card Component
interface PermissionModuleCardProps {
  moduleData: RolePermissionModule;
}

function PermissionModuleCard({ moduleData }: PermissionModuleCardProps) {
  // Define permission types in order
  const permissionTypes = ["View", "Read", "Create", "Update", "Delete"] as const;

  // Create a map of permission type to permission detail
  const permissionMap = new Map(
    moduleData.permissions.map((p) => [p.permissionType, p])
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" aria-hidden="true" />
          {moduleData.module}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-2">
          {permissionTypes.map((type) => {
            const permission = permissionMap.get(type);
            const hasPermission = permission?.hasPermission ?? false;

            return (
              <div
                key={type}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border ${
                  hasPermission
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                    : "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 ${
                    hasPermission
                      ? "bg-green-500 text-white"
                      : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {hasPermission ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <X className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium ${
                    hasPermission
                      ? "text-green-700 dark:text-green-300"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {type}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}


export { RolePermissionsDialog, type RolePermissionsDialogProps };