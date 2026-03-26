import { HK_TIMEZONE, MEAL_TIME_RANGES } from './constants';
import { MealType } from './types';

export const formatHKDate = (timestamp: number): string => {
  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: HK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp)).split('/').reverse().join('-'); // Returns YYYY-MM-DD
};

export const formatHKTime = (timestamp: number): string => {
  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: HK_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
};

export const formatHKDateTime = (timestamp: number): string => {
    return new Intl.DateTimeFormat('zh-HK', {
      timeZone: HK_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  };

export const guessMealType = (date: Date): MealType => {
  // Convert to HK hour
  const hkDateStr = new Date().toLocaleString('en-US', { timeZone: HK_TIMEZONE });
  const hkDate = new Date(hkDateStr);
  const hour = hkDate.getHours();

  if (hour >= MEAL_TIME_RANGES.BREAKFAST.start && hour < MEAL_TIME_RANGES.BREAKFAST.end) return MealType.BREAKFAST;
  if (hour >= MEAL_TIME_RANGES.LUNCH.start && hour < MEAL_TIME_RANGES.LUNCH.end) return MealType.LUNCH;
  if (hour >= MEAL_TIME_RANGES.DINNER.start && hour < MEAL_TIME_RANGES.DINNER.end) return MealType.DINNER;
  return MealType.SNACK;
};

export const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data url prefix for Gemini API if needed, 
      // but usually the standard `inlineData` expects raw base64 without prefix.
      // However, for displaying in <img> we need the prefix.
      // We will split it when sending to API.
      resolve(result);
    };
    reader.onerror = error => reject(error);
  });
};