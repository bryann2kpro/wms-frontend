import { gql } from "graphql-request";
import type { Pagination } from "./types";

export type InventoryMovementType =
  | "INBOUND"
  | "SHIPMENT"
  | "ADJUSTMENT"
  | "DAMAGED"
  | "RESERVED";

export type InventoryMovement = {
  id: string;
  skuId: string;
  movementType: InventoryMovementType;
  quantity: string;
  balanceAfter: string;
  referenceNo: string | null;
  reason: string | null;
  lotNo: string | null;
  rackId: string | null;
  createdAt: string;
  createdBy: string;
  createdByUser: { id: string; displayName: string } | null;
};

export type InventoryMovementsQueryData = {
  inventoryMovements: {
    query: InventoryMovement[];
    pagination: Pagination;
  };
};

export type InventoryMovementsQueryVariables = {
  filter?: {
    skuId?: string;
    skuIds?: string[];
    movementType?: InventoryMovementType;
    movementTypes?: InventoryMovementType[];
    referenceNo?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  pageSize?: number;
  pageNumber?: number;
  sortBy?: string;
  sortOrder?: string;
};

export type MissingGrnMovement = {
  grnNo: string;
  grnItemId: string;
  qty: string;
  receivedAt: string | null;
};

export type MissingDoMovement = {
  poNo: string;
  doNo: string;
  doItemId: string;
  qtyRequired: string;
};

export type MissingAdjustmentMovement = {
  adjustmentNo: string;
  stockAdjustmentId: string;
  adjustmentItemId: string;
  quantity: string;
  movementType: InventoryMovementType;
};

export type SkuIntegrityCheckResult = {
  skuId: string;
  missingGrnMovements: MissingGrnMovement[];
  missingDoMovements: MissingDoMovement[];
  missingAdjustmentMovements: MissingAdjustmentMovement[];
  totalMissing: number;
};

export type SkuIntegrityCheckQueryData = {
  skuIntegrityCheck: SkuIntegrityCheckResult;
};

export type BackfillSkuMovementsResult = {
  skuId: string;
  backfilledCount: number;
  reconcileResult: ReconcileSkuBalanceResult;
};

export type BackfillSkuMovementsMutationData = {
  backfillSkuMovements: BackfillSkuMovementsResult;
};

export const SKU_INTEGRITY_CHECK_QUERY = gql`
  query SkuIntegrityCheck($skuId: ID!) {
    skuIntegrityCheck(skuId: $skuId) {
      skuId
      totalMissing
      missingGrnMovements {
        grnNo
        grnItemId
        qty
        receivedAt
      }
      missingDoMovements {
        poNo
        doNo
        doItemId
        qtyRequired
      }
      missingAdjustmentMovements {
        adjustmentNo
        stockAdjustmentId
        adjustmentItemId
        quantity
        movementType
      }
    }
  }
`;

export const BACKFILL_SKU_MOVEMENTS_MUTATION = gql`
  mutation BackfillSkuMovements($skuId: ID!) {
    backfillSkuMovements(skuId: $skuId) {
      skuId
      backfilledCount
      reconcileResult {
        movementsFixed
        finalOnHandQty
      }
    }
  }
`;

export type ReconcileSkuBalanceResult = {
  skuId: string;
  movementsFixed: number;
  finalOnHandQty: string;
  finalLossQty: string;
  finalReservedQty: string;
};

export type ReconcileSkuBalanceMutationData = {
  reconcileSkuBalance: ReconcileSkuBalanceResult;
};

export const RECONCILE_SKU_BALANCE_MUTATION = gql`
  mutation ReconcileSkuBalance($skuId: ID!) {
    reconcileSkuBalance(skuId: $skuId) {
      skuId
      movementsFixed
      finalOnHandQty
      finalLossQty
      finalReservedQty
    }
  }
`;

export const INVENTORY_MOVEMENTS_QUERY = gql`
  query InventoryMovements(
    $filter: InventoryMovementFilterInput
    $pageSize: Int
    $pageNumber: Int
    $sortBy: String
    $sortOrder: String
  ) {
    inventoryMovements(
      filter: $filter
      pageSize: $pageSize
      pageNumber: $pageNumber
      sortBy: $sortBy
      sortOrder: $sortOrder
    ) {
      pagination {
        count
        totalCount
        currentPage
        totalPages
        hasNextPage
        hasPrevPage
      }
      query {
        id
        skuId
        movementType
        quantity
        balanceAfter
        referenceNo
        reason
        lotNo
        rackId
        createdAt
        createdByUser {
          id
          displayName
        }
      }
    }
  }
`;
