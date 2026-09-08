import { FeatureExtractionOutput } from "@huggingface/inference";
import { db } from "../db";
import { knw_sources, pknw_base } from "../db/schema";
import { eq, sql } from "drizzle-orm";

export const getRelevantDBRecords = async ({
	embedding,
	topK = 5,
}: {
	embedding: FeatureExtractionOutput;
	topK?: number;
}) => {
	try {
		const vectorParam = sql`vector32(${JSON.stringify(embedding)})`;
		const records = await db
			.select({
				document_title: knw_sources.title,
				link: knw_sources.link,
				description: knw_sources.description,
				id: knw_sources.id,
				content: pknw_base.content,
			})
			.from(sql`vector_top_k('embedding_idx', ${vectorParam}, ${topK}) as vt`)
			.innerJoin(pknw_base, sql`${pknw_base.id} = vt.id`)
			.innerJoin(knw_sources, eq(pknw_base.source, knw_sources.id));

		return records;
	} catch (e) {
		console.error("Something went wrong while fetching relevant DB records", e);
	}
};
