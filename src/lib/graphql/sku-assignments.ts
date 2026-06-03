import { gql } from "graphql-request";
import type {
  SkuAssignment,
  SkuAssignmentPaginatedResponse,
  CreateSkuAssignmentInput,
  UpdateSkuAssignmentInput,
} from "./types";

const SKU_ASSIGNMENT_FIELDS = gql`
  fragment SkuAssignmentFields on SkuAssignment {
    id
    outlet {
      outletId
      outletName
      outletCode
      chain
      channel
      debtor
    }
    sku {
      skuId
      skuCode
      skuDescription
      brand
      category
      manufacturer
    }
    minExpiryMonth
    createdAt
    updatedAt
    createdBy
    updatedBy
  }
`;

export const SKU_ASSIGNMENTS_QUERY = gql`
  query SkuAssignments($pageSize: Int, $pageNumber: Int) {
    skuAssignments(pageSize: $pageSize, pageNumber: $pageNumber) {
      query {
        ...SkuAssignmentFields
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
  ${SKU_ASSIGNMENT_FIELDS}
`;

export const CREATE_SKU_ASSIGNMENT_MUTATION = gql`
  mutation CreateSkuAssignment($input: CreateSkuAssignmentInput!) {
    createSkuAssignment(input: $input) {
      ...SkuAssignmentFields
    }
  }
  ${SKU_ASSIGNMENT_FIELDS}
`;

export const UPDATE_SKU_ASSIGNMENT_MUTATION = gql`
  mutation UpdateSkuAssignment($id: ID!, $input: UpdateSkuAssignmentInput!) {
    updateSkuAssignment(id: $id, input: $input) {
      ...SkuAssignmentFields
    }
  }
  ${SKU_ASSIGNMENT_FIELDS}
`;

export const DELETE_SKU_ASSIGNMENT_MUTATION = gql`
  mutation DeleteSkuAssignment($id: ID!) {
    deleteSkuAssignment(id: $id)
  }
`;

export type SkuAssignmentsQueryData = { skuAssignments: SkuAssignmentPaginatedResponse };
export type SkuAssignmentsQueryVariables = { pageSize?: number; pageNumber?: number };

export type CreateSkuAssignmentMutationData = { createSkuAssignment: SkuAssignment };
export type CreateSkuAssignmentMutationVariables = { input: CreateSkuAssignmentInput };

export type UpdateSkuAssignmentMutationData = { updateSkuAssignment: SkuAssignment };
export type UpdateSkuAssignmentMutationVariables = { id: string; input: UpdateSkuAssignmentInput };

export type DeleteSkuAssignmentMutationData = { deleteSkuAssignment: boolean };
export type DeleteSkuAssignmentMutationVariables = { id: string };
