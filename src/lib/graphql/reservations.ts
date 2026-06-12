import { gql } from "graphql-request";
import type { Pagination } from "./types";

export const STOCK_RESERVATION_FRAGMENT = gql`
	fragment StockReservationFields on StockReservation {
		id
		organizationId
		reservationNo
		customerCode
		skuId
		grnItemId
		inventoryBalanceId
		qtyReserved
		qtyConsumed
		reserveStart
		reserveEnd
		priorityFlag
		status
		sourceType
		sourceId
		notes
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const RESERVATIONS_QUERY = gql`
	query Reservations(
		$filter: StockReservationFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		reservations(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...StockReservationFields
			}
			pagination {
				count
				totalCount
				currentPage
				totalPages
				hasNextPage
				hasPrevPage
			}
		}
	}
	${STOCK_RESERVATION_FRAGMENT}
`;

export const RESERVATION_QUERY = gql`
	query Reservation($id: ID!) {
		reservation(id: $id) {
			...StockReservationFields
		}
	}
	${STOCK_RESERVATION_FRAGMENT}
`;

export const CREATE_RESERVATION_MUTATION = gql`
	mutation CreateReservation($input: CreateReservationInput!) {
		createReservation(input: $input) {
			...StockReservationFields
		}
	}
	${STOCK_RESERVATION_FRAGMENT}
`;

export const UPDATE_RESERVATION_MUTATION = gql`
	mutation UpdateReservation($id: ID!, $input: UpdateReservationInput!) {
		updateReservation(id: $id, input: $input) {
			...StockReservationFields
		}
	}
	${STOCK_RESERVATION_FRAGMENT}
`;

export const CANCEL_RESERVATION_MUTATION = gql`
	mutation CancelReservation($id: ID!) {
		cancelReservation(id: $id) {
			...StockReservationFields
		}
	}
	${STOCK_RESERVATION_FRAGMENT}
`;

export interface StockReservation {
	id: string;
	organizationId: string;
	reservationNo: string;
	customerCode: string;
	skuId: string;
	grnItemId?: string | null;
	inventoryBalanceId: string;
	qtyReserved: string;
	qtyConsumed: string;
	reserveStart: string;
	reserveEnd: string;
	priorityFlag: boolean;
	status: string;
	sourceType?: string | null;
	sourceId?: string | null;
	notes?: string | null;
	createdAt: string;
	updatedAt: string;
	createdBy: string;
	updatedBy?: string | null;
}

export interface StockReservationPaginatedResponse {
	query: StockReservation[];
	pagination: Pagination;
}

export type StockReservationFilterInput = {
	status?: string;
	statuses?: string[];
	customerCode?: string;
	customerCodes?: string[];
	skuId?: string;
	skuIds?: string[];
};

export type ReservationsQueryVariables = {
	filter?: StockReservationFilterInput;
	pageSize?: number;
	pageNumber?: number;
};

export type ReservationsQueryData = {
	reservations: StockReservationPaginatedResponse;
};

export type CreateReservationInput = {
	customerCode: string;
	skuId: string;
	grnItemId?: string | null;
	qtyReserved: number;
	reserveStart: string;
	reserveEnd: string;
	priorityFlag?: boolean;
	sourceType?: string | null;
	sourceId?: string | null;
	notes?: string | null;
};

export type UpdateReservationInput = {
	qtyReserved?: number;
	reserveStart?: string;
	reserveEnd?: string;
	priorityFlag?: boolean;
	customerCode?: string;
	grnItemId?: string | null;
	notes?: string | null;
};

export type CreateReservationMutationVariables = { input: CreateReservationInput };
export type CreateReservationMutationData = { createReservation: StockReservation };

export type UpdateReservationMutationVariables = {
	id: string;
	input: UpdateReservationInput;
};
export type UpdateReservationMutationData = { updateReservation: StockReservation };

export type CancelReservationMutationVariables = { id: string };
export type CancelReservationMutationData = { cancelReservation: StockReservation };
