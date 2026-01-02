/**
 * Stats Routes - Get analytics data for dashboard
 */

import { Router } from 'express';
import db, { today } from '../db/connection.js';
import { requireAuth } from './auth.js';

const router = Router();

// All stats routes require authentication
router.use(requireAuth);

/**
 * GET /api/stats/overview
 * Get overview statistics
 */
router.get('/overview', (req, res) => {
    try {
        const now = new Date();
        const todayStr = today();
        const yesterdayStr = new Date(now - 86400000).toISOString().split('T')[0];
        const weekAgo = new Date(now - 7 * 86400000).toISOString().split('T')[0];
        const monthAgo = new Date(now - 30 * 86400000).toISOString().split('T')[0];

        // Today's stats
        const todayStats = db.prepare(`
            SELECT 
                COUNT(DISTINCT id) as sessions,
                COUNT(DISTINCT visitor_id) as visitors
            FROM sessions 
            WHERE date(started_at) = ?
        `).get(todayStr);

        const todayPageviews = db.prepare(`
            SELECT COUNT(*) as count FROM pageviews 
            WHERE date(timestamp) = ?
        `).get(todayStr);

        const todayEvents = db.prepare(`
            SELECT COUNT(*) as count FROM events 
            WHERE date(timestamp) = ?
        `).get(todayStr);

        const todayErrors = db.prepare(`
            SELECT COUNT(*) as count FROM errors 
            WHERE date(timestamp) = ?
        `).get(todayStr);

        // Yesterday comparison
        const yesterdayStats = db.prepare(`
            SELECT COUNT(DISTINCT id) as sessions
            FROM sessions WHERE date(started_at) = ?
        `).get(yesterdayStr);

        // Week stats
        const weekStats = db.prepare(`
            SELECT 
                COUNT(DISTINCT id) as sessions,
                COUNT(DISTINCT visitor_id) as visitors
            FROM sessions 
            WHERE started_at >= ?
        `).get(weekAgo);

        // Month stats
        const monthStats = db.prepare(`
            SELECT 
                COUNT(DISTINCT id) as sessions,
                COUNT(DISTINCT visitor_id) as visitors
            FROM sessions 
            WHERE started_at >= ?
        `).get(monthAgo);

        // Active sessions (last 5 minutes)
        const fiveMinutesAgo = new Date(now - 5 * 60000).toISOString();
        const activeSessions = db.prepare(`
            SELECT COUNT(*) as count 
            FROM sessions 
            WHERE last_activity >= ?
        `).get(fiveMinutesAgo);

        res.json({
            realtime: {
                activeSessions: activeSessions.count
            },
            today: {
                sessions: todayStats.sessions,
                visitors: todayStats.visitors,
                pageviews: todayPageviews.count,
                events: todayEvents.count,
                errors: todayErrors.count,
                sessionsChange: todayStats.sessions - (yesterdayStats?.sessions || 0)
            },
            week: {
                sessions: weekStats.sessions,
                visitors: weekStats.visitors
            },
            month: {
                sessions: monthStats.sessions,
                visitors: monthStats.visitors
            }
        });
    } catch (error) {
        console.error('Overview stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/stats/pageviews
 * Get pageview statistics
 */
router.get('/pageviews', (req, res) => {
    try {
        const { days = 7 } = req.query;
        const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

        // Pageviews by day
        const byDay = db.prepare(`
            SELECT 
                date(timestamp) as date,
                COUNT(*) as count
            FROM pageviews 
            WHERE date(timestamp) >= ?
            GROUP BY date(timestamp)
            ORDER BY date
        `).all(startDate);

        // Top pages
        const topPages = db.prepare(`
            SELECT 
                path,
                COUNT(*) as views,
                COUNT(DISTINCT session_id) as unique_views
            FROM pageviews 
            WHERE date(timestamp) >= ?
            GROUP BY path
            ORDER BY views DESC
            LIMIT 10
        `).all(startDate);

        res.json({ byDay, topPages });
    } catch (error) {
        console.error('Pageviews stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/stats/events
 * Get event statistics
 */
router.get('/events', (req, res) => {
    try {
        const { days = 7 } = req.query;
        const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

        // Events by category
        const byCategory = db.prepare(`
            SELECT 
                category,
                COUNT(*) as count
            FROM events 
            WHERE date(timestamp) >= ?
            GROUP BY category
            ORDER BY count DESC
        `).all(startDate);

        // Events by action (top 20)
        const byAction = db.prepare(`
            SELECT 
                category,
                action,
                COUNT(*) as count
            FROM events 
            WHERE date(timestamp) >= ?
            GROUP BY category, action
            ORDER BY count DESC
            LIMIT 20
        `).all(startDate);

        // Recent events
        const recent = db.prepare(`
            SELECT 
                e.category,
                e.action,
                e.label,
                e.timestamp,
                s.device_type,
                s.browser
            FROM events e
            LEFT JOIN sessions s ON e.session_id = s.id
            ORDER BY e.timestamp DESC
            LIMIT 50
        `).all();

        res.json({ byCategory, byAction, recent });
    } catch (error) {
        console.error('Events stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/stats/devices
 * Get device/browser statistics
 */
router.get('/devices', (req, res) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

        // Device types
        const deviceTypes = db.prepare(`
            SELECT 
                device_type,
                COUNT(*) as count
            FROM sessions 
            WHERE date(started_at) >= ?
            GROUP BY device_type
            ORDER BY count DESC
        `).all(startDate);

        // Browsers
        const browsers = db.prepare(`
            SELECT 
                browser,
                COUNT(*) as count
            FROM sessions 
            WHERE date(started_at) >= ? AND browser IS NOT NULL
            GROUP BY browser
            ORDER BY count DESC
            LIMIT 10
        `).all(startDate);

        // Operating systems
        const operatingSystems = db.prepare(`
            SELECT 
                os,
                COUNT(*) as count
            FROM sessions 
            WHERE date(started_at) >= ? AND os IS NOT NULL
            GROUP BY os
            ORDER BY count DESC
            LIMIT 10
        `).all(startDate);

        // Screen resolutions
        const screenSizes = db.prepare(`
            SELECT 
                screen_width || 'x' || screen_height as resolution,
                COUNT(*) as count
            FROM sessions 
            WHERE date(started_at) >= ? AND screen_width IS NOT NULL
            GROUP BY resolution
            ORDER BY count DESC
            LIMIT 10
        `).all(startDate);

        res.json({ deviceTypes, browsers, operatingSystems, screenSizes });
    } catch (error) {
        console.error('Devices stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/stats/errors
 * Get error statistics
 */
router.get('/errors', (req, res) => {
    try {
        const { days = 7 } = req.query;
        const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

        // Errors by day
        const byDay = db.prepare(`
            SELECT 
                date(timestamp) as date,
                COUNT(*) as count
            FROM errors 
            WHERE date(timestamp) >= ?
            GROUP BY date(timestamp)
            ORDER BY date
        `).all(startDate);

        // Recent errors
        const recent = db.prepare(`
            SELECT 
                id,
                error_type,
                message,
                url,
                timestamp
            FROM errors 
            ORDER BY timestamp DESC
            LIMIT 50
        `).all();

        // Error count by type
        const byType = db.prepare(`
            SELECT 
                error_type,
                COUNT(*) as count
            FROM errors 
            WHERE date(timestamp) >= ?
            GROUP BY error_type
        `).all(startDate);

        res.json({ byDay, byType, recent });
    } catch (error) {
        console.error('Errors stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/stats/sessions
 * Get session details
 */
router.get('/sessions', (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const sessions = db.prepare(`
            SELECT 
                s.*,
                (SELECT COUNT(*) FROM pageviews WHERE session_id = s.id) as pageview_count,
                (SELECT COUNT(*) FROM events WHERE session_id = s.id) as event_count
            FROM sessions s
            ORDER BY s.started_at DESC
            LIMIT ? OFFSET ?
        `).all(parseInt(limit), parseInt(offset));

        const total = db.prepare('SELECT COUNT(*) as count FROM sessions').get();

        res.json({ sessions, total: total.count });
    } catch (error) {
        console.error('Sessions stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/stats/session/:id
 * Get single session details
 */
router.get('/session/:id', (req, res) => {
    try {
        const { id } = req.params;

        const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const pageviews = db.prepare(`
            SELECT * FROM pageviews 
            WHERE session_id = ? 
            ORDER BY timestamp
        `).all(id);

        const events = db.prepare(`
            SELECT * FROM events 
            WHERE session_id = ? 
            ORDER BY timestamp
        `).all(id);

        res.json({ session, pageviews, events });
    } catch (error) {
        console.error('Session detail error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
