export enum MealType {
  BREAKFAST = '早餐',
  LUNCH = '午餐',
  DINNER = '晚餐',
  SNACK = '小食'
}

export interface NutritionData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface DietRecord {
  id: string;
  userId: string;
  timestamp: number; // Unix timestamp in ms
  dateStr: string; // YYYY-MM-DD for easy querying
  mealType: MealType;
  description: string;
  category?: string; // New: e.g., "快餐", "茶餐廳", "飲品"
  imageUrl?: string;
  nutrition: NutritionData;
  confidence: number;
  notes: string;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface WeeklyStats {
  startOfWeek: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  avgCalories: number;
  highestCalDay: string;
  lowestCalDay: string;
  insight: string;
}

export type LoadingState = 'idle' | 'analyzing' | 'saving' | 'syncing' | 'success' | 'error';