import { gql } from "graphql-request";
import type {
  PalletLabel,
  PalletLabelPaginatedResponse,
  CreatePalletLabelInput,
  UpdatePalletLabelInput,
} from "./types";

export const PALLET_LABEL_FRAGMENT = gql`
  fragment PalletLabelFields on PalletLabel {
    id
    itemCode
    barCode
    referenceNo
    storageBinId
    storageBinCode
    labelCode
    description
    itemDesc02
    printedCount
    firstPrintedAt
    lastPrintedAt
    isActive
    isDeleted
    deletedAt
    version
    createdAt
    updatedAt
    createdBy
    updatedBy
  }
`;

export const PALLET_LABELS_QUERY = gql`
  query PalletLabels(
    $filter: PalletLabelFilterInput
    $sort: StorageBinItemSortInput
    $pageSize: Int
    $pageNumber: Int
  ) {
    palletLabels(filter: $filter, sort: $sort, pageSize: $pageSize, pageNumber: $pageNumber) {
      query {
        ...PalletLabelFields
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
  ${PALLET_LABEL_FRAGMENT}
`;

export const CREATE_PALLET_LABEL_MUTATION = gql`
  mutation CreatePalletLabel($input: CreatePalletLabelInput!) {
    createPalletLabel(input: $input) {
      ...PalletLabelFields
    }
  }
  ${PALLET_LABEL_FRAGMENT}
`;

export const UPDATE_PALLET_LABEL_MUTATION = gql`
  mutation UpdatePalletLabel($id: ID!, $input: UpdatePalletLabelInput!) {
    updatePalletLabel(id: $id, input: $input) {
      ...PalletLabelFields
    }
  }
  ${PALLET_LABEL_FRAGMENT}
`;

export const DELETE_PALLET_LABEL_MUTATION = gql`
  mutation DeletePalletLabel($id: ID!, $updatedBy: String!) {
    deletePalletLabel(id: $id, updatedBy: $updatedBy)
  }
`;

export const DELETE_PALLET_LABELS_MUTATION = gql`
  mutation DeletePalletLabels($ids: [ID!]!, $updatedBy: String!) {
    deletePalletLabels(ids: $ids, updatedBy: $updatedBy) {
      requestedCount
      deletedCount
      failedIds
    }
  }
`;

export type PalletLabelsQueryVariables = {
  filter?: {
    id?: string;
    storageBinId?: string;
    search?: string;
    labelCode?: string;
    itemCode?: string;
    barCode?: string;
    referenceNo?: string;
    description?: string;
    itemDesc02?: string;
    includeDeleted?: boolean;
  };
  sort?: {
    sortBy?: "STORAGE_BIN" | "ITEM_CODE" | "DESCRIPTION" | "ITEM_DESC_02" | "UPDATED_AT" | "CREATED_AT";
    direction?: "ASC" | "DESC";
  };
  pageSize?: number;
  pageNumber?: number;
};

export type PalletLabelsQueryData = {
  palletLabels: PalletLabelPaginatedResponse;
};

export type CreatePalletLabelMutationVariables = { input: CreatePalletLabelInput };
export type CreatePalletLabelMutationData = { createPalletLabel: PalletLabel };

export type UpdatePalletLabelMutationVariables = {
  id: string;
  input: UpdatePalletLabelInput;
};
export type UpdatePalletLabelMutationData = { updatePalletLabel: PalletLabel | null };

export type DeletePalletLabelMutationVariables = { id: string; updatedBy: string };
export type DeletePalletLabelMutationData = { deletePalletLabel: boolean };

export type DeletePalletLabelsMutationVariables = { ids: string[]; updatedBy: string };
export type DeletePalletLabelsMutationData = {
  deletePalletLabels: {
    requestedCount: number;
    deletedCount: number;
    failedIds: string[];
  };
};
