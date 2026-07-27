import { gql } from "graphql-request";
import type { Driver, CreateDriverInput, UpdateDriverInput } from "./types";

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
	query Drivers($status: String) {
		drivers(status: $status) {
			...DriverFields
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
	mutation SetDriverClock($driverId: ID!, $action: String!) {
		setDriverClock(driverId: $driverId, action: $action) {
			...DriverFields
		}
	}
	${DRIVER_FRAGMENT}
`;

export type DriversQueryVariables = {
	status?: string;
};

export type DriversQueryData = {
	drivers: Driver[];
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
	driverId: string;
	action: "IN" | "OUT";
};
export type SetDriverClockMutationData = { setDriverClock: Driver };

export type { Driver };
