/**
 * Module names used for Settings tab permissions (RBAC).
 * Must match backend module names when created in RBAC (e.g. via createModule).
 * Used to show/hide Master Data sub-tabs and Integration Status tab.
 */

/** Module name for the Integration Status settings tab */
export const SETTINGS_INTEGRATION_STATUS_MODULE = "Integration Status";

/**
 * Master Data sub-tabs: each key is the sub-tab id, value is the RBAC module name.
 * If the user has Read or Create for a module, they see that sub-tab.
 * If they have no permission for any of these, the Master Data tab is hidden.
 */
export const SETTINGS_MASTER_DATA_MODULES: Record<string, string> = {
	supplier: "Supplier",
	warehouse: "Warehouse",
	region: "Region",
	"delivery-schedule": "Delivery Schedule",
	outlet: "Outlet",
	"stock-unit": "Stock Unit",
	rack: "Rack",
	skus: "SKU",
};

export type SettingsMasterDataSubTabId =
	keyof typeof SETTINGS_MASTER_DATA_MODULES;

/**
 * Returns true if the user has Read or Create permission for the given module.
 */
export function hasModulePermission(
	user: { readPermission?: string[]; createPermission?: string[] } | null,
	moduleName: string,
): boolean {
	if (!user?.readPermission && !user?.createPermission) return false;
	return (
		user.readPermission?.includes(moduleName) === true ||
		user.createPermission?.includes(moduleName) === true
	);
}

/**
 * Returns the list of Master Data sub-tab ids the user is allowed to see.
 */
export function getAllowedMasterDataSubTabs(
	user: { readPermission?: string[]; createPermission?: string[] } | null,
): SettingsMasterDataSubTabId[] {
	if (!user) return [];
	const allowed: SettingsMasterDataSubTabId[] = [];
	for (const [subTabId, moduleName] of Object.entries(
		SETTINGS_MASTER_DATA_MODULES,
	)) {
		if (hasModulePermission(user, moduleName)) {
			allowed.push(subTabId as SettingsMasterDataSubTabId);
		}
	}
	return allowed;
}

/**
 * True if the user can see the Master Data tab (has at least one master-data module permission).
 */
export function canSeeMasterDataTab(
	user: { readPermission?: string[]; createPermission?: string[] } | null,
): boolean {
	return getAllowedMasterDataSubTabs(user).length > 0;
}

/**
 * True if the user can see the Integration Status tab.
 */
export function canSeeIntegrationStatusTab(
	user: { readPermission?: string[]; createPermission?: string[] } | null,
): boolean {
	return hasModulePermission(user, SETTINGS_INTEGRATION_STATUS_MODULE);
}
