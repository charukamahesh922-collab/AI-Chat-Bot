// ============================================
// 🔐 Authentication Manager
// ============================================

const fs = require('fs');
const path = require('path');

class AuthManager {
  constructor() {
    this.authFile = path.join(__dirname, 'auth_info_baileys', 'creds.json');
    this.ownerJid = null;
    this.isAuthenticated = false;
    this.loadOwnerInfo();
  }

  loadOwnerInfo() {
    try {
      if (fs.existsSync(this.authFile)) {
        const creds = JSON.parse(fs.readFileSync(this.authFile, 'utf8'));
        // Extract owner info from credentials
        if (creds.me) {
          this.ownerJid = creds.me.id;
          this.isAuthenticated = true;
          console.log('🔐 Owner JID:', this.ownerJid);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load auth info:', error.message);
    }
  }

  isOwner(jid) {
    if (!this.ownerJid) {
      this.loadOwnerInfo();
    }
    
    // Compare JIDs (handle both formats)
    const normalizedJid = jid.split(':')[0]; // Remove device ID if present
    const normalizedOwner = this.ownerJid?.split(':')[0];
    
    return normalizedJid === normalizedOwner;
  }

  getOwnerJid() {
    return this.ownerJid;
  }

  updateOwnerInfo(creds) {
    if (creds.me && creds.me.id) {
      this.ownerJid = creds.me.id;
      this.isAuthenticated = true;
      console.log('🔄 Updated Owner JID:', this.ownerJid);
    }
  }

  isPrivateChat(jid) {
    return jid.includes('@s.whatsapp.net') && !jid.includes('@g.us');
  }

  isGroupChat(jid) {
    return jid.includes('@g.us');
  }
}

module.exports = AuthManager;
