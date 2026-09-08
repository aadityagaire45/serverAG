export interface WhatsAppWebhookBody {
	object?: string;
	entry?: Array<{
		id?: string;
		changes?: Array<{
			field?: string;
			value?: {
				messaging_product?: string;
				metadata?: {
					display_phone_number?: string;
					phone_number_id?: string;
				};
				contacts?: Array<{
					profile?: {
						name?: string;
					};
					wa_id?: string;
				}>;
				messages?: Array<{
					from: string;
					from_user_id?: string;
					id?: string;
					timestamp?: string;
					type?: string;
					text?: {
						body?: string;
					};
					interactive?: {
						type?: string;
						button_reply?: {
							id?: string;
							title?: string;
						};
						list_reply?: {
							id?: string;
							title?: string;
							description?: string;
						};
					};
					button?: {
						text?: string;
						payload?: string;
					};
				}>;
				statuses?: Array<{
					id?: string;
					status?: string;
					timestamp?: string;
					recipient_id?: string;
				}>;
			};
		}>;
	}>;
}

export type TEnv = {
	META_WP_API_VERIFICATION_TOKEN: string;
	ACCESS_TOKEN: string;
	HF_TOKEN: string;
	GOOGLE_GENERATIVE_AI_API_KEY: string;
};
