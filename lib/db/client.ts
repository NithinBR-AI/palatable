import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

function createClient(): DynamoDBDocumentClient {
  const region = process.env.DB_REGION;
  const accessKeyId = process.env.DB_ACCESS_KEY_ID;
  const secretAccessKey = process.env.DB_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("DB_REGION, DB_ACCESS_KEY_ID, and DB_SECRET_ACCESS_KEY must be set");
  }

  const base = new DynamoDBClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  return DynamoDBDocumentClient.from(base, {
    marshallOptions: { removeUndefinedValues: true },
    unmarshallOptions: { wrapNumbers: false },
  });
}

let _client: DynamoDBDocumentClient | null = null;

export function getDbClient(): DynamoDBDocumentClient {
  if (!_client) _client = createClient();
  return _client;
}
