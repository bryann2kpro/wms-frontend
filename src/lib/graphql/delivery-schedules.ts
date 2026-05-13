import { gql } from "graphql-request";
import type {
	DeliverySchedule,
	DeliverySchedulePaginatedResponse,
	CreateDeliveryScheduleInput,
	UpdateDeliveryScheduleInput,
} from "./types";

export const DELIVERY_SCHEDULE_FRAGMENT = gql`
	fragment DeliveryScheduleFields on DeliverySchedule {
		scheduleId
		regionId
		regionName
		regionCode
		dayOfWeek
		dayName
		cutoffDaysBefore
		cutoffTime
		isActive
		createdAt
		updatedAt
		createdBy
		updatedBy
	}
`;

export const DELIVERY_SCHEDULES_QUERY = gql`
	query DeliverySchedules(
		$filter: DeliveryScheduleFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		deliverySchedules(
			filter: $filter
			pageSize: $pageSize
			pageNumber: $pageNumber
		) {
			query {
				...DeliveryScheduleFields
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
	${DELIVERY_SCHEDULE_FRAGMENT}
`;

export const CREATE_DELIVERY_SCHEDULE_MUTATION = gql`
	mutation CreateDeliverySchedule($input: CreateDeliveryScheduleInput!) {
		createDeliverySchedule(input: $input) {
			...DeliveryScheduleFields
		}
	}
	${DELIVERY_SCHEDULE_FRAGMENT}
`;

export const UPDATE_DELIVERY_SCHEDULE_MUTATION = gql`
	mutation UpdateDeliverySchedule($id: ID!, $input: UpdateDeliveryScheduleInput!) {
		updateDeliverySchedule(id: $id, input: $input) {
			...DeliveryScheduleFields
		}
	}
	${DELIVERY_SCHEDULE_FRAGMENT}
`;

export const TOGGLE_DELIVERY_SCHEDULE_ACTIVE_MUTATION = gql`
	mutation ToggleDeliveryScheduleActive(
		$id: ID!
		$isActive: Boolean!
		$updatedBy: String!
	) {
		toggleDeliveryScheduleActive(id: $id, isActive: $isActive, updatedBy: $updatedBy) {
			...DeliveryScheduleFields
		}
	}
	${DELIVERY_SCHEDULE_FRAGMENT}
`;

export const DELETE_DELIVERY_SCHEDULE_MUTATION = gql`
	mutation DeleteDeliverySchedule($id: ID!) {
		deleteDeliverySchedule(id: $id)
	}
`;

export type DeliverySchedulesQueryVariables = {
	filter?: {
		scheduleId?: string;
		scheduleIds?: string[];
		regionId?: string;
		regionIds?: string[];
		dayOfWeek?: number;
		daysOfWeek?: number[];
		isActive?: boolean;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type DeliverySchedulesQueryData = {
	deliverySchedules: DeliverySchedulePaginatedResponse;
};

export type CreateDeliveryScheduleMutationVariables = {
	input: CreateDeliveryScheduleInput;
};
export type CreateDeliveryScheduleMutationData = {
	createDeliverySchedule: DeliverySchedule;
};

export type UpdateDeliveryScheduleMutationVariables = {
	id: string;
	input: UpdateDeliveryScheduleInput;
};
export type UpdateDeliveryScheduleMutationData = {
	updateDeliverySchedule: DeliverySchedule | null;
};

export type ToggleDeliveryScheduleActiveMutationVariables = {
	id: string;
	isActive: boolean;
	updatedBy: string;
};
export type ToggleDeliveryScheduleActiveMutationData = {
	toggleDeliveryScheduleActive: DeliverySchedule | null;
};

export type DeleteDeliveryScheduleMutationVariables = { id: string };
export type DeleteDeliveryScheduleMutationData = {
	deleteDeliverySchedule: boolean;
};
