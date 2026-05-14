import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please set it in your environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function chatWithGemini(prompt: string, history: { role: string; parts: { text: string }[] }[] = [], modelName: string = "Gemini") {
  try {
    const ai = getAI();
    const personas: Record<string, string> = {
      Gemini: "당신은 Google의 Gemini입니다. 친절하고 신속하게 답변하세요.",
      ChatGPT: "당신은 OpenAI의 ChatGPT입니다. 논리적이고 명확하게 답변하세요.",
      Claude: "당신은 Anthropic의 Claude입니다. 창의적이고 상세하게 답변하세요.",
    };

    const systemInstruction = `당신은 'MODU AI' 통합 플랫폼 내의 ${modelName} 엔진입니다.
${personas[modelName] || personas.Gemini}

개발자: 김도준 (blanket). 사용자가 개발자가 누구인지 물어보는 경우에만 "이 서비스는 김도준 (blanket)님이 개발하셨습니다"와 같이 답변하세요. 그 외의 상황에서는 먼저 언급하지 마세요.

현재 플랫폼은 다음 4가지 핵심 모드를 지원합니다:
1. 대화 모드: 일상적인 대화 및 일반 지식 답변.
2. 문제 풀이 모드: 단계별(Step-by-step) 논리적 풀이 과정 제공.
3. 코딩 어시스턴트: 코드 작성, 버그 수정, 리뷰.
4. 이미지 생성 가이드: 시각적 묘사 지원.

검색 기능: 최신 정보가 필요할 경우 'googleSearch' 도구를 활용하여 검색된 결과를 마크다운 형식으로 보기 좋게 정리하여 답변하세요.

모든 답변은 한국어로 작성하며, 전문적이면서도 친숙한 톤을 유지하세요.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [...history, { role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });

    let resultText = response.text;
    
    // Append grounding links if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks && groundingChunks.length > 0) {
      const links = groundingChunks
        .filter(chunk => chunk.web?.uri)
        .map(chunk => `[${chunk.web?.title || '출처'}](${chunk.web?.uri})`);
      
      if (links.length > 0) {
        resultText += "\n\n**참고 자료:**\n" + links.join("\n");
      }
    }

    return resultText;
  } catch (error) {
    console.error("Gemini API Error (Text):", error);
    throw error;
  }
}

export async function generateImageWithGemini(prompt: string) {
  try {
    const ai = getAI();
    const enhancedPrompt = `Masterpiece, high quality, 8k, highly detailed, professional digital art, photorealistic if applicable: ${prompt}`;
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
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
