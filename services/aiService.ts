import { GoogleGenAI, Type } from "@google/genai";
import { AI_MODELS, AI_PROVIDERS } from "../constants";
import { NutritionData, MealType } from "../types";
import { getAIConfig } from "./aiConfigService";

interface AnalysisResult {
  nutrition: NutritionData;
  mealType: MealType;
  confidence: number;
  notes: string;
  foodName: string;
  category: string;
}

export const analyzeFood = async (
  textDescription: string,
  imageBase64?: string,
  dateTimeContext?: string,
  mode: 'fast' | 'pro' = 'fast'
): Promise<AnalysisResult[]> => {

  const config = getAIConfig();

  const promptText = `
    你是一位專精於香港飲食數據的「AI 營養審計員」。
    你的任務是為使用者輸入的食物提供**最準確**且**高度一致**的營養數據。
    
    當前時間上下文：${dateTimeContext || '未知'}。

    **分析規則：**

    1.  **品牌/連鎖店強制搜尋**：
        -   若識別出品牌（如：譚仔、三哥、麥當勞、KFC、大家樂），**必須**盡可能查找該品牌的官方營養表格。

    2.  **港式標準份量**：
        -   若無品牌，但為港式常見餐點（如：叉燒飯、沙嗲牛肉麵），請採用「茶餐廳標準份量」。

    3.  **強制分類 (Strict Categorization)**：
        -   請為每個食物項目提供一個分類標籤。
        -   **必須且只能**從以下 5 個選項中選擇一個：【主餐】、【甜品】、【小食】、【飲品】、【補充劑】。
        -   絕對不允許創建其他分類。
    
    ${mode === 'fast' ? '請保持回應簡潔快速。' : '請運用深度思考，仔細分析圖片中的份量與食材組成。'}

    **輸出規範**：
    -   **confidence**: 若有官方/搜尋數據支持，設為 0.95；若為一般估算，設為 0.8。
    -   **notes**: **必須**在備註中說明計算基準。

    請只回傳符合以下 JSON 格式的陣列 (Array)，不要包含任何其他文字或 Markdown 標記（如 \`\`\`json）：
    [
      {
        "foodName": "食物名稱",
        "category": "主餐 | 甜品 | 小食 | 飲品 | 補充劑",
        "mealType": "早餐" | "午餐" | "晚餐" | "小食",
        "calories": 數值,
        "protein": 數值,
        "carbs": 數值,
        "fat": 數值,
        "fiber": 數值,
        "confidence": 0.8到0.95的數值,
        "notes": "計算基準說明"
      }
    ]
  `;

  let parsedResults: any[] = [];

  if (config.provider === AI_PROVIDERS.BAILIAN) {
    if (!config.bailianApiKey) {
      throw new Error("Missing Bailian API Key in settings.");
    }
    parsedResults = await callBailian(promptText, textDescription, imageBase64, mode, config.bailianApiKey, config.bailianBaseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1');
  } else if (config.provider === AI_PROVIDERS.MOONSHOT) {
    if (!config.moonshotApiKey) {
      throw new Error("Missing Moonshot API Key in settings.");
    }
    parsedResults = await callMoonshot(promptText, textDescription, imageBase64, mode, config.moonshotApiKey, config.moonshotBaseUrl || 'https://api.moonshot.cn/v1', config.moonshotModel);
  } else {
    // Default to Gemini
    const geminiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error("Missing Gemini API Key in settings.");
    }
    parsedResults = await callGemini(promptText, textDescription, imageBase64, mode, geminiKey);
  }

  return parsedResults.map((result: any) => ({
    foodName: result.foodName || "未知食物",
    mealType: (result.mealType as MealType) || MealType.SNACK,
    category: ["主餐", "甜品", "小食", "飲品", "補充劑"].includes(result.category) ? result.category : "主餐",
    nutrition: {
      calories: Number(result.calories) || 0,
      protein: Number(result.protein) || 0,
      carbs: Number(result.carbs) || 0,
      fat: Number(result.fat) || 0,
      fiber: Number(result.fiber) || 0,
    },
    confidence: Number(result.confidence) || 0.8,
    notes: result.notes || ""
  }));
};

