import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
const modelInstances = new Map();

export const getModelInstance = (apiKey) => {
  if (!modelInstances.has(apiKey)) {
    modelInstances.set(apiKey, new ChatGoogleGenerativeAI({
      model: process.env.GOOGLE_MODEL || "gemini-2.5-flash",
      apiKey: apiKey,
      temperature: 0.1,
    }));
  }
  return modelInstances.get(apiKey);
};

export const getBedrockLangChainInstance = (apiKey) => {
  if (!modelInstances.has(`langchain_${apiKey}`)) {
    modelInstances.set(`langchain_${apiKey}`, new ChatOpenAI({
      model: process.env.OPENAI_MODEL || "openai.gpt-oss-20b-1:0",
      apiKey: apiKey,
      configuration: {
        baseURL: process.env.BEDROCK_ENDPOINT,
      },
      temperature: 0.1,
    }));
  }
  return modelInstances.get(`langchain_${apiKey}`);
};