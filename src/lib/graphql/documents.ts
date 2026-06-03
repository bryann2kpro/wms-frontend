import { gql } from "graphql-request";

export const GENERATE_DELIVERY_ORDER_PDF_MUTATION = gql`
	mutation GenerateDeliveryOrderPdf($deliveryOrderId: ID!) {
		generateDeliveryOrderPdf(deliveryOrderId: $deliveryOrderId) {
			s3Url
		}
	}
`;

export type GenerateDeliveryOrderPdfMutationVariables = {
	deliveryOrderId: string;
};

export type GenerateDeliveryOrderPdfMutationData = {
	generateDeliveryOrderPdf: {
		s3Url: string;
	};
};

export const BULK_GENERATE_DELIVERY_ORDERS_PDF_MUTATION = gql`
	mutation BulkGenerateDeliveryOrdersPdf($deliveryOrderIds: [ID!]!) {
		bulkGenerateDeliveryOrdersPdf(deliveryOrderIds: $deliveryOrderIds) {
			jobId
		}
	}
`;

export type BulkGenerateDeliveryOrdersPdfVariables = {
	deliveryOrderIds: string[];
};

export type BulkGenerateDeliveryOrdersPdfData = {
	bulkGenerateDeliveryOrdersPdf: { jobId: string };
};
