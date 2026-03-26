import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateUserSettings } from '../services/dbService';
import { UserSettings, NutritionGoals } from '../types';
import { User, Activity, Target, Save, Loader2, AlertCircle } from 'lucide-react';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({
    gender: 'male',
    age: 30,
    height: 170,
    weight: 70,
    activityLevel: 'moderate',
    goal: 'maintain',
    nutritionGoals: {
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 65
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.settings) {
      setSettings(prev => ({ ...prev, ...user.settings }));
    }
  }, [user]);

  const calculateMacros = () => {
    if (!settings.gender || !settings.age || !settings.height || !settings.weight || !settings.activityLevel || !settings.goal) return;

    // Mifflin-St Jeor Equation
    let bmr = (10 * settings.weight) + (6.25 * settings.height) - (5 * settings.age);
    bmr += settings.gender === 'male' ? 5 : -161;

    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725
    };

    let tdee = bmr * activityMultipliers[settings.activityLevel];

    let targetCalories = tdee;
    let proteinPct = 0.3;
    let carbsPct = 0.4;
    let fatPct = 0.3;

    if (settings.goal === 'lose') {
      targetCalories -= 500;
      proteinPct = 0.4;
      carbsPct = 0.3;
      fatPct = 0.3;
    } else if (settings.goal === 'gain') {
      targetCalories += 300;
      proteinPct = 0.3;
      carbsPct = 0.5;
      fatPct = 0.2;
    }

    const protein = Math.round((targetCalories * proteinPct) / 4);
    const carbs = Math.round((targetCalories * carbsPct) / 4);
    const fat = Math.round((targetCalories * fatPct) / 9);

    setSettings(prev => ({
      ...prev,
      nutritionGoals: {
        calories: Math.round(targetCalories),
        protein,
        carbs,
        fat
      }
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    
    try {
      await updateUserSettings(user.uid, settings);
      updateUser({ ...user, settings });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || '儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-6 bg-accent rounded-full"></div>
        <h2 className="text-xl font-bold tracking-widest text-primary">個人設定</h2>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Basic Info */}
      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-secondary mb-2">
          <User size={18} />
          <h3 className="font-medium tracking-widest">基本資料</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-secondary mb-1">性別</label>
            <select 
              value={settings.gender || 'male'} 
              onChange={e => setSettings({...settings, gender: e.target.value as 'male'|'female'})}
              className="w-full bg-surface border border-border-color rounded-xl p-3 text-sm focus:outline-none focus:border-accent"
            >
              <option value="male">男性</option>
              <option value="female">女性</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">年齡</label>
            <input 
              type="number" 
              value={settings.age || ''} 
              onChange={e => setSettings({...settings, age: parseInt(e.target.value)})}
              className="w-full bg-surface border border-border-color rounded-xl p-3 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">身高 (cm)</label>
            <input 
              type="number" 
              value={settings.height || ''} 
              onChange={e => setSettings({...settings, height: parseInt(e.target.value)})}
              className="w-full bg-surface border border-border-color rounded-xl p-3 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-secondary mb-1">體重 (kg)</label>
            <input 
              type="number" 
              value={settings.weight || ''} 
              onChange={e => setSettings({...settings, weight: parseInt(e.target.value)})}
              className="w-full bg-surface border border-border-color rounded-xl p-3 text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      {/* Activity & Goals */}
      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-secondary mb-2">
          <Activity size={18} />
          <h3 className="font-medium tracking-widest">活動量與目標</h3>
        </div>
        
        <div>
          <label className="block text-xs text-secondary mb-1">日常活動量</label>
          <select 
            value={settings.activityLevel || 'moderate'} 
            onChange={e => setSettings({...settings, activityLevel: e.target.value as any})}
            className="w-full bg-surface border border-border-color rounded-xl p-3 text-sm focus:outline-none focus:border-accent"
          >
            <option value="sedentary">久坐 (辦公室工作，少運動)</option>
            <option value="light">輕度活動 (每週運動1-3天)</option>
            <option value="moderate">中度活動 (每週運動3-5天)</option>
            <option value="active">高度活動 (每週運動6-7天)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-secondary mb-1">飲食目標</label>
          <select 
            value={settings.goal || 'maintain'} 
            onChange={e => setSettings({...settings, goal: e.target.value as any})}
            className="w-full bg-surface border border-border-color rounded-xl p-3 text-sm focus:outline-none focus:border-accent"
          >
            <option value="lose">減脂 (創造熱量缺口)</option>
            <option value="maintain">維持體重</option>
            <option value="gain">增肌 (熱量盈餘)</option>
          </select>
        </div>

        <button 
          onClick={calculateMacros}
          className="w-full py-3 bg-primary text-white rounded-xl text-sm font-medium tracking-widest hover:bg-primary/90 transition-colors mt-2"
        >
          自動計算建議營養素
        </button>
      </div>

      {/* Nutrition Goals */}
      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-secondary mb-2">
          <Target size={18} />
          <h3 className="font-medium tracking-widest">每日營養目標 (可自訂)</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-secondary mb-1">目標熱量 (大卡)</label>
            <input 
              type="number" 
              value={settings.nutritionGoals?.calories || ''} 
              onChange={e => setSettings({...settings, nutritionGoals: {...settings.nutritionGoals!, calories: parseInt(e.target.value)}})}
              className="w-full bg-surface border border-border-color rounded-xl p-3 text-sm focus:outline-none focus:border-accent font-bold text-accent"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-secondary mb-1">蛋白質 (g)</label>
              <input 
                type="number" 
                value={settings.nutritionGoals?.protein || ''} 
                onChange={e => setSettings({...settings, nutritionGoals: {...settings.nutritionGoals!, protein: parseInt(e.target.value)}})}
                className="w-full bg-surface border border-border-color rounded-xl p-3 text-sm focus:outline-none focus:border-accent text-[#3b82f6]"
              />
            </div>
            <div>
              <label className="block text-xs text-secondary mb-1">醣類 (g)</label>
              <input 
                type="number" 
                value={settings.nutritionGoals?.carbs || ''} 
                onChange={e => setSettings({...settings, nutritionGoals: {...settings.nutritionGoals!, carbs: parseInt(e.target.value)}})}
                className="w-full bg-surface border border-border-color rounded-xl p-3 text-sm focus:outline-none focus:border-accent text-[#ef4444]"
              />
            </div>
            <div>
              <label className="block text-xs text-secondary mb-1">脂質 (g)</label>
              <input 
                type="number" 
                value={settings.nutritionGoals?.fat || ''} 
                onChange={e => setSettings({...settings, nutritionGoals: {...settings.nutritionGoals!, fat: parseInt(e.target.value)}})}
                className="w-full bg-surface border border-border-color rounded-xl p-3 text-sm focus:outline-none focus:border-accent text-[#10b981]"
              />
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-4 bg-accent text-white rounded-xl font-medium tracking-widest hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 shadow-glow"
      >
        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
        {saveSuccess ? '已儲存' : '儲存設定'}
      </button>
    </div>
  );
}
