import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { exportLocalData, importLocalData, clearLocalData, getDietRecordsByRange } from '../services/dbService';
import { getSheetConfig, saveSheetConfig, syncToAppsScript, SheetConfig, GAS_CODE_SNIPPET } from '../services/googleSheetsService';
import { Download, Upload, Trash2, CheckCircle, AlertTriangle, FileJson, Table, Loader2, Copy, Play, Check } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sheets Config State
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>({ scriptUrl: '' });
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const isGuest = user?.uid === 'guest-user';

  useEffect(() => {
    const saved = getSheetConfig();
    if (saved) setSheetConfig(saved);
  }, []);

  // --- Local Backup Handlers ---
  const handleExport = async () => {
    if (!isGuest) return;
    setLoading(true);
    setMsg(null);
    try {
      const json = await exportLocalData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `solonutrition-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMsg({ type: 'success', text: 'Backup downloaded successfully.' });
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Export failed: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    if (!window.confirm("Are you sure you want to import this file? It's recommended to backup current data first.")) {
        e.target.value = '';
        return;
    }

    setLoading(true);
    setMsg(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const content = ev.target?.result as string;
            const count = await importLocalData(content);
            setMsg({ type: 'success', text: `Successfully imported ${count} records.` });
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
            if (e.target) e.target.value = ''; // Reset
        }
    };
    reader.readAsText(file);
  };

  const handleClear = async () => {
      if (window.confirm("⚠️ WARNING: This will delete all local data and cannot be undone!\n\nAre you sure you want to proceed?")) {
          try {
              await clearLocalData();
              setMsg({ type: 'success', text: 'All data cleared.' });
          } catch(e) {
              setMsg({ type: 'error', text: 'Failed to clear data.' });
          }
      }
  }

  // --- Google Sheets (Apps Script) Handlers ---
  const handleSaveConfig = () => {
      // Basic validation
      if (sheetConfig.scriptUrl && !sheetConfig.scriptUrl.includes('script.google.com')) {
          alert('Please enter a valid Google Script URL (should contain script.google.com)');
          return;
      }
      saveSheetConfig(sheetConfig);
      setIsEditingConfig(false);
      setMsg({ type: 'success', text: 'Configuration saved.' });
  };

  const handleCopyCode = () => {
      navigator.clipboard.writeText(GAS_CODE_SNIPPET);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleSyncToSheets = async () => {
      if (!sheetConfig.scriptUrl) {
          setMsg({ type: 'error', text: 'Please configure Web App URL first.' });
          setIsEditingConfig(true);
          return;
      }
      
      setLoading(true);
      setMsg(null);
      
      try {
          if (!user) throw new Error("Not logged in");

          // Fetch Data (Last 30 days)
          const end = Date.now();
          const start = end - (30 * 24 * 60 * 60 * 1000);
          const records = await getDietRecordsByRange(user.uid, start, end);
          
          if (records.length === 0) {
              setMsg({ type: 'error', text: 'No records to sync (last 30 days).' });
              setLoading(false);
              return;
          }

          // Call App Script
          await syncToAppsScript(sheetConfig.scriptUrl, records);

          setMsg({ type: 'success', text: `Successfully synced ${records.length} records to Google Sheet!` });

      } catch (e: any) {
          console.error(e);
          setMsg({ type: 'error', text: e.message || 'Sync failed.' });
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <h2 className="text-xl font-light text-primary tracking-widest uppercase mb-8">Settings</h2>
      
      {isGuest && (
        <div className="glass-panel border-l-2 border-l-amber-500 p-5 rounded-2xl text-sm text-primary space-y-2">
            <div className="flex items-center gap-2 font-medium tracking-widest uppercase text-[10px] text-amber-500">
                <AlertTriangle size={14} strokeWidth={1.5} />
                <span>Local Mode Notice</span>
            </div>
            <p className="font-light tracking-wide text-secondary">
                Data is only stored in this browser. Please export backups regularly.
            </p>
        </div>
      )}

      {msg && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 font-light tracking-wide text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {msg.type === 'success' ? <CheckCircle size={18} strokeWidth={1.5} /> : <AlertTriangle size={18} strokeWidth={1.5} />}
              {msg.text}
          </div>
      )}

      {/* Google Sheets Integration (Apps Script Method) */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
         <div className="absolute -top-4 -right-4 p-2 opacity-5 text-emerald-500">
             <Table size={120} strokeWidth={1} />
         </div>

         <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="bg-surface p-3 rounded-xl text-emerald-500 border border-border-color">
                <Table size={20} strokeWidth={1.5} />
            </div>
            <div>
                <h3 className="font-medium text-primary tracking-widest uppercase text-sm">Sheets Sync</h3>
                <p className="text-[10px] text-secondary tracking-wider mt-1">Via Google Apps Script</p>
            </div>
        </div>

        {!isEditingConfig && sheetConfig.scriptUrl ? (
            <div className="space-y-4 relative z-10">
                <div className="text-xs bg-surface p-4 rounded-xl border border-border-color text-secondary font-light tracking-wide truncate">
                    <span className="font-medium text-primary uppercase tracking-widest text-[10px] mr-2">URL:</span> 
                    {sheetConfig.scriptUrl}
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleSyncToSheets}
                        disabled={loading}
                        className="flex-[2] bg-emerald-50 text-emerald-600 border border-emerald-200 py-3 rounded-xl font-medium text-xs tracking-widest uppercase hover:bg-emerald-100 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                         {loading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} strokeWidth={1.5} />}
                         Sync Now
                    </button>
                    <button 
                        onClick={() => setIsEditingConfig(true)}
                        className="flex-1 px-4 py-3 border border-border-color rounded-xl font-medium text-xs tracking-widest uppercase text-primary hover:bg-surface-hover transition-colors"
                    >
                        Edit
                    </button>
                </div>
            </div>
        ) : (
            <div className="space-y-5 relative z-10 animate-fade-in">
                
                {/* Setup Guide */}
                <div className="bg-surface rounded-xl p-5 text-xs space-y-4 border border-border-color">
                    <p className="font-medium flex items-center gap-2 text-primary tracking-widest uppercase text-[10px]">
                        <Play size={10} className="fill-accent text-accent" /> Setup Guide
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-secondary font-light tracking-wide leading-relaxed ml-1">
                        <li>Create a new Google Sheet in Google Drive.</li>
                        <li>Go to <strong>Extensions</strong> &gt; <strong>Apps Script</strong>.</li>
                        <li className="pt-2 pb-2">
                            <div className="flex justify-between items-center mb-2">
                                <span>Replace <code>Code.gs</code> with this code:</span>
                                <button 
                                    onClick={handleCopyCode}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-all text-[10px] uppercase tracking-widest font-medium ${copySuccess ? 'bg-green-50 text-green-600 border-green-200' : 'bg-bg-dark border-border-color text-primary hover:bg-surface-hover'}`}
                                >
                                    {copySuccess ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />} 
                                    {copySuccess ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <div className="bg-bg-dark text-secondary p-3 rounded-lg font-mono text-[10px] overflow-x-auto max-h-24 border border-border-color">
                                {GAS_CODE_SNIPPET.slice(0, 150)}...
                            </div>
                        </li>
                        <li>Click <strong>Deploy</strong> &gt; <strong>New deployment</strong>.</li>
                        <li>Select <strong>Web app</strong> from the gear icon.</li>
                        <li>
                            <ul className="list-disc list-inside ml-4 mt-1 text-primary font-medium">
                                <li>Execute as: <strong>Me</strong></li>
                                <li>Who has access: <strong>Anyone</strong></li>
                            </ul>
                        </li>
                        <li>Deploy and copy the <strong>Web app URL</strong>.</li>
                    </ol>
                </div>

                <div>
                    <label className="block text-[10px] font-medium text-secondary uppercase tracking-widest mb-2">Web App URL</label>
                    <input 
                        type="text" 
                        value={sheetConfig.scriptUrl}
                        onChange={(e) => setSheetConfig({...sheetConfig, scriptUrl: e.target.value})}
                        placeholder="https://script.google.com/macros/s/..."
                        className="w-full bg-surface border border-border-color rounded-xl p-4 text-sm font-mono text-primary focus:border-accent outline-none"
                    />
                </div>
                
                <div className="flex gap-3 pt-2">
                     <button 
                        onClick={() => setIsEditingConfig(false)}
                        className="flex-1 py-4 text-secondary font-medium tracking-widest uppercase text-xs hover:bg-surface rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveConfig}
                        className="flex-1 bg-accent text-bg-dark py-4 rounded-xl font-medium tracking-widest uppercase text-xs hover:opacity-90 transition-opacity"
                    >
                        Save
                    </button>
                </div>
            </div>
        )}
      </div>

      <div className="flex items-center gap-4 py-2">
          <div className="h-px bg-border-color flex-1"></div>
          <div className="text-[10px] text-secondary uppercase tracking-widest">Data Management</div>
          <div className="h-px bg-border-color flex-1"></div>
      </div>

      {/* Local Export (Only for Guest) */}
      {isGuest && (
      <>
        <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-4 mb-6">
                <div className="bg-surface p-3 rounded-xl text-blue-600 border border-border-color">
                    <Download size={20} strokeWidth={1.5} />
                </div>
                <div>
                    <h3 className="font-medium text-primary tracking-widest uppercase text-sm">Backup</h3>
                    <p className="text-[10px] text-secondary tracking-wider mt-1">Export to .json</p>
                </div>
            </div>
            <button 
                onClick={handleExport}
                disabled={loading}
                className="w-full bg-surface border border-border-color text-primary py-4 rounded-xl font-medium text-xs tracking-widest uppercase hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
                Download Backup
            </button>
        </div>

        <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-4 mb-6">
                <div className="bg-surface p-3 rounded-xl text-emerald-600 border border-border-color">
                    <Upload size={20} strokeWidth={1.5} />
                </div>
                <div>
                    <h3 className="font-medium text-primary tracking-widest uppercase text-sm">Restore</h3>
                    <p className="text-[10px] text-secondary tracking-wider mt-1">Import from .json</p>
                </div>
            </div>
            
            <label className="block w-full cursor-pointer">
                <div className="w-full bg-surface border border-dashed border-border-color text-secondary py-4 rounded-xl font-medium text-xs tracking-widest uppercase hover:text-primary hover:border-primary transition-colors text-center flex items-center justify-center gap-3">
                    <FileJson size={16} strokeWidth={1.5} />
                    <span>Select File</span>
                </div>
                <input 
                    type="file" 
                    accept=".json"
                    onChange={handleImport}
                    disabled={loading}
                    className="hidden"
                />
            </label>
        </div>
        
        <div className="glass-panel border border-red-200 p-6 rounded-2xl mt-8 opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-4 mb-6">
                <div className="bg-red-50 p-3 rounded-xl text-red-600 border border-red-200">
                    <Trash2 size={20} strokeWidth={1.5} />
                </div>
                <div>
                    <h3 className="font-medium text-red-600 tracking-widest uppercase text-sm">Danger Zone</h3>
                    <p className="text-[10px] text-red-500 tracking-wider mt-1">Clear all local data</p>
                </div>
            </div>
            <button 
                onClick={handleClear}
                disabled={loading}
                className="w-full border border-red-200 text-red-600 py-4 rounded-xl font-medium text-xs tracking-widest uppercase hover:bg-red-50 transition-colors"
            >
                Delete All Data
            </button>
        </div>
      </>
      )}

      {!isGuest && (
          <div className="text-center text-[10px] text-secondary py-8 uppercase tracking-widest font-light">
              Google Cloud Sync Active
          </div>
      )}

    </div>
  );
};