import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Route as RouteIcon, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	APIProvider,
	AdvancedMarker,
	Map as GMap,
	useMap,
	useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GlobalLoadingShadow } from "@/components/ui/loading-shadow";
import { gqlRequest } from "@/lib/api/gql";
import { qk } from "@/lib/api/query-keys";
import {
	LOAD_BATCHES_QUERY,
	WAREHOUSE_COORDS_QUERY,
	type LoadBatchesQueryData,
	type LoadBatchesQueryVariables,
	type WarehouseCoordsData,
} from "@/lib/graphql/loading";
import {
	DRIVER_LATEST_LOCATION_QUERY,
	type DriverLatestLocationQueryData,
	type DriverLatestLocationQueryVariables,
} from "@/lib/graphql/drivers";
import type { LoadBatch, LoadBatchStop } from "@/lib/graphql/types";

export const Route = createFileRoute("/admin/tms/routing")({
	component: TmsRoutingPage,
	head: () => ({
		meta: [
			{
				title: "Routing - SME Edaran WMS",
				description: "Live route maps per region batch.",
			},
		],
	}),
});

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const GMAPS_MAP_ID = "sme-wms-routing";

function StatusBadge({ status }: { status: string }) {
	const variant = status === "DONE" ? "secondary" : status === "LOADING" ? "default" : "outline";
	return (
		<Badge variant={variant} className="text-xs">
			{status}
		</Badge>
	);
}

function sortByDeliveryOrder(stops: LoadBatchStop[]): (LoadBatchStop & { lat: number; lng: number })[] {
	return [...stops]
		.filter((s): s is LoadBatchStop & { lat: number; lng: number } => s.lat != null && s.lng != null)
		.sort((a, b) => (a.loadOrder ?? 9999) - (b.loadOrder ?? 9999));
}

