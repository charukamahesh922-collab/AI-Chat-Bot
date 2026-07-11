// ============================================
// 📱 AI Chat - Frontend Logic
// ============================================

class AIChat {
    constructor() {
        this.apiUrl = 'http://localhost:3000/api';
        this.models = [];
        this.currentModel = null;
        this.messageCount = 0;
        this.totalTokens = 0;
        this.isProcessing = false;
        this.darkMode = false;
        
        this.init();
    }

    init() {
        this.loadModels();
        this.setupEventListeners();
        this.updateStats();
        this.checkConnection();
    }

    async loadModels() {
        try {
            const response = await fetch(`${this.apiUrl}/models`);
            const data = await response.json();
            this.models = data.models || [];
            this.populateModelSelect();
            this.showModelSuggestions();
            this.selectDefaultModel();
        } catch (error) {
            console.error('Failed to load models:', error);
            this.showError('Failed to load AI models. Please check server connection.');
        }
    }

    populateModelSelect() {
        const select = document.getElementById('modelSelect');
        select.innerHTML = '';
        
        if (this.models.length === 0) {
            select.innerHTML = '<option value="">No models available</option>';
            return;
        }

        // Group models by provider
        const groups = {};
        this.models.forEach(model => {
            if (!groups[model.provider]) groups[model.provider] = [];
            groups[model.provider].push(model);
        });

        for (const [provider, models] of Object.entries(groups)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = provider.charAt(0).toUpperCase() + provider.slice(1);
            
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                if (model.id === this.currentModel) {
                    option.selected = true;
                }
                optgroup.appendChild(option);
            });
            
