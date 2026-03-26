// In a real app, these would come from process.env
// For this demo structure, we check if they exist.
import firebaseConfig from './firebase-applet-config.json';

export const IS_DEMO_MODE = !firebaseConfig.apiKey;

export const HK_TIMEZONE = 'Asia/Hong_Kong';

export const AI_MODELS = {
  GEMINI: {
    FAST: 'gemini-3-flash-preview',
    PRO: 'gemini-3-pro-preview', 
  }
};

export const DEFAULT_PLACEHOLDER_IMAGE = 'https://picsum.photos/400/300';

export const MEAL_TIME_RANGES = {
  BREAKFAST: { start: 5, end: 11 },
  LUNCH: { start: 11, end: 14 },
  DINNER: { start: 17, end: 22 },
  // Others fallback to snack
};