const callGemini = async (promptText: string, textDescription: string, imageBase64: string | undefined, mode: 'fast' | 'pro', apiKey: string) => {
  const ai = new GoogleGenAI({ apiKey });
  const modelName = mode === 'pro' ? AI_MODELS.GEMINI.PRO : AI_MODELS.GEMINI.FAST;
  
  const thinkingConfig = mode === 'pro' 
    ? { thinkingBudget: 2048 } 
    : undefined;

  const parts: any[] = [{ text: promptText }];

  if (textDescription) {
    parts.push({ text: `使用者描述: ${textDescription}` });
  }

  if (imageBase64) {
    const base64Data = imageBase64.includes('base64,') 
      ? imageBase64.split('base64,')[1] 
      : imageBase64;

    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data
      }
    });
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts },
    config: {
      temperature: 0.0, 
      topP: 0.95,
      topK: 32,
      thinkingConfig: thinkingConfig,
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            foodName: { type: Type.STRING },
            category: { type: Type.STRING, enum: ['主餐', '甜品', '小食', '飲品', '補充劑'] },
            mealType: { type: Type.STRING },
            calories: { type: Type.NUMBER },
            protein: { type: Type.NUMBER },
            carbs: { type: Type.NUMBER },
            fat: { type: Type.NUMBER },
            fiber: { type: Type.NUMBER },
            confidence: { type: Type.NUMBER },
            notes: { type: Type.STRING }
          },
          required: ['foodName', 'category', 'mealType', 'calories', 'protein', 'confidence', 'notes']
        }
      }
    }
  });

  if (!response.text) {
    throw new Error("AI 無法生成回應");
  }

  return JSON.parse(response.text);
};

const callBailian = async (promptText: string, textDescription: string, imageBase64: string | undefined, mode: 'fast' | 'pro', apiKey: string, baseUrl: string) => {
  const modelName = imageBase64 
    ? (mode === 'pro' ? AI_MODELS.BAILIAN.VL_PRO : AI_MODELS.BAILIAN.VL_FAST)
    : (mode === 'pro' ? AI_MODELS.BAILIAN.PRO : AI_MODELS.BAILIAN.FAST);

  const messages: any[] = [
    {
      role: "system",
      content: "你是一位專精於香港飲食數據的「AI 營養審計員」。請只回傳符合格式的 JSON 陣列，不要包含任何其他文字或 Markdown 標記。"
    }
  ];

  const content: any[] = [
    { type: "text", text: promptText }
  ];

  if (textDescription) {
    content.push({ type: "text", text: `使用者描述: ${textDescription}` });
  }

  if (imageBase64) {
    const base64Data = imageBase64.includes('base64,') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
    content.push({
      type: "image_url",
      image_url: { url: base64Data }
    });
  }

  messages.push({
    role: "user",
    content: content
  });

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: modelName,
      messages: messages,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Bailian API Error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  let text = data.choices[0].message.content;
  
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  let parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      for (const key of keys) {
          if (Array.isArray(parsed[key])) {
              parsed = parsed[key];
              break;
          }
      }
      if (!Array.isArray(parsed)) {
          parsed = [parsed];
      }
  }

  return parsed;
};

const callMoonshot = async (promptText: string, textDescription: string, imageBase64: string | undefined, mode: 'fast' | 'pro', apiKey: string, baseUrl: string, customModel?: string) => {
  const modelName = customModel || (imageBase64 
    ? (mode === 'pro' ? AI_MODELS.MOONSHOT.VL_PRO : AI_MODELS.MOONSHOT.VL_FAST)
    : (mode === 'pro' ? AI_MODELS.MOONSHOT.PRO : AI_MODELS.MOONSHOT.FAST));

  const messages: any[] = [
    {
      role: "system",
      content: "你是一位專精於香港飲食數據的「AI 營養審計員」。請只回傳符合格式的 JSON 陣列，不要包含任何其他文字或 Markdown 標記。"
    }
  ];

  const content: any[] = [
    { type: "text", text: promptText }
  ];

  if (textDescription) {
    content.push({ type: "text", text: `使用者描述: ${textDescription}` });
  }

  if (imageBase64) {
    const base64Data = imageBase64.includes('base64,') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
    content.push({
      type: "image_url",
      image_url: { url: base64Data }
    });
  }

  messages.push({
    role: "user",
    content: content
  });

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: modelName,
      messages: messages,
      temperature: 1
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Moonshot API Error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  let text = data.choices[0].message.content;
  
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  let parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      for (const key of keys) {
          if (Array.isArray(parsed[key])) {
              parsed = parsed[key];
              break;
          }
      }
      if (!Array.isArray(parsed)) {
          parsed = [parsed];
      }
  }

  return parsed;
};

export const generateWeeklyInsights = async (records: any[]): Promise<string> => {
  return ""; 
};