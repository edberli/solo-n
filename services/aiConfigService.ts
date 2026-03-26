import { AI_PROVIDERS } from '../constants';

export interface AIConfig {
  provider: string;
  geminiApiKey: string;
  bailianApiKey: string;
  bailianBaseUrl?: string;
  moonshotApiKey?: string;
  moonshotBaseUrl?: string;
  moonshotModel?: string;
}

const CONFIG_KEY = 'smartdiet_ai_config';

export const getAIConfig = (): AIConfig => {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.bailianBaseUrl) {
        parsed.bailianBaseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
      }
      if (!parsed.moonshotBaseUrl) {
        parsed.moonshotBaseUrl = 'https://api.moonshot.cn/v1';
      }
      if (!parsed.moonshotApiKey) {
        parsed.moonshotApiKey = '';
      }
      if (!parsed.moonshotModel || parsed.moonshotModel === 'moonshot-v1-k2.5' || parsed.moonshotModel === 'moonshot-v1-32k') {
        parsed.moonshotModel = 'kimi-k2.5';
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load AI config', e);
  }
  
  // Default config
  return {
    provider: AI_PROVIDERS.GEMINI,
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    bailianApiKey: '',
    bailianBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    moonshotApiKey: '',
    moonshotBaseUrl: 'https://api.moonshot.cn/v1',
    moonshotModel: 'kimi-k2.5'
  };
};

export const saveAIConfig = (config: AIConfig) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};
