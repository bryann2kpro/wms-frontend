import { gql } from "graphql-request";

export const DASHBOARD_QUERY = gql`
	query Dashboard {
		dashboard {
			stats {
				totalGRNs
				pendingGRNs
				grnsToday
				grnsPendingApproval
				totalTransfers
				activeTransfers
				tosPulledToday
				tosLastPullTime
				totalDeliveries
				scheduledDeliveries
				dosByStatus {
					picking
					ready
					deliveredPendingProof
				}
				shortageDamagePending
				invoicesIssuedToday
				invoicesIssuedThisWeek
				inventoryValue
				lowStockItems
			}
			integrationHealth {
				lastTOPullTime
				lastStockSyncTime
				failedSyncCount
				stockSyncStatus
			}
			grns {
				id
				grnNumber
				supplier
				status
				createdAt
				totalAmount
			}
			transferOrders {
				id
				transferOrderNumber
				fromLocation
				toLocation
				status
				createdAt
				itemCount
			}
			deliveries {
				id
				deliveryNumber
				customerName
				status
				scheduledDate
				deliveryDate
				totalAmount
			}
			pendingProofCount
		}
	}
`;

export type DashboardQueryData = {
	dashboard: {
		stats: {
			totalGRNs: number;
			pendingGRNs: number;
			grnsToday: number;
			grnsPendingApproval: number;
			totalTransfers: number;
			activeTransfers: number;
			tosPulledToday: number;
			tosLastPullTime: string | null;
			totalDeliveries: number;
			scheduledDeliveries: number;
			dosByStatus: {
				picking: number;
				ready: number;
				deliveredPendingProof: number;
			};
			shortageDamagePending: number;
			invoicesIssuedToday: number;
			invoicesIssuedThisWeek: number;
			inventoryValue: number;
			lowStockItems: number;
		};
		integrationHealth: {
			lastTOPullTime: string;
			lastStockSyncTime: string;
			failedSyncCount: number;
			stockSyncStatus: string;
		};
		grns: Array<{
			id: string;
			grnNumber: string;
			supplier: string;
			status: string;
			createdAt: string;
			totalAmount: number;
		}>;
		transferOrders: Array<{
			id: string;
			transferOrderNumber: string;
			fromLocation: string;
			toLocation: string;
			status: string;
			createdAt: string;
			itemCount: number;
		}>;
		deliveries: Array<{
			id: string;
			deliveryNumber: string;
			customerName: string;
			status: string;
			scheduledDate: string;
			deliveryDate: string | null;
			totalAmount: number;
		}>;
		pendingProofCount: number;
	};
};

/** Map GraphQL response to DashboardData shape (with Date objects) for existing UI */
export function mapDashboardQueryToData(
	raw: DashboardQueryData["dashboard"],
): import("@/data/dashboard.mock-data").DashboardData {
	return {
		stats: {
			...raw.stats,
			tosLastPullTime: raw.stats.tosLastPullTime
				? new Date(raw.stats.tosLastPullTime)
				: undefined,
		} as import("@/data/dashboard.mock-data").DashboardStats,
		integrationHealth: {
			...raw.integrationHealth,
			lastTOPullTime: new Date(raw.integrationHealth.lastTOPullTime),
			lastStockSyncTime: new Date(raw.integrationHealth.lastStockSyncTime),
		} as import("@/data/dashboard.mock-data").IntegrationHealth,
		grns: raw.grns.map((g) => ({
			...g,
			createdAt: new Date(g.createdAt),
		})) as import("@/data/dashboard.mock-data").GRN[],
		transferOrders: raw.transferOrders.map((t) => ({
			...t,
			createdAt: new Date(t.createdAt),
		})) as import("@/data/dashboard.mock-data").TransferOrder[],
		deliveries: raw.deliveries.map((d) => ({
			...d,
			scheduledDate: new Date(d.scheduledDate),
			deliveryDate: d.deliveryDate ? new Date(d.deliveryDate) : undefined,
		})) as import("@/data/dashboard.mock-data").Delivery[],
		pendingProofCount: raw.pendingProofCount,
	};
}