            select.appendChild(optgroup);
        }
    }

    selectDefaultModel() {
        if (this.models.length > 0) {
            // Try to find GPT-3.5 or first model
            const defaultModel = this.models.find(m => m.id === 'gpt-3.5') || this.models[0];
            this.currentModel = defaultModel.id;
            document.getElementById('modelSelect').value = this.currentModel;
            this.updateModelInfo(defaultModel);
        }
    }

    updateModelInfo(model) {
        document.getElementById('currentModelName').textContent = model.name;
        document.getElementById('modelIndicator').textContent = model.id;
        document.getElementById('hintModelName').textContent = model.name;
        
        // Update capabilities
        const capabilities = document.getElementById('modelCapabilities');
        if (model.capabilities && model.capabilities.length > 0) {
            capabilities.innerHTML = model.capabilities.map(cap => 
                `<span class="capability-tag">${this.getCapabilityEmoji(cap)} ${cap}</span>`
            ).join('');
        }
    }

    getCapabilityEmoji(cap) {
        const emojis = {
            'image-analysis': '🖼️',
            'code-generation': '💻',
            'long-context': '📚',
            'fast-response': '⚡',
            'multilingual': '🌍'
        };
        return emojis[cap] || '✨';
    }

    showModelSuggestions() {
        const container = document.getElementById('modelList');
        container.innerHTML = this.models.slice(0, 8).map(model => 
            `<span class="model-tag">${model.name}</span>`
        ).join('');
    }

    setupEventListeners() {
        // Model selection
        document.getElementById('modelSelect').addEventListener('change', (e) => {
            const modelId = e.target.value;
            const model = this.models.find(m => m.id === modelId);
            if (model) {
                this.currentModel = modelId;
                this.updateModelInfo(model);
            }
        });

        // Send message
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        
        // Enter key
        document.getElementById('messageInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        document.getElementById('messageInput').addEventListener('input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
        });

        // Sidebar toggle
        document.getElementById('toggleSidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Model info
        document.getElementById('modelInfoBtn').addEventListener('click', () => {
            this.showModelInfo();
        });

        // Clear input
        document.querySelector('.input-action-btn:last-child').addEventListener('click', () => {
            document.getElementById('messageInput').value = '';
            document.getElementById('messageInput').style.height = 'auto';
        });
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message || this.isProcessing) return;
        if (!this.currentModel) {
            this.showError('Please select an AI model first.');
            return;
        }

        // Clear input
        input.value = '';
        input.style.height = 'auto';

        // Add user message
        this.addMessage('user', message);
        this.messageCount++;
        this.updateStats();

        // Show typing indicator
        this.showTyping();

        this.isProcessing = true;
        document.getElementById('sendBtn').disabled = true;

        try {
            const startTime = Date.now();
            
            const response = await fetch(`${this.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    modelId: this.currentModel,
                    message: message,
                    history: this.getChatHistory()
                })
            });

            const data = await response.json();
            const responseTime = Date.now() - startTime;

            // Remove typing indicator
            this.hideTyping();

            if (data.success) {
                this.addMessage('bot', data.response);
                this.totalTokens += data.tokens || 0;
                document.getElementById('responseTime').textContent = `${responseTime}ms`;
                this.updateStats();
            } else {
                this.showError(data.error || 'Failed to get response');
            }
        } catch (error) {
            console.error('Send message error:', error);
            this.hideTyping();
            this.showError('Network error. Please check your connection.');
        }

        this.isProcessing = false;
        document.getElementById('sendBtn').disabled = false;
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    getChatHistory() {
        const messages = document.querySelectorAll('.message-item');
        const history = [];
        messages.forEach(msg => {
            const role = msg.classList.contains('user') ? 'user' : 'assistant';
            const content = msg.querySelector('.message-content').textContent;
            history.push({ role, content });
        });
        return history;
    }

    addMessage(role, content) {
        const container = document.getElementById('messagesList');
        const welcome = document.getElementById('welcomeMessage');
        
        // Hide welcome message
        if (welcome) welcome.style.display = 'none';

        const messageDiv = document.createElement('div');
        messageDiv.className = `message-item ${role}`;
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="message-wrapper">
                <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
                <div>
                    <div class="message-content">${this.formatContent(content)}</div>
                    <div class="message-time">${time}</div>
                </div>
            </div>
        `;
        
        container.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatContent(content) {
        // Handle code blocks
        content = content.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `<pre><code>${this.escapeHtml(code.trim())}</code></pre>`;
        });
        
        // Handle inline code
        content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Handle bold
        content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Handle italic
        content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        // Handle line breaks
        content = content.replace(/\n/g, '<br>');
        
        return content;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showTyping() {
        const container = document.getElementById('messagesList');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;
        container.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTyping() {
        const typing = document.getElementById('typingIndicator');
        if (typing) typing.remove();
    }

    showError(message) {
        const container = document.getElementById('messagesList');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message-item bot';
        errorDiv.innerHTML = `
            <div class="message-wrapper">
                <div class="message-avatar">⚠️</div>
                <div>
                    <div class="message-content" style="color: var(--danger);">
                        ${message}
                    </div>
                </div>
            </div>
        `;
        container.appendChild(errorDiv);
        this.scrollToBottom();
    }

    updateStats() {
        document.getElementById('messageCount').textContent = this.messageCount;
        document.getElementById('tokenCount').textContent = this.totalTokens;
    }

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
    }

    async checkConnection() {
        try {
            const response = await fetch(`${this.apiUrl}/health`);
            const data = await response.json();
            if (data.status === 'ok') {
                document.querySelector('.connection-status .status-dot').className = 'status-dot connected';
                document.querySelector('.connection-status').innerHTML = `
                    <span class="status-dot connected"></span>
                    Connected
                `;
            }
        } catch (error) {
            document.querySelector('.connection-status .status-dot').className = 'status-dot disconnected';
            document.querySelector('.connection-status').innerHTML = `
                <span class="status-dot disconnected"></span>
                Disconnected
            `;
        }
    }

    async showModelInfo() {
        const model = this.models.find(m => m.id === this.currentModel);
        if (!model) return;

        const modal = document.getElementById('modelInfoModal');
        const body = document.getElementById('modelInfoBody');
        
        body.innerHTML = `
            <div style="margin-bottom: 16px;">
                <h3>${model.name}</h3>
                <p style="color: var(--text-secondary);">Provider: ${model.provider}</p>
            </div>
            <div style="margin-bottom: 12px;">
                <strong>Context Length:</strong> ${model.contextLength || 'N/A'} tokens
            </div>
            ${model.capabilities && model.capabilities.length > 0 ? `
                <div style="margin-bottom: 12px;">
                    <strong>Capabilities:</strong>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
                        ${model.capabilities.map(cap => 
                            `<span class="capability-tag">${this.getCapabilityEmoji(cap)} ${cap}</span>`
                        ).join('')}
                    </div>
                </div>
            ` : ''}
            <div style="color: var(--text-secondary); font-size: 13px;">
                <strong>Model ID:</strong> ${model.id}
            </div>
        `;
        
        modal.classList.add('show');
    }

    clearChat() {
        const container = document.getElementById('messagesList');
        container.innerHTML = '';
        this.messageCount = 0;
        this.totalTokens = 0;
        this.updateStats();
        
        // Show welcome again
        document.getElementById('welcomeMessage').style.display = 'block';
        
        // Reset response time
        document.getElementById('responseTime').textContent = '0ms';
    }

    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
        
        const btn = document.querySelector('.action-btn:nth-child(3) i');
        btn.className = this.darkMode ? 'fas fa-sun' : 'fas fa-moon';
    }

    exportChat() {
        const messages = document.querySelectorAll('.message-item');
        if (messages.length === 0) {
            alert('No messages to export.');
            return;
        }

        let exportText = '🤖 AI Chat Export\n';
        exportText += '='.repeat(50) + '\n\n';
        
        messages.forEach(msg => {
            const role = msg.classList.contains('user') ? 'You' : 'AI';
            const content = msg.querySelector('.message-content').textContent;
            const time = msg.querySelector('.message-time')?.textContent || '';
            exportText += `[${time}] ${role}:\n${content}\n\n`;
        });

        const blob = new Blob([exportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-export-${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Close modal when clicking outside
document.getElementById('modelInfoModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        document.getElementById('modelInfoModal').classList.remove('show');
    }
});

// Initialize chat
const chat = new AIChat();

// Make functions globally accessible
window.sendMessage = () => chat.sendMessage();
window.clearChat = () => chat.clearChat();
window.toggleDarkMode = () => chat.toggleDarkMode();
window.exportChat = () => chat.exportChat();
window.closeModal = () => document.getElementById('modelInfoModal').classList.remove('show');
