import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function chatWithGemini(prompt: string, history: { role: string; parts: { text: string }[] }[] = [], modelName: string = "Gemini") {
  try {
    const personas: Record<string, string> = {
      Gemini: "당신은 Google의 Gemini입니다. 친절하고 신속하게 답변하세요.",
      ChatGPT: "당신은 OpenAI의 ChatGPT입니다. 논리적이고 명확하게 답변하세요.",
      Claude: "당신은 Anthropic의 Claude입니다. 창의적이고 상세하게 답변하세요.",
    };

    const systemInstruction = `당신은 'MODU AI' 통합 플랫폼 내의 ${modelName} 엔진입니다.
${personas[modelName] || personas.Gemini}

현재 플랫폼은 다음 4가지 핵심 모드를 지원합니다:
1. 대화 모드: 일상적인 대화 및 일반 지식 답변.
2. 문제 풀이 모드: 단계별(Step-by-step) 논리적 풀이 과정 제공.
3. 코딩 어시스턴트: 코드 작성, 버그 수정, 리뷰.
4. 이미지 생성 가이드: 시각적 묘사 지원.

모든 답변은 한국어로 작성하며, 전문적이면서도 친숙한 톤을 유지하세요. 마크다운 형식을 적극 활용하세요.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [...history, { role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error (Text):", error);
    throw error;
  }
}

export async function generateImageWithGemini(prompt: string) {
  try {
    const enhancedPrompt = `Masterpiece, high quality, 8k, highly detailed, professional digital art, photorealistic if applicable: ${prompt}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: enhancedPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Gemini API Error (Image):", error);
    throw error;
  }
}
