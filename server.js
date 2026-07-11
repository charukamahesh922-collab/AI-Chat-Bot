// ============================================
// 🚀 AI Chat Server - Backend API
// ============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const AIManager = require('./ai-manager');
const MemoryManager = require('./memory-manager');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize managers
const aiManager = new AIManager();
const memoryManager = new MemoryManager();

// ============================================
// API Routes
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        models: Object.keys(aiManager.models).length
    });
});

// Get all models
app.get('/api/models', (req, res) => {
    const models = aiManager.getAvailableModels();
    res.json({
        success: true,
        models: models,
        defaultModel: aiManager.defaultModel
    });
});

// Get model info
app.get('/api/models/:modelId', (req, res) => {
    const model = aiManager.models[req.params.modelId];
    if (!model) {
        return res.status(404).json({
            success: false,
            error: 'Model not found'
        });
    }
    res.json({
        success: true,
        model: {
            id: req.params.modelId,
            name: model.name,
            provider: model.provider,
            contextLength: model.contextLength,
            capabilities: aiManager.getModelCapabilities(req.params.modelId)
        }
    });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { modelId, message, history, userId = 'web-user' } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        // Get or create user session
        const sessionId = `${userId}-${Date.now()}`;
        
        // Add user message to memory
        memoryManager.addMessage(userId, 'user', message);

        // Get conversation context
        const context = memoryManager.getConversationContext(userId);
        
        // Build messages for AI
        const messages = [
            { role: 'system', content: 'You are a helpful AI assistant. Be accurate, friendly, and informative.' },
            ...context.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            { role: 'user', content: message }
        ];

        // Get AI response
        const startTime = Date.now();
        const response = await aiManager.getAIResponse(modelId, messages);
        const responseTime = Date.now() - startTime;

        // Save AI response to memory
        memoryManager.addMessage(userId, 'assistant', response);

        // Get stats
        const stats = memoryManager.getStats();

        res.json({
            success: true,
            response: response,
            modelId: modelId,
            modelName: aiManager.models[modelId]?.name || 'Unknown',
            tokens: Math.ceil(response.length / 4), // Approximate token count
            responseTime: responseTime,
            timestamp: new Date().toISOString(),
            stats: stats
        });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process chat request'
        });
    }
});

// Compare models
app.post('/api/compare', async (req, res) => {
    try {
        const { modelIds, message } = req.body;
        
        if (!message || !modelIds || modelIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message and model IDs are required'
            });
        }

        const messages = [
            { role: 'system', content: 'You are a helpful AI assistant.' },
            { role: 'user', content: message }
        ];

        const results = await aiManager.compareModels(modelIds, messages);
        
        res.json({
            success: true,
            results: results,
            message: message,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Compare error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get user memory
app.get('/api/memory/:userId', (req, res) => {
    const summary = memoryManager.summarizeMemory(req.params.userId);
    res.json({
        success: true,
        memory: summary
    });
});

// Clear user memory
app.delete('/api/memory/:userId', (req, res) => {
    memoryManager.clearHistory(req.params.userId);
    res.json({
        success: true,
        message: 'Memory cleared'
    });
});

// Get statistics
app.get('/api/stats', (req, res) => {
    const stats = memoryManager.getStats();
    res.json({
        success: true,
        stats: stats,
        availableModels: Object.keys(aiManager.models).length,
        defaultModel: aiManager.defaultModel
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(port, () => {
    console.log('🚀 AI Chat Server running!');
    console.log('━'.repeat(50));
    console.log(`📍 http://localhost:${port}`);
    console.log(`🤖 Models loaded: ${Object.keys(aiManager.models).length}`);
    console.log('━'.repeat(50));
    console.log('📋 API Endpoints:');
    console.log(`  GET  /api/models       - List all models`);
    console.log(`  POST /api/chat         - Send message`);
    console.log(`  POST /api/compare      - Compare models`);
    console.log(`  GET  /api/stats        - Get statistics`);
    console.log('━'.repeat(50));
});

module.exports = app;
