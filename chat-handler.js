// ============================================
// 💬 Chat Handler with Owner-Only Access
// ============================================

const AIManager = require('./ai-manager');
const MemoryManager = require('./memory-manager');
const config = require('./config');

class ChatHandler {
  constructor() {
    this.aiManager = new AIManager();
    this.memoryManager = new MemoryManager();
    this.activeSessions = new Map();
    this.commands = this.initializeCommands();
    this.ownerOnly = true; // Only owner can use
  }

  initializeCommands() {
    return {
      '/models': this.handleModels.bind(this),
      '/switch': this.handleSwitch.bind(this),
      '/clear': this.handleClear.bind(this),
      '/status': this.handleStatus.bind(this),
      '/compare': this.handleCompare.bind(this),
      '/agent': this.handleAgent.bind(this),
      '/context': this.handleContext.bind(this),
      '/preferences': this.handlePreferences.bind(this),
      '/help': this.handleHelp.bind(this),
      '/models': this.handleModels.bind(this),
      '/list': this.handleModels.bind(this),
      '/info': this.handleInfo.bind(this),
    };
  }

  async processMessage(senderId, message, options = {}) {
    // Check if it's a command
    if (message.startsWith('/')) {
      return await this.handleCommand(senderId, message);
    }

    // Get user's preferred model
    const modelName = this.getUserModel(senderId) || config.ai.defaultModel;
    
    // Get conversation context
    const context = this.memoryManager.getConversationContext(senderId);
    const messages = this.buildMessages(context, message);

    try {
      // Get AI response
      let response;
      if (this.agentMode) {
        response = await this.agentResponse(senderId, messages);
      } else {
        response = await this.aiManager.getAIResponse(modelName, messages, options);
      }

      // Save to memory
      this.memoryManager.addMessage(senderId, 'user', message);
      this.memoryManager.addMessage(senderId, 'assistant', response);

      return response;
    } catch (error) {
      console.error('❌ Chat processing error:', error.message);
      return '⚠️ I encountered an error processing your request. Please try again.';
    }
  }

  async handleCommand(senderId, command) {
    const [cmd, ...args] = command.split(' ');
    
    if (this.commands[cmd]) {
      return await this.commands[cmd](senderId, args);
    }
    
    return this.getHelpMessage();
  }

  async handleModels(senderId, args) {
    const models = this.aiManager.getAvailableModels();
    let response = '🤖 *Available AI Models*\n━━━━━━━━━━━━━━━━━━\n\n';
    
    for (const model of models) {
      const capabilities = this.aiManager.getModelCapabilities(model.id);
      const isDefault = model.id === config.ai.defaultModel;
      const isUser = this.getUserModel(senderId) === model.id;
      
      response += `${isUser ? '⭐ ' : ''}${isDefault ? '📌 ' : ''}*${model.name}*\n`;
      response += `  Provider: ${model.provider}\n`;
      response += `  Context: ${model.contextLength} tokens\n`;
      if (capabilities.length > 0) {
        response += `  Capabilities: ${capabilities.join(', ')}\n`;
      }
      response += `  ID: /switch ${model.id}\n\n`;
    }
    
    response += '━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    response += 'ℹ️ Use `/switch <model_id>` to change your model';
    return response;
  }

  async handleSwitch(senderId, args) {
    const modelId = args[0];
    if (!modelId) {
      return '⚠️ Please specify a model ID. Use `/models` to see available models.';
    }
    
    const models = this.aiManager.getAvailableModels();
    const model = models.find(m => m.id === modelId);
    if (!model) {
      return `❌ Model "${modelId}" not found. Use \`/models\` to see all models.`;
    }
    
    this.setUserModel(senderId, modelId);
    this.memoryManager.setPreference(senderId, 'preferredModel', modelId);
    
    return `✅ Switched to *${model.name}* (${model.provider})`;
  }

  async handleClear(senderId, args) {
    this.memoryManager.clearHistory(senderId);
    return '🧹 Conversation history cleared! Starting fresh.';
  }

  async handleStatus(senderId, args) {
    const modelName = this.getUserModel(senderId) || config.ai.defaultModel;
    const summary = this.memoryManager.summarizeMemory(senderId);
    const stats = this.memoryManager.getStats();
    const model = this.aiManager.models[modelName];
    
    let response = '📊 *Chat Status*\n━━━━━━━━━━━━━━━━━━\n\n';
    response += `🤖 Model: ${model?.name || 'Unknown'}\n`;
    response += `📚 Messages: ${summary.historyLength}\n`;
    response += `💬 Interactions: ${summary.totalInteractions}\n`;
    response += `⏰ Last Active: ${summary.lastActive}\n`;
    response += `📝 Context Size: ${this.memoryManager.contextSize}\n\n`;
    response += '━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    response += `ℹ️ Use \`/switch\` to change model\n`;
    response += `Use \`/clear\` to reset conversation`;
    
    return response;
  }

