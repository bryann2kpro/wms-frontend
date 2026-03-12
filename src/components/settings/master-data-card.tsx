import { useState } from "react";
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

type SubTab =
	| "supplier"
	| "region"
	| "delivery-schedule"
	| "outlet"
	| "stock-unit"
	| "rack"
	| "skus"
	| "warehouse";

export function MasterDataCard() {
	const [subTab, setSubTab] = useState<SubTab>("supplier");

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2 border-b pb-2">
				<Button
					variant={subTab === "supplier" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("supplier")}
					className="rounded-lg rounded-b-none"
				>
					<Truck className="mr-2 h-4 w-4" />
					Suppliers
				</Button>
				<Button
					variant={subTab === "warehouse" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("warehouse")}
					className="rounded-lg rounded-b-none"
				>
					<Building className="mr-2 h-4 w-4" />
					Warehouses
				</Button>
				<Button
					variant={subTab === "region" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("region")}
					className="rounded-lg rounded-b-none"
				>
					<MapPin className="mr-2 h-4 w-4" />
					Regions
				</Button>
				<Button
					variant={subTab === "delivery-schedule" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("delivery-schedule")}
					className="rounded-lg rounded-b-none"
				>
					<CalendarClock className="mr-2 h-4 w-4" />
					Delivery Schedules
				</Button>
				<Button
					variant={subTab === "outlet" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("outlet")}
					className="rounded-lg rounded-b-none"
				>
					<Store className="mr-2 h-4 w-4" />
					Outlets
				</Button>
				<Button
					variant={subTab === "stock-unit" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("stock-unit")}
					className="rounded-lg rounded-b-none"
				>
					<Package className="mr-2 h-4 w-4" />
					Stock Units
				</Button>
				<Button
					variant={subTab === "rack" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("rack")}
					className="rounded-lg rounded-b-none"
				>
					<LayoutGrid className="mr-2 h-4 w-4" />
					Racks
				</Button>
				<Button
					variant={subTab === "skus" ? "default" : "ghost"}
					size="sm"
					onClick={() => setSubTab("skus")}
					className="rounded-lg rounded-b-none"
				>
					<Package className="mr-2 h-4 w-4" />
					SKUS
				</Button>
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
