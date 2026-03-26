import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, collection, addDoc, query, where, getDocs, Timestamp, orderBy, limit, deleteDoc, doc } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { IS_DEMO_MODE } from "../constants";
import { DietRecord, UserProfile } from "../types";

export const mapCategory = (cat: string): string => {
    const valid = ['主餐', '甜品', '小食', '飲品', '補充劑'];
    if (valid.includes(cat)) return cat;
    if (cat.includes('飲') || cat.includes('水') || cat.includes('茶') || cat.includes('啡') || cat.includes('奶') || cat.includes('酒')) return '飲品';
    if (cat.includes('甜') || cat.includes('糕') || cat.includes('糖') || cat.includes('冰')) return '甜品';
    if (cat.includes('零食') || cat.includes('餅') || cat.includes('點心') || cat.includes('果')) return '小食';
    if (cat.includes('粉') || cat.includes('丸') || cat.includes('維他命') || cat.includes('蛋白') || cat.includes('補')) return '補充劑';
    return '主餐';
};

// --- IndexedDB Configuration (Robust Local Storage) ---
const DB_NAME = 'SmartDietDB';
const STORE_NAME = 'diet_records';
const DB_VERSION = 1;

// Helper to open DB with error handling
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
        reject(new Error("Your browser does not support IndexedDB"));
        return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
        console.error("IndexedDB Open Error:", request.error);
        reject(request.error);
    };
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('dateStr', 'dateStr', { unique: false });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
  });
};

// IndexedDB Operations
const idb = {
  add: async (record: DietRecord) => {
    try {
        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(record);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("IndexedDB Add Error", e);
        throw e;
    }
  },
  getAll: async () => {
    try {
        const db = await openDB();
        return new Promise<DietRecord[]>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("IndexedDB GetAll Error", e);
        return [];
    }
  },
  delete: async (id: string) => {
    try {
        const db = await openDB();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.error("IndexedDB Delete Error", e);
        throw e;
    }
  }
};

// --- Backup & Restore Functions (Local Mode) ---

export const exportLocalData = async (): Promise<string> => {
    const records = await idb.getAll();
    const backupData = {
        version: 1,
        timestamp: Date.now(),
        records: records
    };
    return JSON.stringify(backupData, null, 2);
};

export const importLocalData = async (jsonString: string): Promise<number> => {
    try {
        const data = JSON.parse(jsonString);
        
        // Basic Validation
        if (!data.records || !Array.isArray(data.records)) {
             throw new Error("無效的備份檔案格式");
        }

        const records = data.records as DietRecord[];
        let count = 0;
        
        // Use a simple loop to insert
        for (const record of records) {
             // Ensure it has minimal valid fields
             if (record.id && record.dateStr) {
                 await idb.add(record);
                 count++;
             }
        }
        return count;
    } catch (e) {
        console.error("Import error:", e);
        throw new Error("匯入失敗，請確認檔案正確");
    }
};

export const clearLocalData = async (): Promise<void> => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
};


// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

let auth: any;
let db: any;
let storage: any;

// Only init Firebase if config exists and NOT in demo mode
if (!IS_DEMO_MODE && process.env.REACT_APP_FIREBASE_API_KEY) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (e) {
    console.warn("Firebase init failed, falling back to local mode", e);
  }
}

// --- Auth Functions ---

const GUEST_USER: UserProfile = {
  uid: 'guest-user',
  displayName: '本機使用者',
  email: null,
  photoURL: null
};

export const signInGuest = async (): Promise<UserProfile> => {
  localStorage.setItem('auth_mode', 'guest');
  return GUEST_USER;
};

export const signInWithGoogle = async (): Promise<UserProfile> => {
  // If in pure demo mode without firebase keys
  if (IS_DEMO_MODE || !auth) {
    throw new Error("未設定 Firebase。請使用本機模式。");
  }

  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  localStorage.setItem('auth_mode', 'firebase');
  return {
    uid: result.user.uid,
    displayName: result.user.displayName,
    email: result.user.email,
    photoURL: result.user.photoURL
  };
};

