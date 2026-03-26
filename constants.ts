// In a real app, these would come from process.env
// For this demo structure, we check if they exist.

export const IS_DEMO_MODE = !process.env.REACT_APP_FIREBASE_API_KEY;

export const HK_TIMEZONE = 'Asia/Hong_Kong';

export const AI_PROVIDERS = {
  GEMINI: 'gemini',
  BAILIAN: 'bailian',
  MOONSHOT: 'moonshot'
};

export const AI_MODELS = {
  GEMINI: {
    FAST: 'gemini-3-flash-preview',
    PRO: 'gemini-3-pro-preview', 
  },
  BAILIAN: {
    FAST: 'qwen-plus',
    PRO: 'qwen-max',
    VL_FAST: 'qwen-vl-plus',
    VL_PRO: 'qwen-vl-max'
  },
  MOONSHOT: {
    FAST: 'moonshot-v1-8k',
    PRO: 'kimi-k2.5',
    VL_FAST: 'moonshot-v1-8k-vision-preview',
    VL_PRO: 'kimi-k2.5'
  }
};

export const DEFAULT_PLACEHOLDER_IMAGE = 'https://picsum.photos/400/300';

export const MEAL_TIME_RANGES = {
  BREAKFAST: { start: 5, end: 11 },
  LUNCH: { start: 11, end: 14 },
  DINNER: { start: 17, end: 22 },
  // Others fallback to snack
};