import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDbClient } from "./client";
import { TABLES, type AnchorRecord, type AnchorStatus } from "./schema";

export async function putAnchor(anchor: AnchorRecord): Promise<void> {
  await getDbClient().send(
    new PutCommand({ TableName: TABLES.ANCHORS, Item: anchor }),
  );
}

export async function getActiveAnchors(participantId: string): Promise<AnchorRecord[]> {
  const result = await getDbClient().send(
    new QueryCommand({
      TableName: TABLES.ANCHORS,
      KeyConditionExpression: "participantId = :pid",
      FilterExpression: "#st = :active AND confidence >= :floor",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: {
        ":pid": participantId,
        ":active": "active" satisfies AnchorStatus,
        ":floor": 0.6,
      },
    }),
  );
  return (result.Items ?? []) as AnchorRecord[];
}

export async function getAllAnchorsForParticipants(
  participantIds: string[],
): Promise<AnchorRecord[]> {
  const results = await Promise.all(participantIds.map(getActiveAnchors));
  return results.flat();
}

export async function reinforceAnchor(
  participantId: string,
  extractedAt: string,
  now: string,
): Promise<void> {
  await getDbClient().send(
    new UpdateCommand({
      TableName: TABLES.ANCHORS,
      Key: { participantId, extractedAt },
      UpdateExpression:
        "SET confidence = if_not_exists(confidence, :base) + :bump, lastReinforced = :now, lastSeen = :now",
      ConditionExpression: "attribute_exists(participantId)",
      ExpressionAttributeValues: { ":bump": 0.1, ":base": 0.5, ":now": now },
    }),
  );
}

export async function deprecateAnchor(
  participantId: string,
  extractedAt: string,
  now: string,
): Promise<void> {
  await getDbClient().send(
    new UpdateCommand({
      TableName: TABLES.ANCHORS,
      Key: { participantId, extractedAt },
      UpdateExpression: "SET #st = :deprecated, lastSeen = :now",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: {
        ":deprecated": "deprecated" satisfies AnchorStatus,
        ":now": now,
      },
    }),
  );
}

export async function contradictAnchor(
  participantId: string,
  extractedAt: string,
  now: string,
): Promise<void> {
  await getDbClient().send(
    new UpdateCommand({
      TableName: TABLES.ANCHORS,
      Key: { participantId, extractedAt },
      UpdateExpression:
        "SET #st = :contradicted, confidence = :low, lastSeen = :now",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: {
        ":contradicted": "contradicted" satisfies AnchorStatus,
        ":low": 0.1,
        ":now": now,
      },
    }),
  );
}
