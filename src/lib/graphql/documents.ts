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