/** Draws a free straight-line polyline WH → stop1 → … → last stop (no paid Directions/Routes API call). */
function RouteLine({
	depot,
	stops,
}: {
	depot: { lat: number; lng: number };
	stops: { lat: number; lng: number }[];
}) {
	const map = useMap();
	const mapsLib = useMapsLibrary("maps");

	useEffect(() => {
		if (!map || !mapsLib || stops.length === 0) return;
		const path = [depot, ...stops];
		const polyline = new mapsLib.Polyline({
			map,
			path,
			strokeColor: "#3b82f6",
			strokeWeight: 3,
			strokeOpacity: 0.7,
		});
		return () => polyline.setMap(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [map, mapsLib, JSON.stringify(stops), depot.lat, depot.lng]);

	return null;
}

function ZoneMap({
	stops,
	depot,
	mapId,
	driverLocation,
}: {
	stops: LoadBatchStop[];
	depot: { lat: number; lng: number };
	mapId: string;
	driverLocation?: { lat: number; lng: number } | null;
}) {
	const deliveryStops = sortByDeliveryOrder(stops);

	if (deliveryStops.length === 0) {
		return (
			<div className="flex h-64 items-center justify-center rounded-lg border text-xs text-muted-foreground">
				No coordinates available yet — geocoding runs when a driver is assigned.
			</div>
		);
	}

	const center = {
		lat: deliveryStops.reduce((s, p) => s + p.lat, 0) / deliveryStops.length,
		lng: deliveryStops.reduce((s, p) => s + p.lng, 0) / deliveryStops.length,
	};

	// Group co-located stops into a single marker showing combined label e.g. "1-2"
	const groups: { lat: number; lng: number; label: string; key: string }[] = [];
	for (let i = 0; i < deliveryStops.length; ) {
		const s = deliveryStops[i];
		let j = i + 1;
		while (
			j < deliveryStops.length &&
			Math.abs(deliveryStops[j].lat - s.lat) < 0.0001 &&
			Math.abs(deliveryStops[j].lng - s.lng) < 0.0001
		)
			j++;
		const label = j - i > 1 ? `${i + 1}-${j}` : `${i + 1}`;
		groups.push({ lat: s.lat, lng: s.lng, label, key: s.doId });
		i = j;
	}

	return (
		<GMap
			mapId={mapId}
			defaultCenter={center}
			defaultZoom={11}
			style={{ width: "100%", height: "280px", minHeight: "280px" }}
			gestureHandling="greedy"
			disableDefaultUI={false}
		>
			<AdvancedMarker position={depot}>
				<div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-800 text-xs font-bold text-white shadow-md">
					WH
				</div>
			</AdvancedMarker>
			{groups.map((g) => (
				<AdvancedMarker key={g.key} position={{ lat: g.lat, lng: g.lng }}>
					<div className="flex h-7 min-w-[28px] items-center justify-center rounded-full border-2 border-white bg-blue-500 px-2 text-xs font-bold text-white shadow-md">
						{g.label}
					</div>
				</AdvancedMarker>
			))}
			{driverLocation && (
				<AdvancedMarker position={driverLocation}>
					<div className="h-4 w-4 rounded-full border-2 border-white bg-red-500 shadow-md" title="Driver's last known location" />
				</AdvancedMarker>
			)}
			<RouteLine depot={depot} stops={deliveryStops} />
		</GMap>
	);
}

function BatchRouteCard({ batch, depot }: { batch: LoadBatch; depot: { lat: number; lng: number } | null }) {
	const [collapsed, setCollapsed] = useState(batch.status !== "LOADING");
	const sortedStops = [...batch.stops].sort((a, b) => (a.loadOrder ?? 9999) - (b.loadOrder ?? 9999));

	const driverId = batch.driver?.id;
	// Fetched once when the card expands — no polling, refresh the page to update (matches Bryan's "manual refresh only" call).
	const { data: locationData } = useQuery({
		queryKey: qk.driverLocation.latest(driverId ?? ""),
		queryFn: () =>
			gqlRequest<DriverLatestLocationQueryData, DriverLatestLocationQueryVariables>(
				DRIVER_LATEST_LOCATION_QUERY,
				{ driverId: driverId as string },
			),
		enabled: !!driverId && !collapsed,
	});
	const driverLocation = locationData?.driverLatestLocation
		? { lat: locationData.driverLatestLocation.lat, lng: locationData.driverLatestLocation.lng }
		: null;

	return (
		<div className="overflow-hidden rounded-lg border">
			<div
				role="button"
				tabIndex={0}
				onClick={() => setCollapsed((c) => !c)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						setCollapsed((c) => !c);
					}
				}}
				className="flex cursor-pointer select-none items-center justify-between gap-2 bg-muted/40 px-3 py-2.5 transition-colors hover:bg-muted/60 sm:px-4"
			>
				<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
					<ChevronRight
						className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${collapsed ? "" : "rotate-90"}`}
					/>
					<User className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
					<span className="truncate text-xs font-medium sm:w-40">
						{batch.driver?.name ?? <span className="italic text-muted-foreground">No driver</span>}
					</span>
					{batch.driver?.plateNumber && (
						<span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-center font-mono text-xs text-muted-foreground sm:w-24">
							{batch.driver.plateNumber}
						</span>
					)}
					<span className="rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
						{batch.regionName ?? "Unknown"} {batch.regionCode ? `(${batch.regionCode})` : ""}
					</span>
					<span className="hidden text-muted-foreground/40 sm:inline">·</span>
					<span className="shrink-0 text-xs text-muted-foreground">
						{batch.stops.length} stop{batch.stops.length !== 1 ? "s" : ""}
					</span>
				</div>
				<div className="shrink-0">
					<StatusBadge status={batch.status} />
				</div>
			</div>

			{!collapsed && (
				<div className="flex flex-col border-t sm:flex-row">
					<div className="min-w-0 flex-1">
						{depot ? (
							<>
								<ZoneMap
									stops={batch.stops}
									depot={depot}
									mapId={`${GMAPS_MAP_ID}-${batch.id}`}
									driverLocation={driverLocation}
								/>
								{locationData?.driverLatestLocation && (
									<div className="flex items-center gap-1.5 border-t px-3 py-1.5 text-[10px] text-muted-foreground">
										<span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
										Driver last seen {new Date(locationData.driverLatestLocation.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
									</div>
								)}
							</>
						) : (
							<div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
								Warehouse location not geocoded yet.
							</div>
						)}
					</div>
					<div
						className="w-full shrink-0 divide-y overflow-y-auto border-t text-sm sm:w-72 sm:border-l sm:border-t-0"
						style={{ maxHeight: 280 }}
					>
						{sortedStops.map((stop, i) => (
							<div key={stop.doId} className="flex items-start gap-3 px-3 py-2.5">
								<span className="mt-0.5 w-4 shrink-0 text-center font-mono text-xs font-bold text-muted-foreground">
									{i + 1}
								</span>
								<div className="min-w-0">
									<div className="text-xs font-semibold leading-snug">{stop.outletName ?? stop.doNo}</div>
									{stop.outletAddress && (
										<div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
											{stop.outletAddress}
										</div>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function TmsRoutingPage() {
	const queryVars: LoadBatchesQueryVariables = {};

	const { data, isLoading, isFetching } = useQuery({
		queryKey: qk.loadBatches.list(queryVars),
		queryFn: () =>
			gqlRequest<LoadBatchesQueryData, LoadBatchesQueryVariables>(LOAD_BATCHES_QUERY, queryVars),
		refetchInterval: 15000,
	});

	const { data: depotData } = useQuery({
		queryKey: qk.warehouseCoords.all,
		queryFn: () => gqlRequest<WarehouseCoordsData>(WAREHOUSE_COORDS_QUERY),
	});

	const batches = data?.loadBatches ?? [];
	const depot = depotData?.warehouseCoords ?? null;
	const loading = isLoading || isFetching;

	const latestDate = useMemo(() => {
		const all = [...new Set(batches.map((b) => b.date))].sort().reverse();
		return all[0] ?? null;
	}, [batches]);

	const dateBatches = latestDate ? batches.filter((b) => b.date === latestDate) : [];
	const activeBatches = dateBatches
		.filter((b) => b.status !== "DONE" && b.status !== "PENDING_DRIVER")
		.sort((a, b) => (a.regionCode ?? a.regionName ?? "").localeCompare(b.regionCode ?? b.regionName ?? ""));
	const doneBatches = dateBatches.filter((b) => b.status === "DONE");

	return (
		<main
			className="container mx-auto space-y-6 p-6"
			aria-labelledby="tms-routing-title"
			aria-describedby="tms-routing-description"
			aria-busy={loading}
		>
			<GlobalLoadingShadow />
			<AdminPageHeader
				icon={RouteIcon}
				title="Routing"
				description="Live route maps per region batch."
				titleId="tms-routing-title"
				descriptionId="tms-routing-description"
			/>

			{!GMAPS_KEY ? (
				<Card className="rounded-2xl border-2 border-border">
					<CardContent className="py-16 text-center text-muted-foreground">
						Google Maps API key not configured.
					</CardContent>
				</Card>
			) : activeBatches.length === 0 && doneBatches.length === 0 && !loading ? (
				<Card className="rounded-2xl border-2 border-border">
					<CardContent className="py-16 text-center text-muted-foreground">
						No route data yet — batches appear here once a DO is created.
					</CardContent>
				</Card>
			) : (
				<APIProvider apiKey={GMAPS_KEY}>
					<div className="space-y-3">
						<div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
							<span className="font-mono">{latestDate}</span>
							<span>·</span>
							<span>
								{activeBatches.length + doneBatches.length} batch
								{activeBatches.length + doneBatches.length !== 1 ? "es" : ""}
							</span>
						</div>
						<div className="flex flex-col gap-3">
							{activeBatches.map((batch) => (
								<BatchRouteCard key={batch.id} batch={batch} depot={depot} />
							))}
						</div>
						{doneBatches.length > 0 && (
							<div className="space-y-3">
								<div className="flex items-center gap-2">
									<div className="h-px flex-1 bg-green-200" />
									<span className="text-xs font-semibold uppercase tracking-widest text-green-600">
										Completed
									</span>
									<div className="h-px flex-1 bg-green-200" />
								</div>
								<div className="flex flex-col gap-3">
									{doneBatches.map((batch) => (
										<BatchRouteCard key={batch.id} batch={batch} depot={depot} />
									))}
								</div>
							</div>
						)}
					</div>
				</APIProvider>
			)}
		</main>
	);
}
