import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateInventoryReport(products: any[]) {
  const prompt = `Analyze the following inventory data and provide a brief summary of stock health, identifying critical items that need reordering and any trends you notice:
  ${JSON.stringify(products)}
  
  Format the response as a professional executive summary.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text;
}
