export interface DashboardStats {
	totalGRNs: number;
	pendingGRNs: number;
	grnsToday: number;
	grnsPendingApproval: number;
	totalTransfers: number;
	activeTransfers: number;
	tosPulledToday: number;
	tosLastPullTime?: Date;
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
}

export interface IntegrationHealth {
	lastTOPullTime: Date;
	lastStockSyncTime: Date;
	failedSyncCount: number;
	stockSyncStatus: "OK" | "Fail";
}

export interface GRN {
	id: string;
	grnNumber: string;
	supplier: string;
	status: "DRAFT" | "SUBMITTED" | "APPROVED" | "SENT" | "FAILED";
	createdAt: Date;
	totalAmount: number;
}

export interface TransferOrder {
	id: string;
	transferOrderNumber: string;
	fromLocation: string;
	toLocation: string;
	status:
		| "NEW"
		| "ACCEPTED"
		| "REJECTED"
		| "DO_CREATED"
		| "SHIPPED"
		| "CANCELLED";
	createdAt: Date;
	itemCount: number;
}

export interface Delivery {
	id: string;
	deliveryNumber: string;
	customerName: string;
	status: "CREATED" | "PACKING" | "SHIPPED" | "DELIVERED";
	scheduledDate: Date;
	deliveryDate?: Date;
	totalAmount: number;
}

export const mockDashboardStats: DashboardStats = {
	totalGRNs: 124,
	pendingGRNs: 8,
	grnsToday: 5,
	grnsPendingApproval: 3,
	totalTransfers: 45,
	activeTransfers: 12,
	tosPulledToday: 8,
	tosLastPullTime: new Date(Date.now() - 2 * 3600000), // 2 hours ago
	totalDeliveries: 89,
	scheduledDeliveries: 15,
	dosByStatus: {
		picking: 5,
		ready: 8,
		deliveredPendingProof: 12,
	},
	shortageDamagePending: 4,
	invoicesIssuedToday: 3,
	invoicesIssuedThisWeek: 15,
	inventoryValue: 2450000,
	lowStockItems: 23,
};

export const mockIntegrationHealth: IntegrationHealth = {
	lastTOPullTime: new Date(Date.now() - 2 * 3600000), // 2 hours ago
	lastStockSyncTime: new Date(Date.now() - 12 * 3600000), // 12 hours ago (daily sync)
	failedSyncCount: 2,
	stockSyncStatus: "OK",
};

export const mockGRNs: GRN[] = [
	{
		id: "1",
		grnNumber: "GRN-2024-001",
		supplier: "ABC Supplies Sdn Bhd",
		status: "APPROVED",
		createdAt: new Date("2024-01-15"),
		totalAmount: 12500.0,
	},
	{
		id: "2",
		grnNumber: "GRN-2024-002",
		supplier: "XYZ Trading Co",
		status: "SUBMITTED",
		createdAt: new Date("2024-01-16"),
		totalAmount: 8750.0,
	},
	{
		id: "3",
		grnNumber: "GRN-2024-003",
		supplier: "Global Imports Ltd",
		status: "APPROVED",
		createdAt: new Date("2024-01-17"),
		totalAmount: 15200.0,
	},
	{
		id: "4",
		grnNumber: "GRN-2024-004",
		supplier: "ABC Supplies Sdn Bhd",
		status: "SUBMITTED",
		createdAt: new Date("2024-01-18"),
		totalAmount: 9800.0,
	},
	{
		id: "5",
		grnNumber: "GRN-2024-005",
		supplier: "Premium Distributors",
		status: "APPROVED",
		createdAt: new Date("2024-01-19"),
		totalAmount: 11200.0,
	},
	{
		id: "6",
		grnNumber: "GRN-2024-006",
		supplier: "XYZ Trading Co",
		status: "SUBMITTED",
		createdAt: new Date("2024-01-20"),
		totalAmount: 6500.0,
	},
	{
		id: "7",
		grnNumber: "GRN-2024-007",
		supplier: "Global Imports Ltd",
		status: "APPROVED",
		createdAt: new Date("2024-01-21"),
		totalAmount: 18900.0,
	},
];

