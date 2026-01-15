export interface DashboardStats {
  totalGRNs: number
  pendingGRNs: number
  totalTransfers: number
  activeTransfers: number
  totalDeliveries: number
  scheduledDeliveries: number
  inventoryValue: number
  lowStockItems: number
}

export interface GRN {
  id: string
  grnNumber: string
  supplier: string
  status: 'completed' | 'pending' | 'cancelled'
  createdAt: Date
  totalAmount: number
}

export interface TransferOrder {
  id: string
  transferOrderNumber: string
  fromLocation: string
  toLocation: string
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled'
  createdAt: Date
  itemCount: number
}

export interface Delivery {
  id: string
  deliveryNumber: string
  customerName: string
  status:
    | 'CREATED'
    | 'PICKING'
    | 'PACKED'
    | 'DISPATCHED'
    | 'DELIVERED_CONFIRMED'
    | 'CANCELLED'
  scheduledDate: Date
  deliveryDate?: Date
  totalAmount: number
}

export const mockDashboardStats: DashboardStats = {
  totalGRNs: 124,
  pendingGRNs: 8,
  totalTransfers: 45,
  activeTransfers: 12,
  totalDeliveries: 89,
  scheduledDeliveries: 15,
  inventoryValue: 2450000,
  lowStockItems: 23,
}

export const mockGRNs: GRN[] = [
  {
    id: '1',
    grnNumber: 'GRN-2024-001',
    supplier: 'ABC Supplies Sdn Bhd',
    status: 'completed',
    createdAt: new Date('2024-01-15'),
    totalAmount: 12500.00,
  },
  {
    id: '2',
    grnNumber: 'GRN-2024-002',
    supplier: 'XYZ Trading Co',
    status: 'pending',
    createdAt: new Date('2024-01-16'),
    totalAmount: 8750.00,
  },
  {
    id: '3',
    grnNumber: 'GRN-2024-003',
    supplier: 'Global Imports Ltd',
    status: 'completed',
    createdAt: new Date('2024-01-17'),
    totalAmount: 15200.00,
  },
  {
    id: '4',
    grnNumber: 'GRN-2024-004',
    supplier: 'ABC Supplies Sdn Bhd',
    status: 'pending',
    createdAt: new Date('2024-01-18'),
    totalAmount: 9800.00,
  },
  {
    id: '5',
    grnNumber: 'GRN-2024-005',
    supplier: 'Premium Distributors',
    status: 'completed',
    createdAt: new Date('2024-01-19'),
    totalAmount: 11200.00,
  },
  {
    id: '6',
    grnNumber: 'GRN-2024-006',
    supplier: 'XYZ Trading Co',
    status: 'pending',
    createdAt: new Date('2024-01-20'),
    totalAmount: 6500.00,
  },
  {
    id: '7',
    grnNumber: 'GRN-2024-007',
    supplier: 'Global Imports Ltd',
    status: 'completed',
    createdAt: new Date('2024-01-21'),
    totalAmount: 18900.00,
  },
]

export const mockTransferOrders: TransferOrder[] = [
  {
    id: '1',
    transferOrderNumber: 'TO-2024-001',
    fromLocation: 'Warehouse A',
    toLocation: 'Warehouse B',
    status: 'in_transit',
    createdAt: new Date('2024-01-15'),
    itemCount: 45,
  },
  {
    id: '2',
    transferOrderNumber: 'TO-2024-002',
    fromLocation: 'Warehouse B',
    toLocation: 'Warehouse C',
    status: 'pending',
    createdAt: new Date('2024-01-16'),
    itemCount: 32,
  },
  {
    id: '3',
    transferOrderNumber: 'TO-2024-003',
    fromLocation: 'Warehouse A',
    toLocation: 'Warehouse D',
    status: 'completed',
    createdAt: new Date('2024-01-17'),
    itemCount: 28,
  },
  {
    id: '4',
    transferOrderNumber: 'TO-2024-004',
    fromLocation: 'Warehouse C',
    toLocation: 'Warehouse A',
    status: 'in_transit',
    createdAt: new Date('2024-01-18'),
    itemCount: 56,
  },
  {
    id: '5',
    transferOrderNumber: 'TO-2024-005',
    fromLocation: 'Warehouse D',
    toLocation: 'Warehouse B',
    status: 'pending',
    createdAt: new Date('2024-01-19'),
    itemCount: 19,
  },
  {
    id: '6',
    transferOrderNumber: 'TO-2024-006',
    fromLocation: 'Warehouse A',
    toLocation: 'Warehouse C',
    status: 'in_transit',
    createdAt: new Date('2024-01-20'),
    itemCount: 67,
  },
  {
    id: '7',
    transferOrderNumber: 'TO-2024-007',
    fromLocation: 'Warehouse B',
    toLocation: 'Warehouse D',
    status: 'completed',
    createdAt: new Date('2024-01-21'),
    itemCount: 41,
  },
]

export const mockDeliveries: Delivery[] = [
  {
    id: '1',
    deliveryNumber: 'DEL-2024-001',
    customerName: 'Tech Solutions Sdn Bhd',
    status: 'CREATED',
    scheduledDate: new Date('2024-01-25'),
    totalAmount: 18500.00,
  },
  {
    id: '2',
    deliveryNumber: 'DEL-2024-002',
    customerName: 'Retail Plus Malaysia',
    status: 'PICKING',
    scheduledDate: new Date('2024-01-26'),
    totalAmount: 12200.00,
  },
  {
    id: '3',
    deliveryNumber: 'DEL-2024-003',
    customerName: 'Global Trading Co',
    status: 'DELIVERED_CONFIRMED',
    scheduledDate: new Date('2024-01-20'),
    deliveryDate: new Date('2024-01-20'),
    totalAmount: 9800.00,
  },
  {
    id: '4',
    deliveryNumber: 'DEL-2024-004',
    customerName: 'Premium Retailers',
    status: 'PACKED',
    scheduledDate: new Date('2024-01-27'),
    totalAmount: 15600.00,
  },
  {
    id: '5',
    deliveryNumber: 'DEL-2024-005',
    customerName: 'City Distributors',
    status: 'DISPATCHED',
    scheduledDate: new Date('2024-01-22'),
    totalAmount: 11200.00,
  },
  {
    id: '6',
    deliveryNumber: 'DEL-2024-006',
    customerName: 'Tech Solutions Sdn Bhd',
    status: 'CREATED',
    scheduledDate: new Date('2024-01-28'),
    totalAmount: 8900.00,
  },
  {
    id: '7',
    deliveryNumber: 'DEL-2024-007',
    customerName: 'Retail Plus Malaysia',
    status: 'DELIVERED_CONFIRMED',
    scheduledDate: new Date('2024-01-19'),
    deliveryDate: new Date('2024-01-19'),
    totalAmount: 13400.00,
  },
  {
    id: '8',
    deliveryNumber: 'DEL-2024-008',
    customerName: 'Global Trading Co',
    status: 'scheduled',
    scheduledDate: new Date('2024-01-29'),
    totalAmount: 16700.00,
  },
]

export interface DashboardData {
  stats: DashboardStats
  grns: GRN[]
  transferOrders: TransferOrder[]
  deliveries: Delivery[]
}

export async function getDashboardData(): Promise<DashboardData> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 300))
  
  return {
    stats: mockDashboardStats,
    grns: mockGRNs,
    transferOrders: mockTransferOrders,
    deliveries: mockDeliveries,
  }
}