export const signOutUser = async (): Promise<void> => {
  const mode = localStorage.getItem('auth_mode');
  localStorage.removeItem('auth_mode');

  if (mode === 'firebase' && auth) {
    await firebaseSignOut(auth);
  }
};

export const subscribeToAuth = (callback: (user: UserProfile | null) => void) => {
  const mode = localStorage.getItem('auth_mode');

  if (mode === 'guest') {
    callback(GUEST_USER);
    return () => {};
  }

  if (auth) {
    return onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        callback({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        });
      } else {
        callback(null);
      }
    });
  }

  callback(null);
  return () => {};
};

// --- Data Functions ---

export const saveDietRecord = async (record: Omit<DietRecord, 'id' | 'createdAt'>): Promise<void> => {
  const mode = localStorage.getItem('auth_mode');
  
  // Use IndexedDB if guest mode OR firebase db is not initialized
  if (mode === 'guest' || !db) {
    const newRecord: DietRecord = {
        ...record,
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
        createdAt: Date.now()
    };
    await idb.add(newRecord);
    return;
  }

  // Firebase Logic
  try {
      let finalImageUrl = record.imageUrl;
      if (record.imageUrl && record.imageUrl.startsWith('data:')) {
        const storageRef = ref(storage, `images/${record.userId}/${Date.now()}.jpg`);
        await uploadString(storageRef, record.imageUrl, 'data_url');
        finalImageUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, "diet_records"), {
        ...record,
        imageUrl: finalImageUrl || null,
        createdAt: Timestamp.now()
      });
  } catch (error) {
      console.error("Firebase save failed", error);
      throw new Error("雲端儲存失敗，請檢查網絡或切換至本機模式");
  }
};

export const deleteDietRecord = async (userId: string, recordId: string): Promise<void> => {
    const mode = localStorage.getItem('auth_mode');

    // Use IndexedDB
    if (mode === 'guest' || !db) {
        await idb.delete(recordId);
        return;
    }

    // Firebase Logic
    try {
        // NOTE: We are intentionally NOT deleting the image from Storage here to simplify the demo.
        // In a full production app, you would also delete the object at record.imageUrl
        await deleteDoc(doc(db, "diet_records", recordId));
    } catch (error) {
        console.error("Firebase delete failed", error);
        throw new Error("刪除失敗，請檢查網絡");
    }
};

export const getDietRecordsByDate = async (userId: string, dateStr: string): Promise<DietRecord[]> => {
  const mode = localStorage.getItem('auth_mode');

  if (mode === 'guest' || !db) {
    const all = await idb.getAll();
    return all
      .filter(r => r.dateStr === dateStr)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(r => ({ ...r, category: mapCategory(r.category || '主餐') }));
  }

  const q = query(
    collection(db, "diet_records"),
    where("userId", "==", userId),
    where("dateStr", "==", dateStr),
    orderBy("timestamp", "asc")
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      category: mapCategory(data.category || '主餐')
    };
  }) as DietRecord[];
};

export const getDietRecordsByRange = async (userId: string, startTimestamp: number, endTimestamp: number): Promise<DietRecord[]> => {
    const mode = localStorage.getItem('auth_mode');

    if (mode === 'guest' || !db) {
        const all = await idb.getAll();
        return all
          .filter(r => r.timestamp >= startTimestamp && r.timestamp <= endTimestamp)
          .sort((a, b) => a.timestamp - b.timestamp)
          .map(r => ({ ...r, category: mapCategory(r.category || '主餐') }));
    }
  
    const q = query(
        collection(db, "diet_records"),
        where("userId", "==", userId),
        where("timestamp", ">=", startTimestamp),
        where("timestamp", "<=", endTimestamp),
        orderBy("timestamp", "asc")
      );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            category: mapCategory(data.category || '主餐')
        };
    }) as DietRecord[];
  };

/**
 * Helper to strip specific portion info (numbers, 'g', 'ml', 'pcs', etc.) from the end of a string
 * to find the "Base Name".
 * E.g., "Grilled Chicken 300g" -> "Grilled Chicken"
 * E.g., "白切雞 (200克)" -> "白切雞"
 */
