import "dotenv/config";
import {
  CreateTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  BillingMode,
} from "@aws-sdk/client-dynamodb";
import { TABLES } from "../lib/db/schema";
import { extractAnchors } from "../lib/extract/anchors";
import { ALL_MESSAGES_FOR_EXTRACTION } from "../data/seed-chat";
import { ADVENTURE_MESSAGES_FOR_EXTRACTION } from "../data/seed-chat-adventure";
import { LUXURY_MESSAGES_FOR_EXTRACTION } from "../data/seed-chat-luxury";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const TABLE_DEFINITIONS = [
  {
    TableName: TABLES.GROUPS,
    KeySchema: [{ AttributeName: "groupId", KeyType: "HASH" as const }],
    AttributeDefinitions: [{ AttributeName: "groupId", AttributeType: "S" as const }],
  },
  {
    TableName: TABLES.MESSAGES,
    KeySchema: [
      { AttributeName: "groupId", KeyType: "HASH" as const },
      { AttributeName: "sortKey", KeyType: "RANGE" as const },
    ],
    AttributeDefinitions: [
      { AttributeName: "groupId", AttributeType: "S" as const },
      { AttributeName: "sortKey", AttributeType: "S" as const },
    ],
  },
  {
    TableName: TABLES.ANCHORS,
    KeySchema: [
      { AttributeName: "participantId", KeyType: "HASH" as const },
      { AttributeName: "extractedAt", KeyType: "RANGE" as const },
    ],
    AttributeDefinitions: [
      { AttributeName: "participantId", AttributeType: "S" as const },
      { AttributeName: "extractedAt", AttributeType: "S" as const },
    ],
  },
];

async function ensureTables(): Promise<void> {
  const { TableNames } = await client.send(new ListTablesCommand({}));
  const existing = new Set(TableNames ?? []);

  for (const def of TABLE_DEFINITIONS) {
    if (existing.has(def.TableName)) {
      console.log(`✓ Table exists: ${def.TableName}`);
      continue;
    }
    console.log(`  Creating table: ${def.TableName}`);
    await client.send(
      new CreateTableCommand({
        ...def,
        BillingMode: BillingMode.PAY_PER_REQUEST,
      }),
    );
    console.log(`✓ Created: ${def.TableName}`);
  }
}

async function seedGroupAnchors(
  groupName: string,
  messages: { participantId: string; participantName: string; text: string; timestamp: string }[],
): Promise<void> {
  console.log(`\nExtracting anchors for: ${groupName}`);
  const anchors = await extractAnchors(messages, true);
  console.log(`✓ ${anchors.length} anchors extracted:`);
  for (const a of anchors) {
    const entity = a.entityType === "vibe" ? `[vibe] ${a.vibeContext}` : `${a.entityType.replace("urn:entity:", "")} → ${a.entityId}`;
    console.log(`  ${a.participantName}: "${a.anchorText}" (${entity})`);
  }
}

async function seedAnchors(): Promise<void> {
  await seedGroupAnchors("The Usual Suspects", ALL_MESSAGES_FOR_EXTRACTION);
  await seedGroupAnchors("The Adventure Crew", ADVENTURE_MESSAGES_FOR_EXTRACTION);
  await seedGroupAnchors("The Luxury Minimalists", LUXURY_MESSAGES_FOR_EXTRACTION);
}

async function main(): Promise<void> {
  console.log("=== Palatable DB Seed ===\n");

  const required = ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  await ensureTables();
  await seedAnchors();

  console.log("\n✅ Seed complete");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
