import { gql } from "graphql-request";

export const AUDIT_LOGS_QUERY = gql`
	query AuditLogs(
		$filter: AuditLogFilterInput
		$pageSize: Int
		$pageNumber: Int
	) {
		auditLogs(filter: $filter, pageSize: $pageSize, pageNumber: $pageNumber) {
			query {
				auditLogId
				userId
				action
				entity
				entityId
				oldData
				newData
				ipAddress
				userAgent
				createdAt
				userName
				role
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
`;

export interface AuditLog {
	auditLogId: string;
	userId: string;
	action: string;
	entity: string;
	entityId: string;
	oldData: Record<string, unknown> | null;
	newData: Record<string, unknown> | null;
	ipAddress: string;
	userAgent: string;
	createdAt: string;
	userName?: string;
	role?: string;
}

export interface AuditLogPaginatedResponse {
	query: AuditLog[];
	pagination: {
		count: number;
		totalCount: number;
		currentPage: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPrevPage: boolean;
	};
}

export interface AuditLogFilterInput {
	userId?: string;
	action?: string;
	entity?: string;
	entityId?: string;
	dateFrom?: string;
	dateTo?: string;
}

export interface AuditLogsQueryVariables {
	filter?: AuditLogFilterInput;
	pageSize?: number;
	pageNumber?: number;
}

export type AuditLogsQueryData = {
	auditLogs: AuditLogPaginatedResponse;
};

export const AUDIT_LOG_FILTERS_QUERY = gql`
	query AuditLogFilters {
		auditLogActions
		auditLogEntities
	}
`;

export type AuditLogFiltersQueryData = {
	auditLogActions: string[];
	auditLogEntities: string[];
};