const getBaseFoodName = (name: string): string => {
    // 1. Remove brackets content if it contains digits: "Food (200g)" -> "Food"
    let clean = name.replace(/[\(（].*?\d+.*?[）\)]/g, '');
    
    // 2. Remove trailing numbers + units
    // Matches: space + digits + optional unit (g, ml, oz, lb, kg, pcs, 隻, 克, 碗, 杯)
    clean = clean.replace(/\s*\d+\s*(g|ml|oz|lb|kg|pcs|pc|隻|克|碗|杯|件)?\s*$/i, '');
    
    // 3. Remove punctuation at end
    clean = clean.replace(/[，。、,. \-]+$/, '');
    
    return clean.trim();
};

/**
 * Returns:
 * 1. menu: Categorized base food names (for the UI pills)
 * 2. templates: Map of 'Base Food Name' -> Array of Variation Records
 */
export const getHistoryMenu = async (userId: string): Promise<{
    menu: Record<string, string[]>;
    templates: Record<string, Partial<DietRecord>[]>;
}> => {
    const mode = localStorage.getItem('auth_mode');
    const ANALYZE_COUNT = 200; // Increased limit to find more variations
  
    let docs: DietRecord[] = [];
  
    if (mode === 'guest' || !db) {
      const all = await idb.getAll();
      docs = all.sort((a, b) => b.timestamp - a.timestamp).slice(0, ANALYZE_COUNT);
    } else {
      const q = query(
          collection(db, "diet_records"),
          where("userId", "==", userId),
          orderBy("timestamp", "desc"),
          limit(ANALYZE_COUNT)
        );
      const snapshot = await getDocs(q);
      docs = snapshot.docs.map(d => d.data() as DietRecord);
    }

    // Processing:
    const freqMap: Record<string, number> = {};
    const catMap: Record<string, string> = {};
    // Map BaseName -> List of unique records (variations)
    const templates: Record<string, Partial<DietRecord>[]> = {};

    docs.forEach(d => {
        const originalName = d.description ? d.description.split('\n')[0].trim() : '';
        if (!originalName) return;
        
        // Identify Base Name (e.g., "Chicken 300g" -> "Chicken")
        const baseName = getBaseFoodName(originalName);

        // 1. Frequency (count by base name)
        freqMap[baseName] = (freqMap[baseName] || 0) + 1;
        
        // 2. Category mapping (prefer most recent valid)
        const category = mapCategory(d.category || '主餐');
        if (!catMap[baseName]) {
             catMap[baseName] = category;
        }

        // 3. Store Variations
        if (!templates[baseName]) {
            templates[baseName] = [];
        }

        const variations = templates[baseName];
        
        // Check if this specific nutrient profile already exists in variations
        // We consider it a "duplicate variation" if calories are very close (+- 5) AND description is similar
        const isDuplicate = variations.some(v => {
            const calDiff = Math.abs((v.nutrition?.calories || 0) - d.nutrition.calories);
            return calDiff < 5 && v.description === originalName;
        });

        if (!isDuplicate) {
            // Add as new variation
            // We limit variations to 5 per base food to avoid clutter
            if (variations.length < 5) {
                variations.push({
                    description: originalName, // Keep original specific name here
                    nutrition: d.nutrition,
                    category: category,
                    mealType: d.mealType,
                    notes: '根據歷史記錄自動填入' 
                });
            }
        }
    });

    // Group by Category
    const grouped: Record<string, string[]> = {};
    
    Object.keys(freqMap).forEach(baseName => {
        const cat = catMap[baseName];
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(baseName);
    });

    // Sort items within each category by frequency
    Object.keys(grouped).forEach(cat => {
        grouped[cat].sort((a, b) => freqMap[b] - freqMap[a]);
        // Limit to top 10 per category
        grouped[cat] = grouped[cat].slice(0, 10);
    });

    return { menu: grouped, templates: templates };
};

export const getMonthlyStats = async (userId: string, year: number, month: number): Promise<Record<string, number>> => {
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 0, 23, 59, 59).getTime();
  const records = await getDietRecordsByRange(userId, start, end);
  const stats: Record<string, number> = {};
  records.forEach(r => {
    const date = r.dateStr;
    if (!stats[date]) stats[date] = 0;
    stats[date] += r.nutrition.calories;
  });
  return stats;
};