  async handleCompare(senderId, args) {
    const modelIds = args.length > 0 ? args : ['gpt-3.5', 'claude-3-haiku', 'gemini-pro'];
    const context = this.memoryManager.getConversationContext(senderId);
    const messages = this.buildMessages(context, 'Compare your response to: What are the key features of modern AI?');
    
    let response = '🔍 *Model Comparison*\n━━━━━━━━━━━━━━━━━━\n\n';
    
    try {
      const results = await this.aiManager.compareModels(modelIds, messages);
      
      for (const [id, result] of Object.entries(results)) {
        response += `*${result.model}* (${result.provider})\n`;
        if (result.response) {
          const truncated = result.response.length > 150 ? 
            result.response.substring(0, 150) + '...' : 
            result.response;
          response += `  ↳ ${truncated}\n`;
          response += `  ⏱️ ${result.time}ms\n\n`;
        } else {
          response += `  ❌ Error: ${result.error}\n\n`;
        }
      }
    } catch (error) {
      return '❌ Failed to compare models. Please try again.';
    }
    
    return response;
  }

  async handleAgent(senderId, args) {
    this.agentMode = !this.agentMode;
    return this.agentMode ? 
      '🤖 *Agent Mode ENABLED*\nI will now intelligently choose the best AI model for each task!' :
      '🤖 *Agent Mode DISABLED*\nUsing your selected model.';
  }

  async handleContext(senderId, args) {
    const context = this.memoryManager.getAllContext(senderId);
    const keys = Object.keys(context);
    
    if (keys.length === 0) {
      return '📭 No context data stored.';
    }
    
    let response = '📚 *Your Context*\n━━━━━━━━━━━━━━━━━━\n\n';
    for (const [key, value] of Object.entries(context)) {
      response += `📌 ${key}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}\n`;
    }
    return response;
  }

  async handlePreferences(senderId, args) {
    const preferences = this.memoryManager.getUserMemory(senderId).preferences;
    const keys = Object.keys(preferences);
    
    if (keys.length === 0) {
      return '📭 No preferences set.';
    }
    
    let response = '⚙️ *Your Preferences*\n━━━━━━━━━━━━━━━━━━\n\n';
    for (const [key, value] of Object.entries(preferences)) {
      response += `📌 ${key}: ${value}\n`;
    }
    return response;
  }

  async handleInfo(senderId, args) {
    const models = this.aiManager.getAvailableModels();
    const stats = this.memoryManager.getStats();
    
    return `
🤖 *AI Chatbot Info*
━━━━━━━━━━━━━━━━━━

📡 Models: ${models.length}
🧠 Default: ${config.ai.models[config.ai.defaultModel].name}
💾 Memory Users: ${stats.totalUsers}
💬 Total Interactions: ${stats.totalInteractions}
📚 Memory Usage: ${stats.totalMemorySize}

🔒 Private Mode: ACTIVE
👤 Owner-Only Access

━━━━━━━━━━━━━━━━━━
Type /help for commands
    `;
  }

  async handleHelp(senderId, args) {
    return this.getHelpMessage();
  }

  getHelpMessage() {
    return `
🤖 *AI Multi-Model Chatbot - Private Mode*
━━━━━━━━━━━━━━━━━━━━━━━━━

*📋 Available Commands:*

/models - List all AI models
/switch <id> - Change active model
/compare [models] - Compare multiple models
/agent - Toggle AI agent mode
/status - View chat statistics
/context - View stored context
/clear - Clear conversation
/preferences - View preferences
/info - Bot information
/help - Show this help

*💡 Features:*
✅ 10+ AI Models
✅ Smart Model Selection
✅ Conversation Memory
✅ Context Management
✅ Model Comparison
✅ Agent Mode
✅ Multi-Language Support
✅ Image & Media Support

*🌐 Available Models:*
GPT-4, GPT-3.5, Claude 3, Gemini,
DeepSeek, Mistral, Cohere, Groq,
Perplexity & more!

━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 This is a PRIVATE bot
👤 Only YOU can access it
💡 Just start chatting!
    `;
  }

  getUserModel(userId) {
    if (this.userModels.has(userId)) {
      return this.userModels.get(userId);
    }
    const preferred = this.memoryManager.getPreference(userId, 'preferredModel');
    if (preferred && this.aiManager.models[preferred]) {
      return preferred;
    }
    return config.ai.defaultModel;
  }

  setUserModel(userId, modelId) {
    this.userModels.set(userId, modelId);
  }

  async agentResponse(senderId, messages) {
    const task = this.detectTask(messages);
    const modelName = await this.aiManager.getBestModelForTask(task, messages);
    const model = this.aiManager.models[modelName];
    const response = await this.aiManager.getAIResponse(modelName, messages);
    return `*[Using ${model.name}]*\n\n${response}`;
  }

  detectTask(messages) {
    const fullText = messages.map(m => m.content).join(' ');
    
    if (fullText.includes('```') || fullText.includes('code') || 
        fullText.includes('function') || fullText.includes('class ')) {
      return 'code';
    }
    
    if (fullText.includes('image') || fullText.includes('picture') || 
        fullText.includes('photo') || fullText.includes('vision')) {
      return 'image';
    }
    
    if (fullText.length > 2000) {
      return 'long';
    }
    
    const nonEnglish = fullText.match(/[^\x00-\x7F]/g);
    if (nonEnglish && nonEnglish.length > 20) {
      return 'multilingual';
    }
    
    if (fullText.includes('quick') || fullText.includes('fast') || 
        fullText.includes('brief')) {
      return 'fast';
    }
    
    return 'default';
  }
}

module.exports = ChatHandler;