export const mockTransferOrders: TransferOrder[] = [
	{
		id: "1",
		transferOrderNumber: "PO-2024-001",
		fromLocation: "Warehouse A",
		toLocation: "Warehouse B",
		status: "SHIPPED",
		createdAt: new Date("2024-01-15"),
		itemCount: 45,
	},
	{
		id: "2",
		transferOrderNumber: "PO-2024-002",
		fromLocation: "Warehouse B",
		toLocation: "Warehouse C",
		status: "NEW",
		createdAt: new Date("2024-01-16"),
		itemCount: 32,
	},
	{
		id: "3",
		transferOrderNumber: "PO-2024-003",
		fromLocation: "Warehouse A",
		toLocation: "Warehouse D",
		status: "DO_CREATED",
		createdAt: new Date("2024-01-17"),
		itemCount: 28,
	},
	{
		id: "4",
		transferOrderNumber: "PO-2024-004",
		fromLocation: "Warehouse C",
		toLocation: "Warehouse A",
		status: "SHIPPED",
		createdAt: new Date("2024-01-18"),
		itemCount: 56,
	},
	{
		id: "5",
		transferOrderNumber: "PO-2024-005",
		fromLocation: "Warehouse D",
		toLocation: "Warehouse B",
		status: "NEW",
		createdAt: new Date("2024-01-19"),
		itemCount: 19,
	},
	{
		id: "6",
		transferOrderNumber: "PO-2024-006",
		fromLocation: "Warehouse A",
		toLocation: "Warehouse C",
		status: "SHIPPED",
		createdAt: new Date("2024-01-20"),
		itemCount: 67,
	},
	{
		id: "7",
		transferOrderNumber: "PO-2024-007",
		fromLocation: "Warehouse B",
		toLocation: "Warehouse D",
		status: "DO_CREATED",
		createdAt: new Date("2024-01-21"),
		itemCount: 41,
	},
];

export const mockDeliveries: Delivery[] = [
	{
		id: "1",
		deliveryNumber: "DEL-2024-001",
		customerName: "Tech Solutions Sdn Bhd",
		status: "CREATED",
		scheduledDate: new Date("2024-01-25"),
		totalAmount: 18500.0,
	},
	{
		id: "2",
		deliveryNumber: "DEL-2024-002",
		customerName: "Retail Plus Malaysia",
		status: "PACKING",
		scheduledDate: new Date("2024-01-26"),
		totalAmount: 12200.0,
	},
	{
		id: "3",
		deliveryNumber: "DEL-2024-003",
		customerName: "Global Trading Co",
		status: "DELIVERED",
		scheduledDate: new Date("2024-01-20"),
		deliveryDate: new Date("2024-01-20"),
		totalAmount: 9800.0,
	},
	{
		id: "4",
		deliveryNumber: "DEL-2024-004",
		customerName: "Premium Retailers",
		status: "PACKING",
		scheduledDate: new Date("2024-01-27"),
		totalAmount: 15600.0,
	},
	{
		id: "5",
		deliveryNumber: "DEL-2024-005",
		customerName: "City Distributors",
		status: "SHIPPED",
		scheduledDate: new Date("2024-01-22"),
		totalAmount: 11200.0,
	},
	{
		id: "6",
		deliveryNumber: "DEL-2024-006",
		customerName: "Tech Solutions Sdn Bhd",
		status: "CREATED",
		scheduledDate: new Date("2024-01-28"),
		totalAmount: 8900.0,
	},
	{
		id: "7",
		deliveryNumber: "DEL-2024-007",
		customerName: "Retail Plus Malaysia",
		status: "DELIVERED",
		scheduledDate: new Date("2024-01-19"),
		deliveryDate: new Date("2024-01-19"),
		totalAmount: 13400.0,
	},
	{
		id: "8",
		deliveryNumber: "DEL-2024-008",
		customerName: "Global Trading Co",
		status: "CREATED",
		scheduledDate: new Date("2024-01-29"),
		totalAmount: 16700.0,
	},
];

export interface DashboardData {
	stats: DashboardStats;
	integrationHealth: IntegrationHealth;
	grns: GRN[];
	transferOrders: TransferOrder[];
	deliveries: Delivery[];
	pendingProofCount: number;
}

export async function getDashboardData(): Promise<DashboardData> {
	// Simulate API delay
	await new Promise((resolve) => setTimeout(resolve, 300));

	return {
		stats: mockDashboardStats,
		integrationHealth: mockIntegrationHealth,
		grns: mockGRNs,
		transferOrders: mockTransferOrders,
		deliveries: mockDeliveries,
		pendingProofCount: mockDashboardStats.dosByStatus.deliveredPendingProof,
	};
}
