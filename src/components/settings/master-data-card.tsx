import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Truck,
	Building,
	MapPin,
	CalendarClock,
	Store,
	Package,
	LayoutGrid,
} from "lucide-react";
import {
	SupplierSection,
	WarehouseSection,
	RegionSection,
	DeliveryScheduleSection,
	OutletSection,
	StockUnitSection,
	RackSection,
	SkusSection,
} from "./master-data";
import type { SettingsMasterDataSubTabId } from "@/lib/settings-permissions";

type SubTab =
	| "supplier"
	| "region"
	| "delivery-schedule"
	| "outlet"
	| "stock-unit"
	| "rack"
	| "skus"
	| "warehouse";

const SUB_TAB_ORDER: SubTab[] = [
	"supplier",
	"warehouse",
	"region",
	"delivery-schedule",
	"outlet",
	"stock-unit",
	"rack",
	"skus",
];

const SUB_TAB_CONFIG: Record<SubTab, { label: string; icon: typeof Truck }> = {
	supplier: { label: "Suppliers", icon: Truck },
	warehouse: { label: "Warehouses", icon: Building },
	region: { label: "Regions", icon: MapPin },
	"delivery-schedule": { label: "Delivery Schedules", icon: CalendarClock },
	outlet: { label: "Outlets", icon: Store },
	"stock-unit": { label: "Stock Units", icon: Package },
	rack: { label: "Racks", icon: LayoutGrid },
	skus: { label: "SKUS", icon: Package },
};

interface MasterDataCardProps {
	/** When provided, only these sub-tabs are shown (permission-based). If empty, nothing is shown. */
	allowedSubTabs?: SettingsMasterDataSubTabId[];
}

export function MasterDataCard({ allowedSubTabs }: MasterDataCardProps) {
	const visibleSubTabs: SubTab[] =
		allowedSubTabs && allowedSubTabs.length > 0
			? SUB_TAB_ORDER.filter((id) => (allowedSubTabs as string[]).includes(id))
			: SUB_TAB_ORDER;
	const firstVisible = visibleSubTabs[0] ?? "supplier";
	const [subTab, setSubTab] = useState<SubTab>(firstVisible);

	useEffect(() => {
		if (!visibleSubTabs.includes(subTab)) {
			setSubTab(visibleSubTabs[0] ?? "supplier");
		}
	}, [visibleSubTabs.join(","), subTab]);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2 border-b pb-2">
				{visibleSubTabs.map((id) => {
					const { label, icon: Icon } = SUB_TAB_CONFIG[id];
					return (
						<Button
							key={id}
							variant={subTab === id ? "default" : "ghost"}
							size="sm"
							onClick={() => setSubTab(id)}
							className="rounded-lg rounded-b-none"
						>
							<Icon className="mr-2 h-4 w-4" />
							{label}
						</Button>
					);
				})}
			</div>
			{subTab === "supplier" && <SupplierSection />}
			{subTab === "region" && <RegionSection />}
			{subTab === "warehouse" && <WarehouseSection />}
			{subTab === "delivery-schedule" && <DeliveryScheduleSection />}
			{subTab === "outlet" && <OutletSection />}
			{subTab === "stock-unit" && <StockUnitSection />}
			{subTab === "rack" && <RackSection />}
			{subTab === "skus" && <SkusSection />}
		</div>
	);
}
