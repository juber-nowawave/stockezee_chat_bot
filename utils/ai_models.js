import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
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
