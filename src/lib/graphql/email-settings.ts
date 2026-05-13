import { gql } from "graphql-request";

export const EMAIL_NOTIFICATION_SETTINGS_QUERY = gql`
	query EmailNotificationSettings($settingKey: String!) {
		emailNotificationSettings(settingKey: $settingKey) {
			settingKey
			toEmails
			ccEmails
			updatedAt
		}
	}
`;

export const UPDATE_EMAIL_NOTIFICATION_SETTINGS_MUTATION = gql`
	mutation UpdateEmailNotificationSettings(
		$settingKey: String!
		$input: UpdateEmailNotificationSettingsInput!
	) {
		updateEmailNotificationSettings(settingKey: $settingKey, input: $input) {
			settingKey
			toEmails
			ccEmails
			updatedAt
		}
	}
`;

export const ADVANCE_NOTICE_SETTING_KEY = "ADVANCE_NOTICE_RECEIVED";

export type EmailNotificationSettings = {
	settingKey: string;
	toEmails: string[];
	ccEmails: string[];
	updatedAt: string;
};

export type EmailNotificationSettingsQueryVariables = {
	settingKey: string;
};

export type EmailNotificationSettingsQueryData = {
	emailNotificationSettings: EmailNotificationSettings | null;
};

export type UpdateEmailNotificationSettingsMutationVariables = {
	settingKey: string;
	input: { toEmails: string[]; ccEmails: string[] };
};

export type UpdateEmailNotificationSettingsMutationData = {
	updateEmailNotificationSettings: EmailNotificationSettings;
};
