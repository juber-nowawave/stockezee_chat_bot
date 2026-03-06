import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatBedrockConverse } from "@langchain/aws";

const modelInstances = new Map();

export const getModelInstance = (apiKey) => {
  if (!modelInstances.has(apiKey)) {
    modelInstances.set(
      apiKey,
      new ChatGoogleGenerativeAI({
        model: process.env.GOOGLE_MODEL || "gemini-2.5-flash",
        apiKey: apiKey,
        temperature: 0.1,
      })
    );
  }
  return modelInstances.get(apiKey);
};

export const getBedrockLangChainInstance = (apiKey) => {
  const key = `bedrock_${apiKey}`;

  if (!modelInstances.has(key)) {
    modelInstances.set(
      key,
      new ChatBedrockConverse({
        model: process.env.OPENAI_MODEL || "openai.gpt-oss-20b-1:0",
        region: process.env.AWS_REGION || "us-east-1",
        temperature: 0.1,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      })
    );
  }

  return modelInstances.get(key);
};