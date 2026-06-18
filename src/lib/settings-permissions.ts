/**
 * Module names used for Settings tab permissions (RBAC).
 * Must match backend module names when created in RBAC (e.g. via createModule).
 * Used to show/hide Master Data sub-tabs and Integration Status tab.
 */

/** Module name for the Email Settings tab */
export const SETTINGS_EMAIL_SETTINGS_MODULE = "Email Settings";
export const SETTINGS_WHATSAPP_SETTINGS_MODULE = "WhatsApp Settings";

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
	zone: "Zone",
	bin: "Bin",
	"putaway-rule": "Putaway Rule",
	"end-user": "End User",
};

export type SettingsMasterDataSubTabId =
	keyof typeof SETTINGS_MASTER_DATA_MODULES;

const MODULE_NAME_ALIASES: Record<string, string[]> = {
	"Integration Status": ["Integration Status", "Integration"],
	Supplier: ["Supplier", "Suppliers"],
	Warehouse: ["Warehouse", "Warehouses"],
	Region: ["Region", "Regions"],
	"Delivery Schedule": ["Delivery Schedule", "Delivery Schedules"],
	Outlet: ["Outlet", "Outlets"],
	"Stock Unit": ["Stock Unit", "Stock Units", "UOM", "UoM"],
	Rack: ["Rack", "Racks"],
	SKU: ["SKU", "SKUs", "Stock", "Stocks"],
	Zone: ["Zone", "Zones"],
	Bin: ["Bin", "Bins"],
	"Putaway Rule": ["Putaway Rule", "Putaway Rules"],
	"End User": ["End User", "End Users"],
};

function normalizeModuleName(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

/**
 * Returns true if the user has Read or Create permission for the given module.
 */
export function hasModulePermission(
	user: { readPermission?: string[]; createPermission?: string[] } | null,
	moduleName: string,
): boolean {
	if (!user?.readPermission && !user?.createPermission) return false;
	const candidates = MODULE_NAME_ALIASES[moduleName] ?? [moduleName];
	const normalizedCandidates = new Set(
		candidates.map((candidate) => normalizeModuleName(candidate)),
	);
	const userPermissions = [
		...(user.readPermission ?? []),
		...(user.createPermission ?? []),
	];

	return userPermissions.some((permission) =>
		normalizedCandidates.has(normalizeModuleName(permission)),
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
export function canSeeEmailSettingsTab(
	user: { readPermission?: string[]; createPermission?: string[] } | null,
): boolean {
	return hasModulePermission(user, SETTINGS_EMAIL_SETTINGS_MODULE);
}

export function canSeeWhatsAppSettingsTab(
	user: { readPermission?: string[]; createPermission?: string[] } | null,
): boolean {
	return hasModulePermission(user, SETTINGS_WHATSAPP_SETTINGS_MODULE);
}
