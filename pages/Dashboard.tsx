import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDietRecordsByDate, getMonthlyStats, deleteDietRecord } from '../services/dbService';
import { DietRecord, MealType } from '../types';
import { formatHKDate } from '../utils';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Calendar as CalendarIcon, X, Trash2, Clock, Info, Check, ChevronDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

// Helper for styles based on MealType
const getMealStyles = (type: MealType) => {
  switch (type) {
    case MealType.BREAKFAST:
      return 'border-l-2 border-l-accent/60 bg-surface';
    case MealType.LUNCH:
      return 'border-l-2 border-l-accent bg-surface';
    case MealType.DINNER:
      return 'border-l-2 border-l-primary/60 bg-surface';
    case MealType.SNACK:
      return 'border-l-2 border-l-secondary/60 bg-surface';
    default:
      return 'border-l-2 border-l-border-color bg-surface';
  }
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [records, setRecords] = useState<DietRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState<Record<string, number>>({});
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  
  // Detail Modal State
  const [viewingRecord, setViewingRecord] = useState<DietRecord | null>(null);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  // Delete State: 'idle' | 'confirm' | 'deleting'
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm' | 'deleting'>('idle');
  const [loadError, setLoadError] = useState<Error | null>(null);

  if (loadError) {
      throw loadError;
  }

  const dateStr = formatHKDate(selectedDate.getTime());

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getDietRecordsByDate(user.uid, dateStr);
      setRecords(data);
    } catch (error: any) {
      console.error("Failed to fetch records", error);
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyStats = async () => {
    if (!user || !isCalendarOpen) return;
    try {
      const year = calendarMonth.getFullYear();
      const month = calendarMonth.getMonth();
      const stats = await getMonthlyStats(user.uid, year, month);
      setMonthlyStats(stats);
    } catch (e: any) {
      console.error(e);
      setLoadError(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate, user]);

  useEffect(() => {
    fetchMonthlyStats();
  }, [calendarMonth, isCalendarOpen, user]);

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
    if (!isCalendarOpen) {
      setCalendarMonth(newDate);
    }
  };

  // Handlers for Modal Logic
  const openRecordDetail = (record: DietRecord) => {
      setViewingRecord(record);
      setDeleteState('idle'); // Reset delete state
  };

  const closeRecordDetail = () => {
      setViewingRecord(null);
      setDeleteState('idle');
  };

  const handleDeleteClick = () => {
      setDeleteState('confirm');
  };

  const handleCancelDelete = () => {
      setDeleteState('idle');
  };

  const handleConfirmDelete = async () => {
      if (!user || !viewingRecord) return;
      
      setDeleteState('deleting');
      try {
          await deleteDietRecord(user.uid, viewingRecord.id);
          
          // Optimistic UI update
          setRecords(prev => prev.filter(r => r.id !== viewingRecord.id));
          
          // Update stats in background
          fetchMonthlyStats(); 
          
          // Close modal
          closeRecordDetail();
      } catch (e: any) {
          console.error(e);
          alert(e.message || "刪除失敗");
          setDeleteState('idle');
      }
  };

  const totalCalories = records.reduce((acc, r) => acc + r.nutrition.calories, 0);
  const totalProtein = records.reduce((acc, r) => acc + r.nutrition.protein, 0);
  const totalCarbs = records.reduce((acc, r) => acc + (r.nutrition.carbs || 0), 0);
  const totalFat = records.reduce((acc, r) => acc + (r.nutrition.fat || 0), 0);

  const carbCals = totalCarbs * 4;
  const proteinCals = totalProtein * 4;
  const fatCals = totalFat * 9;
  const totalMacroCals = carbCals + proteinCals + fatCals;

  const carbPct = totalMacroCals ? Math.round((carbCals / totalMacroCals) * 100) : 0;
  const proteinPct = totalMacroCals ? Math.round((proteinCals / totalMacroCals) * 100) : 0;
  const fatPct = totalMacroCals ? Math.round((fatCals / totalMacroCals) * 100) : 0;

  const pieData = [
    { name: 'Carbs', value: carbCals || 1, fill: '#ef4444' },
    { name: 'Protein', value: proteinCals || 1, fill: '#3b82f6' },
    { name: 'Fat', value: fatCals || 1, fill: '#10b981' }
  ];
  
  if (totalMacroCals === 0) {
    pieData.forEach(d => d.fill = '#e5e7eb');
  }

  // Generate Feedback
  const generateFeedback = () => {
    if (records.length === 0) return null;

    const goals = user?.settings?.nutritionGoals || { calories: 2000, protein: 150, carbs: 200, fat: 65 };
    let feedback = [];

    if (totalCalories > goals.calories + 200) {
      feedback.push('今日卡路里已超標');
    } else if (totalCalories < goals.calories - 500) {
      feedback.push('今日熱量攝取不足');
    }

    if (totalProtein < goals.protein * 0.8) {
      feedback.push('蛋白質唔夠');
    } else if (totalProtein > goals.protein * 1.2) {
      feedback.push('蛋白質攝取偏高');
    }

    if (totalCarbs > goals.carbs * 1.2) {
      feedback.push('澱粉質有啲高');
    }

    if (feedback.length === 0) {
      return '今日飲食控制得好好！繼續保持！';
    }

    return feedback.join('，') + '。';
  };

  const dailyFeedback = generateFeedback();

  const goals = user?.settings?.nutritionGoals || { calories: 2000, protein: 150, carbs: 200, fat: 65 };
  
  const calRatio = totalCalories / goals.calories;
  let calColor = 'bg-slate-700';
  let calTextColor = 'text-slate-700';
  let calText = '攝取不足';
  
  if (calRatio >= 0.85 && calRatio <= 1.1) {
    calColor = 'bg-emerald-500';
    calTextColor = 'text-emerald-600';
    calText = '達標範圍';
  } else if (calRatio > 1.1) {
    calColor = 'bg-red-500';
    calTextColor = 'text-red-500';
    calText = '超出目標';
  }

  const carbRatio = totalCarbs / goals.carbs;
  const proRatio = totalProtein / goals.protein;
  const fatRatio = totalFat / goals.fat;

  // Calendar
  const renderCalendar = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`}></div>);

    for (let d = 1; d <= daysInMonth; d++) {
      const currentDate = new Date(year, month, d);
      const currentStr = formatHKDate(currentDate.getTime());
      const isSelected = currentStr === dateStr;
      const calories = monthlyStats[currentStr] || 0;
      
      let indicatorStyle = '';
      if (calories > 0) {
          if (calories < 1500) indicatorStyle = 'bg-secondary';
          else if (calories < 2500) indicatorStyle = 'bg-accent';
          else indicatorStyle = 'bg-red-500';
      }

      days.push(
        <button
          key={d}
          onClick={() => setSelectedDate(currentDate)}
          className={`h-12 rounded-lg flex flex-col items-center justify-center gap-1 transition-all border
            ${isSelected ? 'bg-primary text-bg-dark border-primary' : 'bg-surface border-transparent hover:border-border-color hover:bg-surface-hover'}`}
        >
          <span className="text-sm font-medium">{d}</span>
          {calories > 0 && (
            <span className={`w-1.5 h-1.5 rounded-full ${indicatorStyle}`}></span>
          )}
        </button>
      );
    }

    return (
      <div className="glass-panel p-5 rounded-2xl mb-6 animate-fade-in relative overflow-hidden">
        <div className="flex justify-between items-center mb-6">
           <button onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} className="p-2 hover:bg-surface-hover rounded-full transition-all text-secondary hover:text-primary">
             <ChevronLeft size={20} strokeWidth={1.5} />
           </button>
           <h3 className="font-medium text-lg text-primary tracking-widest">
             {year} / {String(month + 1).padStart(2, '0')}
           </h3>
           <button onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} className="p-2 hover:bg-surface-hover rounded-full transition-all text-secondary hover:text-primary">
             <ChevronRight size={20} strokeWidth={1.5} />
           </button>
        </div>
        <div className="grid grid-cols-7 text-center mb-4 font-medium text-secondary text-xs tracking-widest">
           {weekDays.map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days}
        </div>
        <button 
            onClick={() => setIsCalendarOpen(false)}
            className="w-full mt-6 flex items-center justify-center gap-2 text-sm font-medium text-secondary hover:text-primary py-3 hover:bg-surface-hover rounded-xl transition-colors"
        >
            <X size={16} /> CLOSE
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      
      {isCalendarOpen ? (
        renderCalendar()
      ) : (
        /* Date Navigator */
        <div className="flex items-center justify-between bg-black text-white p-2 rounded-full">
          <button onClick={() => changeDate(-1)} className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
            <ChevronLeft size={20} strokeWidth={1.5} />
          </button>
          
          <div 
             className="flex flex-col items-center cursor-pointer group px-4"
             onClick={() => {
                 setIsCalendarOpen(true);
                 setCalendarMonth(selectedDate);
             }}
          >
            <h2 className="font-medium text-lg flex items-center gap-2 tracking-widest text-white">
                {dateStr}
            </h2>
          </div>

          <button onClick={() => changeDate(1)} className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
            <ChevronRight size={20} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col items-center">
        <h3 className="text-sm font-medium text-primary tracking-widest mb-6 uppercase">熱量及三大營養素</h3>
        
        <div className="flex items-center justify-between w-full max-w-sm">
          {/* Donut Chart */}
          <div className="relative w-32 h-32 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={4}
                  isAnimationActive={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-primary">{Math.round(totalCalories)}</span>
              <span className="text-[10px] text-secondary">大卡</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-4 flex-1 ml-6">
            {/* Carbs */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                  <span className="text-sm text-secondary font-medium">醣類</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#ef4444] font-medium w-8 text-right">{carbPct}%</span>
                  <span className="text-sm text-primary font-medium w-10 text-right">{Math.round(totalCarbs)}g</span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-surface-hover rounded-full overflow-hidden">
                <div className="h-full bg-[#ef4444] transition-all" style={{ width: `${Math.min(carbRatio * 100, 100)}%` }}></div>
              </div>
            </div>
            {/* Protein */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#3b82f6]"></div>
                  <span className="text-sm text-secondary font-medium">蛋白質</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#3b82f6] font-medium w-8 text-right">{proteinPct}%</span>
                  <span className="text-sm text-primary font-medium w-10 text-right">{Math.round(totalProtein)}g</span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-surface-hover rounded-full overflow-hidden">
                <div className="h-full bg-[#3b82f6] transition-all" style={{ width: `${Math.min(proRatio * 100, 100)}%` }}></div>
              </div>
            </div>
            {/* Fat */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                  <span className="text-sm text-secondary font-medium">脂質</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#10b981] font-medium w-8 text-right">{fatPct}%</span>
                  <span className="text-sm text-primary font-medium w-10 text-right">{Math.round(totalFat)}g</span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-surface-hover rounded-full overflow-hidden">
                <div className="h-full bg-[#10b981] transition-all" style={{ width: `${Math.min(fatRatio * 100, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Calorie Progress Bar */}
        <div className="mt-8 w-full max-w-sm">
          <div className="flex justify-between items-end mb-2">
            <span className="text-xs text-secondary font-medium tracking-widest">卡路里目標</span>
            <span className={`text-xs font-bold ${calTextColor}`}>{calText}</span>
          </div>
          <div className="h-2.5 w-full bg-surface-hover rounded-full overflow-hidden relative">
            {/* Target Markers */}
            <div className="absolute top-0 bottom-0 left-[85%] w-0.5 bg-white/50 z-10"></div>
            <div className="absolute top-0 bottom-0 left-[100%] w-0.5 bg-white/50 z-10"></div>
            {/* Progress Fill */}
            <div 
              className={`h-full transition-all duration-500 ${calColor}`} 
              style={{ width: `${Math.min(calRatio * 100, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-secondary">{Math.round(totalCalories)} kcal</span>
            <span className="text-[10px] text-secondary">目標: {goals.calories} kcal</span>
          </div>
        </div>

        {/* Bottom Pill */}
        <div className="mt-6 bg-surface px-5 py-2.5 rounded-full flex items-center justify-center gap-6 text-xs text-secondary border border-border-color shadow-sm w-full max-w-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></div>
            <span className="tracking-wider">精緻糖 <span className="font-medium text-primary">0公克</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></div>
            <span className="tracking-wider">膳食纖維 <span className="font-medium text-primary">0公克</span></span>
          </div>
        </div>

        {/* Feedback */}
        {dailyFeedback && (
          <div className="mt-4 w-full max-w-sm bg-blue-50/50 border border-blue-100 p-3 rounded-xl flex items-start gap-3">
            <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-800 tracking-wide leading-relaxed">
              {dailyFeedback}
            </p>
          </div>
        )}
      </div>

      {/* List */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-4 bg-accent rounded-full"></div>
            <h3 className="font-medium text-sm text-secondary uppercase tracking-widest">Daily Log</h3>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-accent" size={32} strokeWidth={1.5} />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 bg-black text-white rounded-2xl border border-dashed border-border-color">
            <p className="font-light text-lg tracking-widest text-white">NO RECORDS</p>
            <p className="text-xs mt-2 opacity-80 tracking-wider text-white">Tap + to add an entry</p>
          </div>
        ) : (
          records.map((record) => {
            const styles = getMealStyles(record.mealType);
            const isExpanded = expandedRecordId === record.id;
            
            return (
                <div 
                  key={record.id} 
                  className={`p-4 rounded-2xl border border-border-color transition-all relative group ${styles}`}
                >
                    <div className="flex gap-4 cursor-pointer" onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}>
                        {record.imageUrl && (
                            <div className="w-20 h-20 flex-shrink-0 bg-surface border border-border-color rounded-xl overflow-hidden">
                                <img src={record.imageUrl} alt={record.description} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            </div>
                        )}
                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex gap-2 flex-wrap">
                                    <span className="text-[10px] text-secondary uppercase tracking-widest">
                                        {record.mealType}
                                    </span>
                                    {record.category && (
                                        <span className="text-[10px] text-secondary uppercase tracking-widest opacity-50">
                                            • {record.category}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] text-secondary tracking-widest">
                                    {new Date(record.timestamp).toLocaleTimeString('zh-HK', {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                            <h4 className="font-medium text-base text-primary leading-snug line-clamp-1">{record.description.split('\n')[0]}</h4>
                            
                            <div className="text-xs font-medium mt-3 flex gap-3 text-secondary flex-wrap">
                                <span className="tracking-wider">{record.nutrition.calories} <span className="text-[10px] opacity-50">KCAL</span></span>
                                <span className="tracking-wider">{record.nutrition.protein} <span className="text-[10px] opacity-50">G PRO</span></span>
                                <span className="tracking-wider">{record.nutrition.carbs || 0} <span className="text-[10px] opacity-50">G CARB</span></span>
                                <span className="tracking-wider">{record.nutrition.fat || 0} <span className="text-[10px] opacity-50">G FAT</span></span>
                            </div>

                            {record.confidence < 0.7 && (
                            <div className="mt-3 flex items-center gap-1 text-[10px] text-red-500 tracking-widest">
                                <AlertCircle size={12} strokeWidth={1.5} />
                                <span>LOW CONFIDENCE</span>
                            </div>
                            )}
                        </div>
                        <div className="flex items-center justify-center text-secondary opacity-50">
                            <ChevronDown size={20} strokeWidth={1.5} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                    {/* Dropdown content */}
                    {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border-color animate-fade-in">
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-bg-dark border border-border-color p-3 rounded-xl">
                                    <div className="text-[10px] text-secondary tracking-widest uppercase mb-1">Fiber</div>
                                    <div className="text-lg font-light text-primary">{record.nutrition.fiber || 0}<span className="text-xs text-secondary ml-1">g</span></div>
                                </div>
                                <div className="bg-bg-dark border border-border-color p-3 rounded-xl">
                                    <div className="text-[10px] text-secondary tracking-widest uppercase mb-1">Confidence</div>
                                    <div className="text-lg font-light text-primary">{Math.round(record.confidence * 100)}<span className="text-xs text-secondary ml-1">%</span></div>
                                </div>
                            </div>
                            {record.notes && (
                                <div className="bg-bg-dark border border-border-color p-3 rounded-xl text-xs text-secondary mb-4 flex items-start gap-2">
                                    <Info size={14} className="mt-0.5 flex-shrink-0 opacity-50" strokeWidth={1.5} />
                                    <span className="leading-relaxed">{record.notes}</span>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => openRecordDetail(record)}
                                    className="flex-1 bg-surface border border-border-color text-primary py-2.5 rounded-xl font-medium hover:bg-surface-hover transition-all text-xs tracking-widest uppercase"
                                >
                                    View Details
                                </button>
                                <button 
                                    onClick={() => {
                                        setViewingRecord(record);
                                        setDeleteState('confirm');
                                    }}
                                    className="px-4 bg-red-50 border border-red-200 text-red-600 py-2.5 rounded-xl font-medium hover:bg-red-100 transition-all text-xs tracking-widest uppercase flex items-center justify-center"
                                >
                                    <Trash2 size={14} strokeWidth={1.5} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )
          })
        )}
      </div>

      {/* DETAIL MODAL */}
      {viewingRecord && (
          <div className="fixed inset-0 bg-bg-dark/90 z-[100] flex items-center justify-center p-4 animate-fade-in backdrop-blur-md">
             <div className="bg-surface w-full max-w-sm rounded-3xl border border-border-color shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                 {/* Header */}
                 <div className="p-5 border-b border-border-color flex justify-between items-center">
                     <div className="flex items-center gap-3">
                        <span className="text-xs text-secondary tracking-widest uppercase">{viewingRecord.mealType}</span>
                        <span className="text-xs text-secondary/50 tracking-widest flex items-center gap-1">
                            <Clock size={12} strokeWidth={1.5} />
                            {new Date(viewingRecord.timestamp).toLocaleTimeString('zh-HK', {hour: '2-digit', minute:'2-digit'})}
                        </span>
                     </div>
                     <button onClick={closeRecordDetail} className="text-secondary hover:text-primary p-2 rounded-full hover:bg-surface-hover transition-colors">
                         <X size={20} strokeWidth={1.5} />
                     </button>
                 </div>

                 {/* Body */}
                 <div className="p-6 overflow-y-auto flex-1">
                    {viewingRecord.imageUrl && (
                        <div className="w-full h-48 bg-bg-dark rounded-2xl border border-border-color overflow-hidden mb-6">
                            <img src={viewingRecord.imageUrl} className="w-full h-full object-cover" alt="Food" />
                        </div>
                    )}
                    
                    <h3 className="font-medium text-xl mb-4 leading-snug text-primary">{viewingRecord.description}</h3>
                    
                    {viewingRecord.notes && (
                         <div className="bg-bg-dark border border-border-color p-4 rounded-xl text-sm text-secondary mb-6 flex items-start gap-3">
                             <Info size={16} className="mt-0.5 flex-shrink-0 opacity-50" strokeWidth={1.5} />
                             <span className="leading-relaxed">{viewingRecord.notes}</span>
                         </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mb-2">
                        <div className="bg-bg-dark border border-border-color p-4 rounded-2xl text-center">
                            <div className="text-[10px] text-secondary tracking-widest uppercase mb-1">Calories</div>
                            <div className="text-2xl font-light text-primary">{viewingRecord.nutrition.calories}</div>
                        </div>
                         <div className="bg-bg-dark border border-border-color p-4 rounded-2xl text-center">
                            <div className="text-[10px] text-secondary tracking-widest uppercase mb-1">Protein</div>
                            <div className="text-2xl font-light text-primary">{viewingRecord.nutrition.protein}<span className="text-sm text-secondary ml-1">g</span></div>
                        </div>
                        <div className="bg-bg-dark border border-border-color p-4 rounded-2xl text-center">
                            <div className="text-[10px] text-secondary tracking-widest uppercase mb-1">Carbs</div>
                            <div className="text-xl font-light text-primary">{viewingRecord.nutrition.carbs || 0}<span className="text-sm text-secondary ml-1">g</span></div>
                        </div>
                        <div className="bg-bg-dark border border-border-color p-4 rounded-2xl text-center">
                            <div className="text-[10px] text-secondary tracking-widest uppercase mb-1">Fat</div>
                            <div className="text-xl font-light text-primary">{viewingRecord.nutrition.fat || 0}<span className="text-sm text-secondary ml-1">g</span></div>
                        </div>
                        <div className="bg-bg-dark border border-border-color p-4 rounded-2xl text-center">
                            <div className="text-[10px] text-secondary tracking-widest uppercase mb-1">Fiber</div>
                            <div className="text-xl font-light text-primary">{viewingRecord.nutrition.fiber || 0}<span className="text-sm text-secondary ml-1">g</span></div>
                        </div>
                        <div className="bg-bg-dark border border-border-color p-4 rounded-2xl text-center">
                            <div className="text-[10px] text-secondary tracking-widest uppercase mb-1">Confidence</div>
                            <div className="text-xl font-light text-primary">{Math.round(viewingRecord.confidence * 100)}<span className="text-sm text-secondary ml-1">%</span></div>
                        </div>
                    </div>
                 </div>

                 {/* Footer Actions */}
                 <div className="p-5 border-t border-border-color bg-surface flex items-center justify-center">
                     {deleteState === 'idle' && (
                        <button 
                            onClick={handleDeleteClick}
                            className="w-full bg-bg-dark border border-border-color text-red-600 py-3.5 rounded-xl font-medium hover:bg-red-50 hover:border-red-200 transition-all flex items-center justify-center gap-2 text-sm tracking-widest"
                        >
                            <Trash2 size={16} strokeWidth={1.5} />
                            DELETE
                        </button>
                     )}

                     {deleteState === 'confirm' && (
                        <div className="flex gap-3 w-full animate-fade-in">
                            <button 
                                onClick={handleCancelDelete}
                                className="flex-1 bg-bg-dark border border-border-color text-secondary py-3.5 rounded-xl font-medium hover:text-primary transition-colors text-sm tracking-widest"
                            >
                                CANCEL
                            </button>
                            <button 
                                onClick={handleConfirmDelete}
                                className="flex-1 bg-red-50 border border-red-200 text-red-600 py-3.5 rounded-xl font-medium hover:bg-red-100 transition-all flex items-center justify-center gap-2 text-sm tracking-widest"
                            >
                                <Check size={16} strokeWidth={1.5} />
                                CONFIRM
                            </button>
                        </div>
                     )}

                     {deleteState === 'deleting' && (
                        <button 
                            disabled
                            className="w-full bg-bg-dark border border-border-color text-secondary py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 cursor-wait text-sm tracking-widest"
                        >
                            <Loader2 size={16} className="animate-spin" strokeWidth={1.5} />
                            DELETING...
                        </button>
                     )}
                 </div>
             </div>
          </div>
      )}
      
      <div className="text-center text-[10px] text-secondary/50 mt-12 pb-6 uppercase tracking-[0.2em]">
        Solo Nutrition
      </div>
    </div>
  );
};