import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getRelevantDBRecords } from "./db";
import { generateText } from "ai";
import { SYSTEM_PROMPT } from "../llm-config";

const google = createGoogleGenerativeAI({
	apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
const model = google("gemini-3.5-flash-lite");

export const generateLLMResponse = async ({
	relevantRecords,
	userQuery,
}: {
	relevantRecords: Exclude<Awaited<ReturnType<typeof getRelevantDBRecords>>, undefined>;
	userQuery: string;
}) => {
	const formattedChunks = relevantRecords
		.map((record, index) =>
			` [chunk ${index + 1}]:
				content: ${record.content}
				document_title: ${record.document_title}
				document_description: ${record.description}
				document: ${record.link}
				`.trim(),
		)
		.join("\n--\n");

	try {
		const { text } = await generateText({
			model,
			system: SYSTEM_PROMPT.trim(),
			messages: [
				{
					role: "user",
					content: `
				REFERENCES:
				${formattedChunks}

				---

				USER QUERY:
				${userQuery}
			`.trim(),
				},
			],
		});
		return text;
	} catch (e) {
		console.log(e);
		console.error("Something went wrong while asking llm for answer");
	}
};
