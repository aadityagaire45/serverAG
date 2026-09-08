import { env } from "hono/adapter";
import { Context } from "hono";
import { TEnv, WhatsAppWebhookBody } from "../types";
import { sendFinalResponse, sendTypingIndicator } from "./wp";
import { Embedder } from "./embedder";
import { getRelevantDBRecords } from "./db";
import { generateLLMResponse } from "./llm";

export const verifyWebhook = (c: Context) => {
	// verification token sent by wp api
	const verificationToken = c.req.query("hub.verify_token");
	const challenge = c.req.query("hub.challenge");
	const mode = c.req.query("hub.mode");

	const { META_WP_API_VERIFICATION_TOKEN: server_verification_token } = env<TEnv>(c);

	switch (true) {
		case !server_verification_token: {
			return c.text("Server Env not found", 500);
		}
		case !verificationToken: {
			return c.text("Meta did not send verification token", 400);
		}
		case !challenge: {
			return c.text("Meta did not send any challenge", 400);
		}
		case mode !== "subscribe": {
			return c.text("Invaild mode provided", 400);
		}
		case verificationToken === server_verification_token: {
			return c.text(challenge, 200);
		}
		default: {
			return c.text("Invalid verification token", 401);
		}
	}
};

export const processUserQuery = async (c: Context) => {
	try {
		const { userQuery, messageId, phoneNumberId, fromNumber } = await extractUserQuery(c);

		if (!userQuery || !messageId || !phoneNumberId || !fromNumber) {
			return c.text("No query content found", 200);
		}

		const json = await c.req.json();
		console.log(JSON.stringify(json, null, 2));

		c.executionCtx.waitUntil(
			(async () => {
				sendTypingIndicator({ c, messageId, phoneNumberId });

				const userQueryEmbedding = await new Embedder().embed(userQuery);
				if (!userQueryEmbedding) return c.text("Error while generating embedding", 500);

				// might wanna change the loading text here if possible.
				const relevantRecords =
					(await getRelevantDBRecords({
						embedding: userQueryEmbedding,
					})) ?? [];

				// might wanna change the loading text here if possible.
				const llmResponse = await generateLLMResponse({ relevantRecords, userQuery });

				if (!llmResponse)
					return c.text("Something went wrong while generating response from llm", 500);

				await sendFinalResponse({
					messageId,
					phoneNumberId,
					finalResponse: llmResponse,
					phoneNumber: fromNumber,
					c,
				});

				return c.json(
					{
						phoneNumberId,
						userQuery,
					},
					200,
				);
			})(),
		);

		return c.text("EVENT_RECEIVED", 200);
	} catch (error) {
		console.error("Error handling WhatsApp webhook:", error);
		return c.text("Internal Server Error", 500);
	}
};

const extractUserQuery = async (
	c: Context,
): Promise<{
	messageId?: string;
	fromNumber?: string;
	phoneNumberId?: string;
	userQuery: string | null;
}> => {
	const body = await c.req.json<WhatsAppWebhookBody>();

	if (body.object !== "whatsapp_business_account") {
		throw new Error("Not a WhatsApp API event");
	}

	const entry = body.entry?.[0];
	const change = entry?.changes?.[0];
	const value = change?.value;
	const message = value?.messages?.[0];

	// Meta sends status updates (sent, delivered, read) as webhooks without a message object
	if (!message) {
		c.text("EVENT_RECEIVED", 200);
		return {
			userQuery: null,
		};
	}

	const messageId = message.id;
	const fromNumber = message.from!;
	const phoneNumberId = value?.metadata?.phone_number_id;

	// Extract user query based on message type
	let userQuery = "";
	if (message.type === "text" && message.text?.body) {
		userQuery = message.text.body.trim();
	} else if (message.type === "interactive") {
		userQuery =
			message.interactive?.button_reply?.title?.trim() ||
			message.interactive?.list_reply?.title?.trim() ||
			"";
	} else if (message.type === "button" && message.button?.text) {
		userQuery = message.button.text.trim();
	}
	if (!userQuery) return { userQuery: null };

	return {
		userQuery,
		fromNumber,
		phoneNumberId,
		messageId,
	};
};
