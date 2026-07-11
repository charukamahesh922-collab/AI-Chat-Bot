// ============================================
// 🔒 Private AI Chatbot - Configuration
// ============================================

require('dotenv').config();

module.exports = {
  // WhatsApp Configuration
  whatsapp: {
    // These are not needed - owner is determined from QR scan
    ownerJid: null, // Auto-detected from QR
    adminJids: [], // Auto-detected from QR
  },

  // AI Model Configuration
  ai: {
    models: {
      'gpt-4': {
        name: 'GPT-4',
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4-turbo-preview',
        contextLength: 128000,
        costPerToken: 0.00003,
      },
      'gpt-3.5': {
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-3.5-turbo',
        contextLength: 16385,
        costPerToken: 0.0000015,
      },
      'claude-3': {
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        endpoint: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-opus-20240229',
        contextLength: 200000,
      },
      'claude-3-sonnet': {
        name: 'Claude 3 Sonnet',
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        endpoint: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-sonnet-20240229',
        contextLength: 200000,
      },
      'claude-3-haiku': {
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        endpoint: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-haiku-20240307',
        contextLength: 200000,
      },
      'gemini-pro': {
        name: 'Gemini Pro',
        provider: 'google',
        apiKey: process.env.GOOGLE_API_KEY,
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        model: 'gemini-pro',
        contextLength: 32768,
      },
      'deepseek-coder': {
        name: 'DeepSeek Coder',
        provider: 'deepseek',
        apiKey: process.env.DEEPSEEK_API_KEY,
        endpoint: 'https://api.deepseek.com/v1/chat/completions',
        model: 'deepseek-coder-6.7b-instruct',
        contextLength: 16384,
      },
      'mistral-large': {
        name: 'Mistral Large',
        provider: 'mistral',
        apiKey: process.env.MISTRAL_API_KEY,
        endpoint: 'https://api.mistral.ai/v1/chat/completions',
        model: 'mistral-large-latest',
        contextLength: 32768,
      },
      'cohere-command': {
        name: 'Cohere Command',
        provider: 'cohere',
        apiKey: process.env.COHERE_API_KEY,
        endpoint: 'https://api.cohere.ai/v1/chat',
        model: 'command-r',
        contextLength: 128000,
      },
      'groq-llama': {
        name: 'Groq Llama 3',
        provider: 'groq',
        apiKey: process.env.GROQ_API_KEY,
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama3-70b-8192',
        contextLength: 8192,
      },
    },

    defaultModel: 'gpt-3.5',
    fallbackModels: ['gpt-3.5', 'claude-3-haiku', 'gemini-pro'],
    
    capabilities: {
      'image-analysis': ['gpt-4', 'claude-3', 'gemini-pro'],
      'code-generation': ['deepseek-coder', 'gpt-4', 'claude-3', 'groq-llama'],
      'long-context': ['claude-3', 'claude-3-sonnet', 'cohere-command'],
      'fast-response': ['groq-llama', 'mistral-large'],
      'multilingual': ['gpt-4', 'claude-3', 'gemini-pro', 'mistral-large'],
    },
  },

  // Memory Settings
  memory: {
    maxHistory: 100,
    contextMemory: 10,
    saveInterval: 60000,
    storageDir: './memory',
  },

  // Private Mode Settings
  privateMode: {
    enabled: true,
    autoReply: true,
    ignoreNonOwner: true, // Completely ignore non-owner
    showQROnly: true,
  },

  // Bot Features
  features: {
    webSearch: true,
    imageGeneration: true,
    voiceSupport: true,
    fileUpload: true,
    multiModelChat: true,
    modelSwitching: true,
    aiAgentMode: true,
  },

  // Rate Limiting
  rateLimit: {
    maxRequestsPerMinute: 30,
    maxRequestsPerDay: 1000,
  },
};
