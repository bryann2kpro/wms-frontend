/**
 * RBAC – GraphQL mutation documents for module operations
 */

import { gql } from "graphql-request";

export const CREATE_MODULE_MUTATION = gql`
	mutation CreateModule($input: CreateModuleInput!) {
		createModule(input: $input) {
			moduleId
			moduleName
			status
			createdAt
			updatedAt
			createdBy
			updatedBy
			permissions {
				permissionId
				moduleId
				permissionType
				status
			}
		}
	}
`;

export const UPDATE_MODULE_MUTATION = gql`
	mutation UpdateModule($id: ID!, $input: UpdateModuleInput!) {
		updateModule(id: $id, input: $input) {
			moduleId
			moduleName
			status
			createdAt
			updatedAt
			createdBy
			updatedBy
			permissions {
				permissionId
				moduleId
				permissionType
				status
			}
		}
	}
`;

// Input variable types
export type CreateModuleVariables = {
	input: {
		moduleName: string;
		status?: string;
		createdBy: string;
		updatedBy: string;
	};
};

export type UpdateModuleVariables = {
	id: string;
	input: {
		moduleName?: string;
		status?: string;
		updatedBy: string;
	};
};
