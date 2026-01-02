/**
 * Realtime Service - WebSocket handling for live updates
 */

import db from '../db/connection.js';

// Track connected admin clients
const adminClients = new Set();

// Interval for periodic stats update
let statsInterval = null;

/**
 * Setup realtime service with Socket.io
 */
export function setupRealtimeService(io) {
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Admin joins admin room for realtime updates
        socket.on('join_admin', (token) => {
            // In production, verify JWT token here
            socket.join('admin');
            adminClients.add(socket.id);
            console.log(`👤 Admin joined: ${socket.id}`);

            // Send initial stats
            sendRealtimeStats(socket);
        });

        // Ping to keep connection alive and update stats
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            adminClients.delete(socket.id);
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });

    // Start periodic stats broadcast to admin clients
    startStatsInterval(io);

    console.log('📡 Realtime service initialized');
}

/**
 * Start interval to broadcast live stats
 */
function startStatsInterval(io) {
    if (statsInterval) {
        clearInterval(statsInterval);
    }

    statsInterval = setInterval(() => {
        if (adminClients.size > 0) {
            const stats = getRealtimeStats();
            io.to('admin').emit('stats_update', stats);
        }
    }, 5000); // Update every 5 seconds
}

/**
 * Send realtime stats to a specific socket
 */
function sendRealtimeStats(socket) {
    const stats = getRealtimeStats();
    socket.emit('stats_update', stats);
}

/**
 * Get current realtime statistics
 */
function getRealtimeStats() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now - 5 * 60000).toISOString();
    const oneHourAgo = new Date(now - 60 * 60000).toISOString();
    const todayStr = now.toISOString().split('T')[0];

    try {
        // Active sessions (last 5 minutes)
        const activeSessions = db.prepare(`
            SELECT COUNT(*) as count 
            FROM sessions 
            WHERE last_activity >= ?
        `).get(fiveMinutesAgo);

        // Recent pageviews (last hour)
        const recentPageviews = db.prepare(`
            SELECT path, COUNT(*) as count 
            FROM pageviews 
            WHERE timestamp >= ?
            GROUP BY path
            ORDER BY count DESC
            LIMIT 5
        `).all(oneHourAgo);

        // Today's totals
        const todayStats = db.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM sessions WHERE date(started_at) = ?) as sessions,
                (SELECT COUNT(*) FROM pageviews WHERE date(timestamp) = ?) as pageviews,
                (SELECT COUNT(*) FROM events WHERE date(timestamp) = ?) as events,
                (SELECT COUNT(*) FROM errors WHERE date(timestamp) = ?) as errors
        `).get(todayStr, todayStr, todayStr, todayStr);

        // Current visitors by page
        const currentPages = db.prepare(`
            SELECT 
                p.path,
                COUNT(DISTINCT p.session_id) as visitors
            FROM pageviews p
            JOIN sessions s ON p.session_id = s.id
            WHERE s.last_activity >= ?
            GROUP BY p.path
            ORDER BY visitors DESC
            LIMIT 5
        `).all(fiveMinutesAgo);

        return {
            timestamp: now.toISOString(),
            activeSessions: activeSessions.count,
            recentPageviews,
            currentPages,
            today: todayStats
        };
    } catch (error) {
        console.error('Error getting realtime stats:', error);
        return {
            timestamp: now.toISOString(),
            activeSessions: 0,
            recentPageviews: [],
            currentPages: [],
            today: { sessions: 0, pageviews: 0, events: 0, errors: 0 }
        };
    }
}

export { getRealtimeStats };
