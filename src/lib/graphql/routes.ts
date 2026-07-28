import { gql } from "graphql-request";
import type { TmsRoute, CreateTmsRouteInput, UpdateTmsRouteInput } from "./types";

export const TMS_ROUTE_FRAGMENT = gql`
	fragment TmsRouteFields on TmsRoute {
		id
		name
		origin
		destination
		distanceKm
		estimatedDurationMins
		status
		createdAt
		updatedAt
	}
`;

export const TMS_ROUTES_QUERY = gql`
	query TmsRoutes {
		tmsRoutes {
			...TmsRouteFields
		}
	}
	${TMS_ROUTE_FRAGMENT}
`;

export const CREATE_TMS_ROUTE_MUTATION = gql`
	mutation CreateTmsRoute($input: CreateTmsRouteInput!) {
		createTmsRoute(input: $input) {
			...TmsRouteFields
		}
	}
	${TMS_ROUTE_FRAGMENT}
`;

export const UPDATE_TMS_ROUTE_MUTATION = gql`
	mutation UpdateTmsRoute($id: ID!, $input: UpdateTmsRouteInput!) {
		updateTmsRoute(id: $id, input: $input) {
			...TmsRouteFields
		}
	}
	${TMS_ROUTE_FRAGMENT}
`;

export const DELETE_TMS_ROUTE_MUTATION = gql`
	mutation DeleteTmsRoute($id: ID!) {
		deleteTmsRoute(id: $id)
	}
`;

export type TmsRoutesQueryData = { tmsRoutes: TmsRoute[] };

export type CreateTmsRouteVariables = { input: CreateTmsRouteInput };
export type CreateTmsRouteData = { createTmsRoute: TmsRoute };

export type UpdateTmsRouteVariables = { id: string; input: UpdateTmsRouteInput };
export type UpdateTmsRouteData = { updateTmsRoute: TmsRoute | null };

export type DeleteTmsRouteVariables = { id: string };
export type DeleteTmsRouteData = { deleteTmsRoute: boolean };

export type { TmsRoute };
