import { gql } from "graphql-request";

export const WHATSAPP_STATUS_QUERY = gql`
	query WhatsAppStatus {
		whatsAppStatus {
			status
			connectedPhone
			lastQr
		}
	}
`;

export const WHATSAPP_SETTINGS_QUERY = gql`
	query WhatsAppSettings($settingKey: String!) {
		whatsAppSettings(settingKey: $settingKey) {
			settingKey
			toPhones
			updatedAt
		}
	}
`;

export const UPDATE_WHATSAPP_SETTINGS_MUTATION = gql`
	mutation UpdateWhatsAppSettings($settingKey: String!, $toPhones: [String!]!) {
		updateWhatsAppSettings(settingKey: $settingKey, toPhones: $toPhones) {
			settingKey
			toPhones
			updatedAt
		}
	}
`;

export const RESET_WHATSAPP_SESSION_MUTATION = gql`
	mutation ResetWhatsAppSession {
		resetWhatsAppSession {
			status
			connectedPhone
			lastQr
		}
	}
`;

export type WhatsAppStatus = {
	status: "initializing" | "qr_needed" | "ready" | "disconnected";
	connectedPhone: string | null;
	lastQr: string | null;
};

export type WhatsAppSettings = {
	settingKey: string;
	toPhones: string[];
	updatedAt: string;
};

export type WhatsAppStatusQueryData = {
	whatsAppStatus: WhatsAppStatus;
};

export type WhatsAppSettingsQueryVariables = {
	settingKey: string;
};

export type WhatsAppSettingsQueryData = {
	whatsAppSettings: WhatsAppSettings | null;
};

export type UpdateWhatsAppSettingsMutationVariables = {
	settingKey: string;
	toPhones: string[];
};

export type UpdateWhatsAppSettingsMutationData = {
	updateWhatsAppSettings: WhatsAppSettings;
};

export type ResetWhatsAppSessionMutationData = {
	resetWhatsAppSession: WhatsAppStatus;
};

