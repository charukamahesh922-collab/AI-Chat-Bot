// ============================================
// 🔒 Private AI Multi-Model Chatbot
// 👨‍💻 Only QR Scanner Can Access
// ============================================

const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const ChatHandler = require('./chat-handler');
const AuthManager = require('./auth-manager');
const config = require('./config');

class PrivateAIChatbot {
  constructor() {
    this.sock = null;
    this.isConnected = false;
    this.chatHandler = new ChatHandler();
    this.authManager = new AuthManager();
    this.reconnectAttempts = 0;
    this.isShuttingDown = false;
    this.qrScanned = false;
    this.ownerJid = null;
  }

  async start() {
    console.log('🔒 Private AI Multi-Model Chatbot');
    console.log('━'.repeat(40));
    console.log('📡 Scanning QR Code to link WhatsApp...');
    console.log('🔐 Only the person who scans QR can access the bot');
    console.log('━'.repeat(40));

    await this.initializeWhatsApp();
    this.setupAutoTasks();
  }

  async initializeWhatsApp() {
    if (this.sock) return;

    const authFolder = path.join(__dirname, 'auth_info_baileys');
    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    this.sock = makeWASocket({
      auth: state,
      browser: ['PrivateAIBot', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
      connectTimeoutMs: 30000,
      qrTimeout: 0,
    });

    this.setupEventHandlers(saveCreds);
  }

  setupEventHandlers(saveCreds) {
    // Connection updates
    this.sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log('📱 Scan QR Code with WhatsApp:');
        qrcode.generate(qr, { small: true });
        console.log('🔐 After scanning, this bot will be private to YOU only');
        this.qrScanned = false;
      }

      if (connection === 'close') {
        this.isConnected = false;
        this.sock = null;
        
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut && !this.isShuttingDown) {
          const delay = Math.min(30000, 5000 * (this.reconnectAttempts + 1));
          this.reconnectAttempts++;
          console.log(`🔄 Reconnecting in ${delay/1000}s... (Attempt ${this.reconnectAttempts})`);
          setTimeout(() => this.initializeWhatsApp(), delay);
        } else if (code === DisconnectReason.loggedOut) {
          console.log('🚫 Logged out. Please restart and scan QR again.');
        }
      } else if (connection === 'open') {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Update owner info
        if (this.sock.user) {
          this.ownerJid = this.sock.user.id;
          this.authManager.updateOwnerInfo({ me: this.sock.user });
          this.qrScanned = true;
          
          console.log('✅ WhatsApp Connected Successfully!');
          console.log(`🔐 Owner JID: ${this.ownerJid}`);
          console.log('━'.repeat(40));
          console.log('🎯 Bot is now PRIVATE - Only YOU can use it!');
          console.log('📱 Send messages to this number to chat with AI');
          console.log('━'.repeat(40));
          
          await this.sendStartupMessage();
        }
      }
    });

    // Credentials update
    this.sock.ev.on('creds.update', (creds) => {
      saveCreds();
      if (creds.me) {
        this.authManager.updateOwnerInfo(creds);
        this.ownerJid = creds.me.id;
      }
    });

    // Message handler
    this.sock.ev.on('messages.upsert', async (m) => {
      if (!this.isConnected) return;
      
      for (const msg of m.messages) {
        await this.handleMessage(msg);
      }
    });

    // Group participants update
    this.sock.ev.on('group-participants.update', async (update) => {
      if (update.action === 'add') {
        for (const participant of update.participants) {
          // Only notify owner
          if (this.authManager.isOwner(participant)) {
            await this.sendWelcomeMessage(participant);
          }
        }
      }
    });
  }

  async handleMessage(msg) {
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const jid = msg.key.remoteJid;
    if (jid === 'status@broadcast') return;

    // Check if sender is the owner
    const sender = msg.key.participant || jid;
    
    if (!this.authManager.isOwner(sender)) {
      console.log(`🚫 Unauthorized access attempt from: ${sender}`);
      // Silently ignore - don't even reply
      return;
    }

    // Extract text content
    let text = '';
    if (msg.message.conversation) text = msg.message.conversation;
    else if (msg.message.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
    else if (msg.message.imageMessage?.caption) text = msg.message.imageMessage.caption;
    else if (msg.message.videoMessage?.caption) text = msg.message.videoMessage.caption;

    if (!text) {
      // Handle media messages
      await this.handleMediaMessage(msg);
      return;
    }

    try {
      // Check if it's a command
      if (text.startsWith('/')) {
        const response = await this.chatHandler.handleCommand(sender, text);
        await this.sock.sendMessage(jid, { text: response });
        return;
      }

      // Process with AI
      console.log('💬 Processing message from owner...');
      const response = await this.chatHandler.processMessage(sender, text);
      
      // Send response
      await this.sock.sendMessage(jid, { 
        text: response,
        contextInfo: {
          forwardingScore: 0,
          isForwarded: false,
        }
      });
      
    } catch (error) {
      console.error('❌ Message processing error:', error.message);
      await this.sock.sendMessage(jid, {
        text: '⚠️ Error processing your message. Please try again.'
      });
    }
  }

  async handleMediaMessage(msg) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    if (!this.authManager.isOwner(sender)) return;

    try {
      let caption = '';
      let mediaType = '';
      let mediaBuffer = null;

      if (msg.message.imageMessage) {
        mediaType = 'image';
        caption = msg.message.imageMessage.caption || '📸 Image received';
        mediaBuffer = await this.sock.downloadMediaMessage(msg);
      } else if (msg.message.videoMessage) {
        mediaType = 'video';
        caption = msg.message.videoMessage.caption || '🎥 Video received';
        mediaBuffer = await this.sock.downloadMediaMessage(msg);
      } else if (msg.message.audioMessage) {
        mediaType = 'audio';
        caption = '🎵 Audio received';
        mediaBuffer = await this.sock.downloadMediaMessage(msg);
      } else if (msg.message.documentMessage) {
        mediaType = 'document';
        caption = `📄 Document: ${msg.message.documentMessage.fileName || 'file'}`;
        mediaBuffer = await this.sock.downloadMediaMessage(msg);
      } else if (msg.message.stickerMessage) {
        mediaType = 'sticker';
        caption = '🎨 Sticker received';
        mediaBuffer = await this.sock.downloadMediaMessage(msg);
      }

      if (mediaBuffer) {
        const response = await this.chatHandler.processMessage(
          sender, 
          `I received a ${mediaType}. ${caption}`
        );
        await this.sock.sendMessage(jid, { 
          text: `📎 *Media Received*\n\n${response}` 
        });
      }
    } catch (error) {
      console.error('❌ Media handling error:', error.message);
    }
  }

  async sendStartupMessage() {
    const ownerJid = this.ownerJid || this.authManager.getOwnerJid();
    if (!ownerJid) return;

    const message = `
🔒 *Private AI Chatbot - Active*

✅ Connected Successfully!
📡 ${Object.keys(config.ai.models).length} AI Models Ready
🔐 Only YOU can access this bot

*Available Models:*
${Object.entries(config.ai.models).map(([id, model]) => 
  `• ${model.name} (${model.provider})`
).join('\n')}

*Commands:*
/models - List all models
/switch <id> - Change model
/compare - Compare models
/agent - Toggle AI agent
/status - View stats
/clear - Clear conversation
/help - Show all commands

*Default Model: ${config.ai.models[config.ai.defaultModel].name}*

💡 Just send any message to start chatting!
    `;

    try {
      await this.sock.sendMessage(ownerJid, { text: message });
      console.log('📨 Startup message sent to owner');
    } catch (error) {
      console.error('❌ Failed to send startup message:', error.message);
    }
  }

  async sendWelcomeMessage(participant) {
    if (!this.authManager.isOwner(participant)) return;

    const welcomeMsg = `
👋 Welcome back!

🔒 Private AI Chatbot is ready for you.
📱 You can send messages directly to this number.

*Commands:*
/help - Show all commands
/models - List AI models
/status - View bot status

Type any message to start chatting with AI!
    `;

    await this.sock.sendMessage(participant, { text: welcomeMsg });
  }

  setupAutoTasks() {
    // Check connection status every minute
    setInterval(() => {
      if (!this.isConnected) {
        console.log('⚠️ Connection lost. Attempting to reconnect...');
        this.initializeWhatsApp();
      }
    }, 60000);

    // Auto-presence
    setInterval(async () => {
      if (this.isConnected && this.sock) {
        try {
          await this.sock.sendPresenceUpdate('available');
        } catch (e) {}
      }
    }, 30000);

    console.log('⏰ Auto-tasks initialized');
  }

  async shutdown() {
    this.isShuttingDown = true;
    console.log('🛑 Shutting down...');
    
    if (this.sock) {
      try {
        await this.sock.logout();
        console.log('✅ Logged out successfully');
      } catch (e) {}
      this.sock = null;
    }
    
    process.exit(0);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT');
  if (global.chatbot) {
    global.chatbot.shutdown();
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM');
  if (global.chatbot) {
    global.chatbot.shutdown();
  } else {
    process.exit(0);
  }
});

// Start the bot
(async () => {
  const chatbot = new PrivateAIChatbot();
  global.chatbot = chatbot;
  await chatbot.start();
})();
