import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { analyzeFood } from '../services/aiService';
import { saveDietRecord, getHistoryMenu } from '../services/dbService';
import { getSheetConfig, syncToAppsScript } from '../services/googleSheetsService';
import { fileToBase64, formatHKDate, formatHKDateTime } from '../utils';
import { DietRecord, LoadingState, NutritionData, MealType } from '../types';
import { Camera, Check, Loader2, AlertTriangle, X, Clock, Trash2, Plus, Edit2, Save, Sparkles, Utensils, Hash, Tag, Zap, BrainCircuit, RefreshCw, CopyPlus, ArrowRight, PenTool, Scale, Info } from 'lucide-react';

type CategoryKey = string;

export const AddEntry: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const [textInput, setTextInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 16)); 
  
  const [status, setStatus] = useState<LoadingState>('idle');
  const [analysisResults, setAnalysisResults] = useState<Partial<DietRecord>[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Mode Selection: 'fast' or 'pro'
  const [analysisMode, setAnalysisMode] = useState<'fast' | 'pro'>('fast');
  
  // Dynamic Menu State
  const [historyMenu, setHistoryMenu] = useState<Record<string, string[]>>({});
  // Updated: Map to Array of variations
  const [foodTemplates, setFoodTemplates] = useState<Record<string, Partial<DietRecord>[]>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Selection Modal State
  const [pendingHistoryItem, setPendingHistoryItem] = useState<Partial<DietRecord> | null>(null);
  // Variation Selection State
  const [variationOptions, setVariationOptions] = useState<Partial<DietRecord>[] | null>(null);
  const [selectedBaseName, setSelectedBaseName] = useState<string>('');

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<DietRecord>>({});

  useEffect(() => {
    if (user) {
        getHistoryMenu(user.uid).then(({ menu, templates }) => {
            setHistoryMenu(menu);
            setFoodTemplates(templates);
            
            // Sort categories: put '未分類' last
            const cats = Object.keys(menu).sort((a, b) => {
                if (a === '未分類') return 1;
                if (b === '未分類') return -1;
                return a.localeCompare(b);
            });
            setCategories(cats);
            if (cats.length > 0) setSelectedCategory(cats[0]);
        });
    }
  }, [user]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await fileToBase64(e.target.files[0]);
        setSelectedImage(base64);
        setAnalysisResults([]); 
        setStatus('idle');
      } catch (err) {
        console.error(err);
        alert('圖片讀取失敗');
      }
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setAnalysisResults([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Step 1: User clicks a history item (Base Name)
  const handleHistoryItemClick = (baseFoodName: string) => {
      const variations = foodTemplates[baseFoodName];
      
      if (!variations || variations.length === 0) {
          // Fallback just in case
          setTextInput(baseFoodName);
          return;
      }

      // If only 1 variation, skip variation selector and go straight to decision
      if (variations.length === 1) {
          setPendingHistoryItem(variations[0]);
      } else {
          // Show variation selector
          setSelectedBaseName(baseFoodName);
          setVariationOptions(variations);
      }
  };

  // Step 1.5: User picks a specific variation from the list
  const handleVariationSelect = (variant: Partial<DietRecord>) => {
      setVariationOptions(null);
      setPendingHistoryItem(variant);
  };

  // Step 2a: User chooses "Direct Use" (Instant)
  const confirmDirectAdd = () => {
    if (!pendingHistoryItem) return;
    
    const newRecord: Partial<DietRecord> = {
        ...pendingHistoryItem,
        notes: '📜 引用自歷史記錄' 
    };
    
    setAnalysisResults(prev => [...prev, newRecord]);
    if (status === 'idle') setStatus('success');
    
    setPendingHistoryItem(null);
  };

  // Step 2b: User chooses "Modify" (Fill input for AI)
  const confirmModify = () => {
      if (!pendingHistoryItem) return;
      
      // Use the specific description from the record (e.g. "Chicken 300g")
      const textToFill = pendingHistoryItem.description || '';

      // Fill the text input
      setTextInput(prev => {
          const val = prev.trim();
          if (!val) return textToFill;
          // Avoid duplicate appending if they clicked the same thing
          if (val.includes(textToFill)) return val;
          
          const lastChar = val.slice(-1);
          if (['、', ',', '，', ' ', '+'].includes(lastChar)) {
              return val + textToFill;
          }
          return `${val}、${textToFill}`;
      });

      setPendingHistoryItem(null);
      
      // Focus the text area so they can type "less rice" etc.
      setTimeout(() => {
          textInputRef.current?.focus();
      }, 100);
  };

  const handleAnalyze = async () => {
    if (!textInput && !selectedImage) {
      setErrorMsg("請輸入文字描述或上傳圖片");
      return;
    }

    setStatus('analyzing');
    setErrorMsg('');

    try {
      const results = await analyzeFood(
        textInput, 
        selectedImage || undefined,
        formatHKDateTime(new Date(selectedDate).getTime()),
        analysisMode // Pass the selected mode
      );

      const drafts = results.map(result => ({
        description: result.foodName,
        mealType: result.mealType, 
        nutrition: result.nutrition,
        confidence: result.confidence,
        notes: result.notes,
        category: result.category
      }));

      // Append new AI results to existing results (which might contain history items)
      setAnalysisResults(prev => [...prev, ...drafts]);
      
      // Clear inputs
      setTextInput('');
      
      setStatus('success'); 
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      if (e.message?.includes('Load failed') || e.message?.includes('Proxying failed')) {
          setErrorMsg("連線逾時或圖片過大。請嘗試切換至「⚡️ 快速模式」或壓縮圖片後再試。");
      } else {
          setErrorMsg(e.message || "AI 分析失敗，請稍後再試");
      }
    }
  };

  const removeItem = (index: number) => {
    const newResults = [...analysisResults];
    newResults.splice(index, 1);
    setAnalysisResults(newResults);
    if (newResults.length === 0) setStatus('idle');
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditForm(JSON.parse(JSON.stringify(analysisResults[index])));
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditForm({});
  };

  const saveEditing = () => {
    if (editingIndex === null) return;
    const updatedResults = [...analysisResults];
    updatedResults[editingIndex] = editForm;
    setAnalysisResults(updatedResults);
    setEditingIndex(null);
    setEditForm({});
  };

  const handleEditFormChange = (field: string, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleNutritionChange = (field: keyof NutritionData, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEditForm(prev => ({
      ...prev,
      nutrition: {
        ...prev.nutrition!,
        [field]: numValue
      }
    }));
  };

  const handleSave = async () => {
    if (!user || analysisResults.length === 0) return;
    setStatus('saving');
    
    try {
      const timestamp = new Date(selectedDate).getTime();
      const dateStr = formatHKDate(timestamp);
      
      // 1. Prepare data objects for saving
      const recordsToSave = analysisResults.map(item => {
          if (!item.nutrition || !item.description || !item.mealType) return null;
          
          return {
            userId: user.uid,
            timestamp: timestamp,
            dateStr: dateStr,
            mealType: item.mealType,
            description: item.description,
            category: item.category || '主餐',
            imageUrl: selectedImage || undefined, 
            nutrition: item.nutrition as NutritionData,
            confidence: item.confidence || 1,
            notes: item.notes || ''
          };
      }).filter(Boolean) as Omit<DietRecord, 'id' | 'createdAt'>[];

      if (recordsToSave.length === 0) return;

      // 2. Save to App Database (Firebase / IndexedDB)
      await Promise.all(recordsToSave.map(record => saveDietRecord(record)));

      // 3. Auto-Sync to Google Sheets (if configured)
      const sheetConfig = getSheetConfig();
      if (sheetConfig && sheetConfig.scriptUrl) {
          setStatus('syncing');
          try {
              const recordsForSheet: DietRecord[] = recordsToSave.map(r => ({
                  ...r,
                  id: 'temp-sync-id', 
                  createdAt: Date.now()
              }));

              await syncToAppsScript(sheetConfig.scriptUrl, recordsForSheet);
          } catch (syncError: any) {
              console.error("Auto-sync failed:", syncError);
              alert("記錄已儲存到 App，但同步到 Google Sheet 失敗：\n" + syncError.message);
          }
      }

      navigate('/');
    } catch (e) {
      console.error(e);
      setStatus('error');
      setErrorMsg('儲存失敗，請重試');
    }
  };

  const totalCalories = analysisResults.reduce((acc, curr) => acc + (curr.nutrition?.calories || 0), 0);
  const totalProtein = analysisResults.reduce((acc, curr) => acc + (curr.nutrition?.protein || 0), 0);

  return (
    <div className="space-y-6 pb-20 relative">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-1 h-5 bg-accent rounded-full"></div>
        <h2 className="text-xl font-medium text-primary tracking-widest uppercase">Add Entry</h2>
      </div>

      {/* 1. Date Time Picker */}
      <div className="glass-panel p-5 rounded-2xl">
        <label className="block text-[10px] font-medium text-secondary uppercase tracking-widest mb-2">Time</label>
        <input 
          type="datetime-local" 
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full bg-bg-dark border border-border-color focus:border-accent rounded-xl p-3 font-medium text-primary outline-none transition-colors"
        />
      </div>

      {/* 2. Input Section */}
      <div className="glass-panel p-5 rounded-2xl space-y-5">
        
        {/* Model Selection Toggle */}
        <div className="bg-bg-dark p-1 rounded-xl flex font-medium text-sm border border-border-color">
            <button 
                onClick={() => setAnalysisMode('fast')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all text-xs tracking-widest uppercase ${
                    analysisMode === 'fast' 
                    ? 'bg-surface text-primary shadow-md' 
                    : 'text-secondary hover:text-primary'
                }`}
            >
                <Zap size={14} className={analysisMode === 'fast' ? "text-accent" : ""} strokeWidth={1.5} />
                Fast
            </button>
            <button 
                onClick={() => setAnalysisMode('pro')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all text-xs tracking-widest uppercase ${
                    analysisMode === 'pro' 
                    ? 'bg-surface text-primary shadow-md' 
                    : 'text-secondary hover:text-primary'
                }`}
            >
                <BrainCircuit size={14} strokeWidth={1.5} />
                Pro
            </button>
        </div>

        <div>
          <label className="block text-[10px] font-medium text-secondary uppercase tracking-widest mb-2">Description</label>
          <textarea
            ref={textInputRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="e.g. 1 bowl of rice, 2 eggs..."
            className="w-full bg-bg-dark border border-border-color rounded-xl p-4 font-medium text-primary min-h-[100px] placeholder-secondary/50 focus:border-accent outline-none resize-none transition-colors"
            disabled={status === 'analyzing'}
          />
          
          {/* Dynamic Categorized Menu */}
          {(status === 'idle' || status === 'success') && (
              <div className="mt-5 pt-5 border-t border-border-color">
                <div className="flex items-center gap-2 text-[10px] font-medium text-secondary mb-3 uppercase tracking-widest">
                    <Clock size={12} strokeWidth={1.5} /> My Menu
                </div>
                
                {categories.length === 0 ? (
                    <div className="text-center py-6 bg-bg-dark rounded-xl border border-dashed border-border-color text-secondary text-xs font-light tracking-widest">
                        NO HISTORY<br/>
                        <span className="opacity-50 mt-1 block">Add an entry to build your menu</span>
                    </div>
                ) : (
                    <>
                        {/* Category Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-[10px] uppercase tracking-widest whitespace-nowrap transition-all
                                        ${selectedCategory === cat 
                                            ? 'bg-primary text-bg-dark border-primary' 
                                            : 'bg-bg-dark text-secondary border-border-color hover:border-primary hover:text-primary'
                                        }`}
                                >
                                    <Tag size={10} strokeWidth={1.5} />
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Grid Items */}
                        {selectedCategory && historyMenu[selectedCategory] && (
                             <div className="mt-3 grid grid-cols-2 gap-2">
                                {historyMenu[selectedCategory].map((item, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleHistoryItemClick(item)}
                                        className="bg-bg-dark hover:bg-surface border border-border-color text-primary text-xs font-medium py-3 px-2 rounded-xl transition-all truncate flex items-center justify-center gap-2 group"
                                    >
                                        <CopyPlus size={12} className="text-secondary group-hover:text-accent transition-colors" strokeWidth={1.5} />
                                        {item}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
              </div>
          )}

        </div>

        <div>
           <label className="block text-[10px] font-medium text-secondary uppercase tracking-widest mb-2">Photo</label>
          
          {!selectedImage ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-border-color hover:border-accent rounded-2xl p-8 flex flex-col items-center justify-center text-secondary hover:text-accent bg-bg-dark cursor-pointer transition-all gap-3"
            >
              <Camera size={24} strokeWidth={1.5} />
              <span className="text-xs uppercase tracking-widest font-medium">Tap to upload</span>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-border-color">
              <img src={selectedImage} alt="Preview" className="w-full h-48 object-cover" />
              <button 
                onClick={clearImage}
                className="absolute top-3 right-3 bg-bg-dark/80 backdrop-blur-md text-primary p-2 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors border border-border-color"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-600 font-medium rounded-xl flex items-center gap-3 text-sm leading-relaxed">
            <AlertTriangle size={18} className="shrink-0" strokeWidth={1.5} />
            {errorMsg}
          </div>
        )}

        {(status === 'idle' || status === 'error' || (status === 'success' && textInput.length > 0)) && (
          <button
            onClick={handleAnalyze}
            disabled={(!textInput && !selectedImage)}
            className="w-full bg-primary text-bg-dark py-4 rounded-xl font-medium text-sm uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2"
          >
            <Sparkles size={16} className="text-bg-dark" strokeWidth={1.5} />
            Analyze ({analysisMode === 'fast' ? 'Fast' : 'Pro'})
          </button>
        )}
        
        {status === 'analyzing' && (
           <button disabled className="w-full bg-bg-dark border border-border-color text-secondary py-4 rounded-xl font-medium text-sm uppercase tracking-widest flex items-center justify-center gap-3 cursor-wait">
             <Loader2 className="animate-spin" size={16} strokeWidth={1.5} />
             {analysisMode === 'fast' ? 'ANALYZING...' : 'THINKING...'}
           </button>
        )}
      </div>

      {/* 3. Review Section */}
      {analysisResults.length > 0 && status !== 'analyzing' && (
        <div className="animate-fade-in space-y-6 mt-8">
            
            <div className="flex justify-between items-end px-1 border-b border-border-color pb-3">
                <h3 className="font-medium text-sm text-secondary uppercase tracking-widest">Review ({analysisResults.length})</h3>
                <div className="text-right text-[10px] font-medium text-secondary tracking-widest uppercase space-y-1">
                    <div>CALORIES: <span className="text-primary ml-1">{Math.round(totalCalories)}</span></div>
                    <div>PROTEIN: <span className="text-primary ml-1">{Math.round(totalProtein)}g</span></div>
                </div>
            </div>

            <div className="space-y-4">
                {analysisResults.map((item, index) => {
                    const isHistoryItem = item.notes?.includes('歷史記錄');
                    
                    return (
                    <div key={index} className="glass-panel p-5 rounded-2xl border border-border-color relative group transition-all hover:bg-surface-hover">
                        <div className="absolute top-4 right-4 flex gap-2">
                            <button 
                                onClick={() => startEditing(index)}
                                className="p-2 rounded-full bg-bg-dark border border-border-color text-secondary hover:text-primary hover:border-primary transition-all"
                            >
                                <Edit2 size={14} strokeWidth={1.5} />
                            </button>
                            <button 
                                onClick={() => removeItem(index)}
                                className="p-2 rounded-full bg-bg-dark border border-border-color text-secondary hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
                            >
                                <Trash2 size={14} strokeWidth={1.5} />
                            </button>
                        </div>

                        <div onClick={() => startEditing(index)} className="cursor-pointer">
                            <div className="flex items-start gap-2 pr-20 flex-wrap mb-2">
                                <span className="text-[10px] text-primary uppercase tracking-widest">
                                    {item.mealType}
                                </span>
                                {item.category && (
                                     <span className="text-[10px] text-secondary uppercase tracking-widest opacity-50">
                                        • {item.category}
                                    </span>
                                )}
                                {isHistoryItem && (
                                    <span className="text-[10px] text-accent uppercase tracking-widest flex items-center gap-1 ml-2">
                                        <Clock size={10} strokeWidth={1.5} /> History
                                    </span>
                                )}
                            </div>
                            <h4 className="font-medium text-lg text-primary leading-snug">{item.description}</h4>
                            
                            <div className="grid grid-cols-4 gap-3 text-center bg-bg-dark p-3 rounded-xl mt-4 border border-border-color">
                                <div>
                                    <div className="text-[10px] text-secondary tracking-widest uppercase mb-1">Kcal</div>
                                    <div className="text-sm font-light text-primary">{item.nutrition?.calories}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-secondary tracking-widest uppercase mb-1">Prot</div>
                                    <div className="text-sm font-light text-primary">{item.nutrition?.protein}<span className="text-[10px] text-secondary ml-0.5">g</span></div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-secondary tracking-widest uppercase mb-1">Carb</div>
                                    <div className="text-sm font-light text-primary">{item.nutrition?.carbs}<span className="text-[10px] text-secondary ml-0.5">g</span></div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-secondary tracking-widest uppercase mb-1">Fat</div>
                                    <div className="text-sm font-light text-primary">{item.nutrition?.fat}<span className="text-[10px] text-secondary ml-0.5">g</span></div>
                                </div>
                            </div>
                            
                            {item.notes && (
                                <div className="text-xs mt-4 text-secondary flex items-start gap-2 bg-bg-dark p-3 rounded-xl border border-border-color">
                                    <Info size={14} className="mt-0.5 flex-shrink-0 opacity-50" strokeWidth={1.5} />
                                    <span className="leading-relaxed">{item.notes}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )})}
            </div>

            <button
              onClick={handleSave}
              disabled={status === 'saving' || status === 'syncing'}
              className="w-full bg-accent text-bg-dark py-4 rounded-xl font-medium text-sm uppercase tracking-widest hover:bg-accent/90 transition-all flex items-center justify-center gap-2 mt-6"
            >
              {status === 'saving' ? (
                  <>
                    <Loader2 className="animate-spin" size={16} strokeWidth={1.5} /> SAVING...
                  </>
              ) : status === 'syncing' ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} strokeWidth={1.5} /> SYNCING...
                  </>
              ) : (
                  <>
                    <Check size={16} strokeWidth={1.5} /> CONFIRM & SAVE
                  </>
              )}
            </button>
        </div>
      )}

      {/* Variation Selection Modal */}
      {variationOptions && (
          <div className="fixed inset-0 bg-bg-dark/90 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-md">
              <div className="bg-surface rounded-3xl w-full max-w-sm border border-border-color shadow-2xl flex flex-col overflow-hidden max-h-[80vh]">
                  <div className="p-5 border-b border-border-color flex justify-between items-center">
                    <div>
                        <div className="text-[10px] text-secondary uppercase tracking-widest mb-1">Select Variation</div>
                        <h3 className="font-medium text-lg text-primary leading-none">{selectedBaseName}</h3>
                    </div>
                    <button onClick={() => setVariationOptions(null)} className="p-2 rounded-full text-secondary hover:text-primary hover:bg-surface-hover transition-colors">
                        <X size={20} strokeWidth={1.5} />
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto space-y-3">
                    {variationOptions.map((variant, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleVariationSelect(variant)}
                            className="w-full text-left p-4 rounded-2xl border border-border-color bg-bg-dark hover:border-primary hover:bg-surface-hover transition-all flex justify-between items-center group"
                        >
                            <div className="overflow-hidden">
                                <div className="font-medium text-sm text-primary truncate">{variant.description}</div>
                                <div className="flex gap-3 mt-2 flex-wrap">
                                    <span className="text-[10px] text-secondary tracking-widest uppercase">
                                        <span className="text-primary">{variant.nutrition?.calories}</span> kcal
                                    </span>
                                    <span className="text-[10px] text-secondary tracking-widest uppercase">
                                        <span className="text-primary">{variant.nutrition?.protein}</span>g prot
                                    </span>
                                    <span className="text-[10px] text-secondary tracking-widest uppercase">
                                        <span className="text-primary">{variant.nutrition?.carbs || 0}</span>g carb
                                    </span>
                                    <span className="text-[10px] text-secondary tracking-widest uppercase">
                                        <span className="text-primary">{variant.nutrition?.fat || 0}</span>g fat
                                    </span>
                                </div>
                            </div>
                            <div className="text-secondary group-hover:text-accent transition-colors">
                                <ArrowRight size={16} strokeWidth={1.5} />
                            </div>
                        </button>
                    ))}
                </div>
              </div>
          </div>
      )}

      {/* Reuse Decision Modal */}
      {pendingHistoryItem && (
          <div className="fixed inset-0 bg-bg-dark/90 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-md">
             <div className="bg-surface rounded-3xl w-full max-w-sm border border-border-color shadow-2xl flex flex-col overflow-hidden">
                <div className="p-5 border-b border-border-color flex justify-between items-center">
                    <h3 className="font-medium text-sm text-secondary uppercase tracking-widest">History Item</h3>
                    <button onClick={() => setPendingHistoryItem(null)} className="p-2 rounded-full text-secondary hover:text-primary hover:bg-surface-hover transition-colors">
                        <X size={20} strokeWidth={1.5} />
                    </button>
                </div>
                <div className="p-6 text-center">
                    <h4 className="text-xl font-medium text-primary mb-3">{pendingHistoryItem.description}</h4>
                    <div className="text-xs text-secondary tracking-widest uppercase mb-8 flex justify-center gap-4">
                        <span><span className="text-primary">{pendingHistoryItem.nutrition?.calories}</span> kcal</span>
                        <span><span className="text-primary">{pendingHistoryItem.nutrition?.protein}</span>g prot</span>
                    </div>
                    
                    <div className="space-y-3">
                        <button 
                            onClick={confirmDirectAdd}
                            className="w-full bg-accent text-bg-dark py-3.5 rounded-xl font-medium text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-accent/90 transition-all"
                        >
                            <ArrowRight size={16} strokeWidth={1.5} />
                            Use Directly
                        </button>
                         <button 
                            onClick={confirmModify}
                            className="w-full bg-bg-dark border border-border-color text-primary py-3.5 rounded-xl font-medium text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-surface-hover transition-all"
                        >
                            <PenTool size={16} strokeWidth={1.5} />
                            Modify & Analyze
                        </button>
                    </div>
                </div>
             </div>
          </div>
      )}

      {/* Edit Modal */}
      {editingIndex !== null && (
          <div className="fixed inset-0 bg-bg-dark/90 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-md">
              <div className="bg-surface rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-border-color shadow-2xl flex flex-col">
                  <div className="p-5 border-b border-border-color flex justify-between items-center">
                      <h3 className="font-medium text-sm text-secondary uppercase tracking-widest">Edit Entry</h3>
                      <button onClick={cancelEditing} className="p-2 rounded-full text-secondary hover:text-primary hover:bg-surface-hover transition-colors">
                          <X size={20} strokeWidth={1.5} />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-5">
                      <div>
                          <label className="block text-[10px] font-medium text-secondary uppercase tracking-widest mb-2">Name</label>
                          <input 
                              type="text"
                              value={editForm.description || ''}
                              onChange={(e) => handleEditFormChange('description', e.target.value)}
                              className="w-full bg-bg-dark border border-border-color rounded-xl p-3 font-medium text-primary focus:border-accent outline-none transition-colors"
                          />
                      </div>
                      
                      <div>
                          <label className="block text-[10px] font-medium text-secondary uppercase tracking-widest mb-2">Category</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                              {['主餐', '甜品', '小食', '飲品', '補充劑'].map(cat => (
                                  <button
                                      key={cat}
                                      onClick={() => handleEditFormChange('category', cat)}
                                      className={`text-xs px-4 py-2 rounded-full border tracking-widest uppercase transition-all ${
                                          editForm.category === cat 
                                          ? 'bg-primary text-bg-dark border-primary' 
                                          : 'bg-bg-dark text-secondary border-border-color hover:border-primary hover:text-primary'
                                      }`}
                                  >
                                      {cat}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div>
                          <label className="block text-[10px] font-medium text-secondary uppercase tracking-widest mb-2">Type</label>
                          <select 
                              value={editForm.mealType || MealType.SNACK}
                              onChange={(e) => handleEditFormChange('mealType', e.target.value)}
                              className="w-full bg-bg-dark border border-border-color rounded-xl p-3 font-medium text-primary focus:border-accent outline-none transition-colors appearance-none"
                          >
                              {Object.values(MealType).map(type => (
                                  <option key={type} value={type}>{type}</option>
                              ))}
                          </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[10px] font-medium text-secondary uppercase tracking-widest mb-2">Calories</label>
                              <input 
                                  type="number"
                                  value={editForm.nutrition?.calories || 0}
                                  onChange={(e) => handleNutritionChange('calories', e.target.value)}
                                  className="w-full bg-bg-dark border border-border-color rounded-xl p-3 font-medium text-primary focus:border-accent outline-none transition-colors"
                              />
                          </div>
                           <div>
                              <label className="block text-[10px] font-medium text-secondary uppercase tracking-widest mb-2">Protein (g)</label>
                              <input 
                                  type="number"
                                  value={editForm.nutrition?.protein || 0}
                                  onChange={(e) => handleNutritionChange('protein', e.target.value)}
                                  className="w-full bg-bg-dark border border-border-color rounded-xl p-3 font-medium text-primary focus:border-accent outline-none transition-colors"
                              />
                          </div>
                          <div>
                              <label className="block text-[10px] font-medium text-secondary uppercase tracking-widest mb-2">Carbs (g)</label>
                              <input 
                                  type="number"
                                  value={editForm.nutrition?.carbs || 0}
                                  onChange={(e) => handleNutritionChange('carbs', e.target.value)}
                                  className="w-full bg-bg-dark border border-border-color rounded-xl p-3 font-medium text-primary focus:border-accent outline-none transition-colors"
                              />
                          </div>
                           <div>
                              <label className="block text-[10px] font-medium text-secondary uppercase tracking-widest mb-2">Fat (g)</label>
                              <input 
                                  type="number"
                                  value={editForm.nutrition?.fat || 0}
                                  onChange={(e) => handleNutritionChange('fat', e.target.value)}
                                  className="w-full bg-bg-dark border border-border-color rounded-xl p-3 font-medium text-primary focus:border-accent outline-none transition-colors"
                              />
                          </div>
                      </div>

                      <div>
                          <label className="block text-[10px] font-medium text-secondary uppercase tracking-widest mb-2">Note</label>
                          <textarea
                              value={editForm.notes || ''}
                              onChange={(e) => handleEditFormChange('notes', e.target.value)}
                              rows={2}
                              className="w-full bg-bg-dark border border-border-color rounded-xl p-3 font-medium text-primary focus:border-accent outline-none resize-none transition-colors"
                          />
                      </div>
                  </div>

                  <div className="p-5 border-t border-border-color flex gap-3 bg-surface">
                      <button 
                          onClick={cancelEditing}
                          className="flex-1 py-3.5 bg-bg-dark text-secondary border border-border-color hover:text-primary rounded-xl font-medium text-sm tracking-widest uppercase transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={saveEditing}
                          className="flex-1 py-3.5 bg-primary text-bg-dark rounded-xl font-medium text-sm tracking-widest uppercase hover:bg-primary/90 transition-all flex justify-center items-center gap-2"
                      >
                          <Save size={16} strokeWidth={1.5} />
                          Update
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};