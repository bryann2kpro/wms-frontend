import { gql } from "graphql-request";
import type { LoadBatch } from "./types";
import { DRIVER_FRAGMENT } from "./drivers";

export const LOAD_BATCH_FRAGMENT = gql`
	fragment LoadBatchFields on LoadBatch {
		id
		date
		regionId
		regionName
		regionCode
		status
		assignedAt
		createdAt
		driver {
			...DriverFields
		}
		stops {
			doId
			doNo
			outletId
			outletName
			outletAddress
			stagingBin
			loadOrder
			loadedAt
		}
	}
	${DRIVER_FRAGMENT}
`;

export const LOAD_BATCHES_QUERY = gql`
	query LoadBatches($date: String) {
		loadBatches(date: $date) {
			...LoadBatchFields
		}
	}
	${LOAD_BATCH_FRAGMENT}
`;

export const ASSIGN_BATCH_DRIVER_MUTATION = gql`
	mutation AssignBatchDriver($batchId: ID!, $driverId: ID!) {
		assignBatchDriver(batchId: $batchId, driverId: $driverId) {
			...LoadBatchFields
		}
	}
	${LOAD_BATCH_FRAGMENT}
`;

export const UNASSIGN_BATCH_DRIVER_MUTATION = gql`
	mutation UnassignBatchDriver($batchId: ID!) {
		unassignBatchDriver(batchId: $batchId) {
			...LoadBatchFields
		}
	}
	${LOAD_BATCH_FRAGMENT}
`;

export const CONFIRM_BATCH_LOADING_MUTATION = gql`
	mutation ConfirmBatchLoading($batchId: ID!, $loadedDoIds: [ID!]!) {
		confirmBatchLoading(batchId: $batchId, loadedDoIds: $loadedDoIds)
	}
`;

export const COMPLETE_BATCH_MUTATION = gql`
	mutation CompleteBatch($batchId: ID!) {
		completeBatch(batchId: $batchId)
	}
`;

export const UNDO_LOAD_BATCH_MUTATION = gql`
	mutation UndoLoadBatch($batchId: ID!) {
		undoLoadBatch(batchId: $batchId)
	}
`;

export type LoadBatchesQueryVariables = {
	date?: string;
};

export type LoadBatchesQueryData = {
	loadBatches: LoadBatch[];
};

export type AssignBatchDriverVariables = { batchId: string; driverId: string };
export type AssignBatchDriverData = { assignBatchDriver: LoadBatch };

export type UnassignBatchDriverVariables = { batchId: string };
export type UnassignBatchDriverData = { unassignBatchDriver: LoadBatch };

export type ConfirmBatchLoadingVariables = { batchId: string; loadedDoIds: string[] };
export type ConfirmBatchLoadingData = { confirmBatchLoading: boolean };

export type CompleteBatchVariables = { batchId: string };
export type CompleteBatchData = { completeBatch: boolean };

export type UndoLoadBatchVariables = { batchId: string };
export type UndoLoadBatchData = { undoLoadBatch: boolean };

export type { LoadBatch };
