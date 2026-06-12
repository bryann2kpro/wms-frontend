import request from "graphql-request";
import { env } from "@/env";
import { getAccessToken } from "@/lib/auth/auth-storage";
import {
	CANCEL_RESERVATION_MUTATION,
	CREATE_RESERVATION_MUTATION,
	RESERVATIONS_QUERY,
	UPDATE_RESERVATION_MUTATION,
	type CancelReservationMutationData,
	type CancelReservationMutationVariables,
	type CreateReservationInput,
	type CreateReservationMutationData,
	type CreateReservationMutationVariables,
	type ReservationsQueryData,
	type ReservationsQueryVariables,
	type StockReservation,
	type UpdateReservationInput,
	type UpdateReservationMutationData,
	type UpdateReservationMutationVariables,
} from "@/lib/graphql/reservations";

const getAuthHeaders = (): Headers => {
	const headers = new Headers();
	const token = getAccessToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);
	return headers;
};

export async function fetchReservations(variables: ReservationsQueryVariables) {
	const data = await request<ReservationsQueryData, ReservationsQueryVariables>(
		env.VITE_GRAPHQL_ENDPOINT,
		RESERVATIONS_QUERY,
		variables,
		getAuthHeaders(),
	);
	return data.reservations;
}

export async function createReservation(
	input: CreateReservationInput,
): Promise<StockReservation> {
	const data = await request<
		CreateReservationMutationData,
		CreateReservationMutationVariables
	>(
		env.VITE_GRAPHQL_ENDPOINT,
		CREATE_RESERVATION_MUTATION,
		{ input },
		getAuthHeaders(),
	);
	return data.createReservation;
}

export async function updateReservation(
	id: string,
	input: UpdateReservationInput,
): Promise<StockReservation> {
	const data = await request<
		UpdateReservationMutationData,
		UpdateReservationMutationVariables
	>(
		env.VITE_GRAPHQL_ENDPOINT,
		UPDATE_RESERVATION_MUTATION,
		{ id, input },
		getAuthHeaders(),
	);
	return data.updateReservation;
}

export async function cancelReservation(id: string): Promise<StockReservation> {
	const data = await request<
		CancelReservationMutationData,
		CancelReservationMutationVariables
	>(
		env.VITE_GRAPHQL_ENDPOINT,
		CANCEL_RESERVATION_MUTATION,
		{ id },
		getAuthHeaders(),
	);
	return data.cancelReservation;
}
