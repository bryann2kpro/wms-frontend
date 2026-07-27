import { gql } from "graphql-request";
import type {
	Driver,
	DriverPaginatedResponse,
	CreateDriverInput,
	UpdateDriverInput,
} from "./types";

export const DRIVER_FRAGMENT = gql`
	fragment DriverFields on Driver {
		id
		name
		phone
		licenseNumber
		licenseExpiry
		status
		plateNumber
		vehicleType
		fleetCategory
		barcode
		clockedInAt
		email
		btm
		bdm
		payload
		length
		width
		height
		pallet4x3
		createdAt
		updatedAt
	}
`;

export const DRIVERS_QUERY = gql`
	query Drivers($filter: DriverFilterInput, $pageSize: Int, $pageNumber: Int) {
		drivers(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...DriverFields
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
	${DRIVER_FRAGMENT}
`;

export const CREATE_DRIVER_MUTATION = gql`
	mutation CreateDriver($input: CreateDriverInput!) {
		createDriver(input: $input) {
			...DriverFields
		}
	}
	${DRIVER_FRAGMENT}
`;

export const UPDATE_DRIVER_MUTATION = gql`
	mutation UpdateDriver($id: ID!, $input: UpdateDriverInput!) {
		updateDriver(id: $id, input: $input) {
			...DriverFields
		}
	}
	${DRIVER_FRAGMENT}
`;

export const DELETE_DRIVER_MUTATION = gql`
	mutation DeleteDriver($id: ID!) {
		deleteDriver(id: $id)
	}
`;

export const SET_DRIVER_CLOCK_MUTATION = gql`
	mutation SetDriverClock($id: ID!, $clockedIn: Boolean!) {
		setDriverClock(id: $id, clockedIn: $clockedIn) {
			...DriverFields
		}
	}
	${DRIVER_FRAGMENT}
`;

export type DriversQueryVariables = {
	filter?: {
		id?: string;
		name?: string;
		status?: string;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type DriversQueryData = {
	drivers: DriverPaginatedResponse;
};

export type CreateDriverMutationVariables = { input: CreateDriverInput };
export type CreateDriverMutationData = { createDriver: Driver };

export type UpdateDriverMutationVariables = {
	id: string;
	input: UpdateDriverInput;
};
export type UpdateDriverMutationData = { updateDriver: Driver | null };

export type DeleteDriverMutationVariables = { id: string };
export type DeleteDriverMutationData = { deleteDriver: boolean };

export type SetDriverClockMutationVariables = {
	id: string;
	clockedIn: boolean;
};
export type SetDriverClockMutationData = { setDriverClock: Driver };

export type { Driver };
