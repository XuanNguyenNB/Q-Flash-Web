/**
 * Q-Flash Analytics - Main Server
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import analyticsRoutes from './routes/analytics.js';
import authRoutes from './routes/auth.js';
import statsRoutes from './routes/stats.js';
import { setupRealtimeService } from './services/realtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Socket.io setup for realtime updates
const io = new SocketServer(httpServer, {
    cors: {
        origin: [
            'https://xuannguyen.site',
            'https://admin.xuannguyen.site',
            'http://localhost:5173',
            'http://localhost:3000'
        ],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Middleware
app.use(cors({
    origin: [
        'https://xuannguyen.site',
        'https://admin.xuannguyen.site',
        'http://localhost:5173',
        'http://localhost:3000'
    ],
    credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Make io available to routes
app.set('io', io);

// Routes
app.use('/api/analytics', analyticsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Setup realtime service
setupRealtimeService(io);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log('');
    console.log('🚀 Q-Flash Analytics Server');
    console.log('═══════════════════════════════════════');
    console.log(`📡 HTTP Server: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log('═══════════════════════════════════════');
    console.log('');
});

export { io };
