import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDietRecordsByRange } from '../services/dbService';
import { getStartOfWeek } from '../utils';
import { DietRecord, WeeklyStats, NutritionGoals } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronLeft, ChevronRight, TrendingUp, Award, AlertCircle, Target, XCircle } from 'lucide-react';

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [records, setRecords] = useState<DietRecord[]>([]);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<Error | null>(null);

  if (loadError) {
      throw loadError;
  }

  useEffect(() => {
    if(!user) return;

    const fetchWeekData = async () => {
      const start = currentWeekStart.getTime();
      const end = start + (7 * 24 * 60 * 60 * 1000) - 1; // End of week
      
      try {
        const data = await getDietRecordsByRange(user.uid, start, end);
        setRecords(data);
        calculateStats(data, currentWeekStart);
      } catch (error: any) {
        console.error("Failed to fetch weekly data", error);
        setLoadError(error);
      }
    };

    fetchWeekData();
  }, [user, currentWeekStart]);

  const calculateStats = (data: DietRecord[], weekStart: Date) => {
    // Init daily buckets
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dailyTotals: Record<string, { cal: number, pro: number, carb: number, fat: number, count: number, label: string }> = {};
    
    // Initialize standard week array
    const chartArr = [];
    for(let i=0; i<7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        // Note: getDay() returns 0 for Sunday. 
        // Logic: weekStart is adjusted. If weekStart is Sunday, i=0 is Sunday.
        const dayLabel = days[d.getDay()];
        const key = d.toDateString();
        
        dailyTotals[key] = { cal: 0, pro: 0, carb: 0, fat: 0, count: 0, label: dayLabel };
    }

    // Aggregation
    data.forEach(r => {
        const d = new Date(r.timestamp).toDateString();
        if (dailyTotals[d]) {
            dailyTotals[d].cal += r.nutrition.calories;
            dailyTotals[d].pro += r.nutrition.protein;
            dailyTotals[d].carb += r.nutrition.carbs || 0;
            dailyTotals[d].fat += r.nutrition.fat || 0;
            dailyTotals[d].count += 1;
        }
    });

    // To Array
    let maxCal = 0; 
    let minCal = Infinity;
    let maxDay = '';
    let minDay = '';
    let totalCal = 0;
    let totalPro = 0;
    let totalCarb = 0;
    let totalFat = 0;
    let recordedDays = 0;
    let goalsMet = 0;
    let goalsMissed = 0;

    const userGoals = user?.settings?.nutritionGoals || { calories: 2000, protein: 150, carbs: 200, fat: 65 };

    const sortedDates = Object.keys(dailyTotals).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

    sortedDates.forEach(k => {
        const item = dailyTotals[k];
        chartArr.push({
            name: item.label,
            calories: Math.round(item.cal),
            protein: Math.round(item.pro),
            carbs: Math.round(item.carb),
            fat: Math.round(item.fat)
        });

        if (item.count > 0) {
            totalCal += item.cal;
            totalPro += item.pro;
            totalCarb += item.carb;
            totalFat += item.fat;
            recordedDays++;
            
            // Goal tracking logic
            const isCalorieOk = item.cal <= userGoals.calories + 200 && item.cal >= userGoals.calories - 500;
            const isProteinOk = item.pro >= userGoals.protein * 0.8 && item.pro <= userGoals.protein * 1.2;
            
            if (isCalorieOk && isProteinOk) {
                goalsMet++;
            } else {
                goalsMissed++;
            }

            if (item.cal > maxCal) { maxCal = item.cal; maxDay = item.label; }
            if (item.cal < minCal) { minCal = item.cal; minDay = item.label; }
        }
    });
    
    setChartData(chartArr);

    // Insights
    let insight = "Insufficient data. Please continue logging.";
    if (recordedDays > 2) {
        if (totalPro / recordedDays < 50) insight = "Low average protein intake. Consider adding more eggs, meat, or soy.";
        else if (totalCal / recordedDays > 2500) insight = "High average calories. Monitor snacks and sugary drinks.";
        else insight = "Balanced nutrition intake. Keep it up.";
    }

    setStats({
        startOfWeek: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        totalCalories: Math.round(totalCal),
        totalProtein: Math.round(totalPro),
        totalCarbs: Math.round(totalCarb),
        totalFat: Math.round(totalFat),
        avgCalories: recordedDays ? Math.round(totalCal / recordedDays) : 0,
        highestCalDay: maxDay || '-',
        lowestCalDay: minDay === Infinity.toString() ? '-' : minDay,
        insight,
        goalsMet,
        goalsMissed
    });
  };

  const changeWeek = (offset: number) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + (offset * 7));
    setCurrentWeekStart(d);
  };

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex items-center justify-between glass-panel p-4 rounded-2xl">
        <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-surface-hover rounded-full text-secondary transition-colors">
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <div className="text-center">
            <div className="text-[10px] text-secondary tracking-widest uppercase mb-1">Weekly Overview</div>
            <h2 className="font-light text-lg text-primary tracking-wider">{stats?.startOfWeek}</h2>
        </div>
        <button onClick={() => changeWeek(1)} className="p-2 hover:bg-surface-hover rounded-full text-secondary transition-colors">
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      </div>

      {stats && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-24">
                    <div className="text-secondary text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <Target size={14} strokeWidth={1.5} className="text-emerald-500" /> 達標日數
                    </div>
                    <div>
                        <span className="text-2xl font-light tracking-tight text-emerald-600">{stats.goalsMet || 0}</span>
                        <span className="text-[10px] text-secondary tracking-widest ml-1">日</span>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-24">
                    <div className="text-secondary text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <XCircle size={14} strokeWidth={1.5} className="text-red-500" /> 未達標日數
                    </div>
                    <div>
                        <span className="text-2xl font-light tracking-tight text-red-500">{stats.goalsMissed || 0}</span>
                        <span className="text-[10px] text-secondary tracking-widest ml-1">日</span>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-24">
                    <div className="text-secondary text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={14} strokeWidth={1.5}/> 平均熱量
                    </div>
                    <div>
                        <span className="text-2xl font-light tracking-tight text-primary">{stats.avgCalories}</span>
                        <span className="text-[10px] text-secondary tracking-widest ml-1">KCAL</span>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-24">
                    <div className="text-secondary text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <Award size={14} strokeWidth={1.5}/> 總蛋白質
                    </div>
                    <div>
                        <span className="text-2xl font-light tracking-tight text-accent">{stats.totalProtein}</span>
                        <span className="text-[10px] text-secondary tracking-widest ml-1">G</span>
                    </div>
                </div>
            </div>

            {/* Insight */}
            <div className="glass-panel border-l-2 border-l-accent p-5 rounded-2xl text-sm text-primary flex gap-4 items-start">
                <AlertCircle className="flex-shrink-0 text-accent mt-0.5" size={18} strokeWidth={1.5} />
                <p className="font-light leading-relaxed tracking-wide">{stats.insight}</p>
            </div>

            {/* Chart */}
            <div className="glass-panel p-5 rounded-2xl h-80">
                <h3 className="text-[10px] uppercase tracking-widest mb-6 text-secondary">Calorie Trend</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                        <Tooltip 
                            contentStyle={{backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                            itemStyle={{fontSize: '12px', color: '#1f2937'}}
                            labelStyle={{color: '#6b7280', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em'}}
                            cursor={{fill: '#f3f4f6'}}
                        />
                        <Bar dataKey="calories" radius={[4, 4, 0, 0]} maxBarSize={40}>
                           {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.calories > 2500 ? '#ef4444' : '#f97316'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
          </>
      )}
    </div>
  );
};