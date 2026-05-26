import { gql } from "graphql-request";
import type { Area, AreaPaginatedResponse } from "./types";

export const AREA_FRAGMENT = gql`
	fragment AreaFields on Area {
		areaId
		areaCode
		areaName
		areaDescription
		warehouseName
	}
`;

export const AREAS_QUERY = gql`
	query Areas($filter: AreaFilterInput, $pageSize: Int, $pageNumber: Int) {
		areas(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				...AreaFields
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
	${AREA_FRAGMENT}
`;

export type AreasQueryVariables = {
	filter?: {
		areaId?: string;
		areaCode?: string;
		areaName?: string;
		warehouseName?: string;
	};
	pageSize?: number;
	pageNumber?: number;
};

export type AreasQueryData = {
	areas: AreaPaginatedResponse;
};

export type { Area };
