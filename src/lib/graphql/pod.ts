import { gql } from "graphql-request";
import type { PodRecord } from "./types";

export const POD_RECORD_FRAGMENT = gql`
	fragment PodRecordFields on PodRecord {
		id
		doId
		doNo
		outletName
		driverId
		driverName
		photoUrl
		capturedAt
		lat
		lng
		createdAt
	}
`;

export const POD_RECORDS_QUERY = gql`
	query PodRecords($doId: ID) {
		podRecords(doId: $doId) {
			...PodRecordFields
		}
	}
	${POD_RECORD_FRAGMENT}
`;

export type PodRecordsQueryVariables = {
	doId?: string;
};

export type PodRecordsQueryData = {
	podRecords: PodRecord[];
};

export type { PodRecord };
