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

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface UserSettings {
  gender?: 'male' | 'female';
  age?: number;
  height?: number; // cm
  weight?: number; // kg
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active';
  goal?: 'lose' | 'maintain' | 'gain';
  nutritionGoals?: NutritionGoals;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  settings?: UserSettings;
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
  goalsMet?: number;
  goalsMissed?: number;
}

export interface MealPlanItem {
  description: string;
  nutrition: NutritionData;
  category?: string;
  mealType?: MealType;
  notes?: string;
}

export interface MealPlan {
  id: string;
  userId: string;
  name: string; // e.g., "健身餐A"
  description: string; // e.g., "雞胸肉 200g, 白飯 1碗, 西蘭花 100g"
  items?: MealPlanItem[]; // The actual parsed items
  createdAt: number;
}

export type LoadingState = 'idle' | 'analyzing' | 'saving' | 'syncing' | 'success' | 'error';