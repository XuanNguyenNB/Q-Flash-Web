/**
 * Analytics Routes - Collect tracking data
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db, { now } from '../db/connection.js';

const router = Router();

/**
 * POST /api/analytics/session
 * Create or update a session
 */
router.post('/session', (req, res) => {
    try {
        const {
            sessionId,
            visitorId,
            userAgent,
            browser,
            browserVersion,
            os,
            osVersion,
            deviceType,
            screenWidth,
            screenHeight,
            language,
            referrer,
            landingPage
        } = req.body;

        const id = sessionId || uuidv4();
        const visitor = visitorId || uuidv4();

        // Check if session exists
        const existing = db.prepare('SELECT id FROM sessions WHERE id = ?').get(id);

        if (existing) {
            // Update last activity
            db.prepare(`
                UPDATE sessions 
                SET last_activity = ? 
                WHERE id = ?
            `).run(now(), id);
        } else {
            // Create new session
            db.prepare(`
                INSERT INTO sessions (
                    id, visitor_id, started_at, last_activity,
                    user_agent, browser, browser_version, os, os_version,
                    device_type, screen_width, screen_height, language,
                    referrer, landing_page
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id, visitor, now(), now(),
                userAgent, browser, browserVersion, os, osVersion,
                deviceType || 'desktop', screenWidth, screenHeight, language,
                referrer, landingPage
            );

            // Emit realtime event for new session
            const io = req.app.get('io');
            if (io) {
                io.to('admin').emit('new_session', {
                    sessionId: id,
                    deviceType: deviceType || 'desktop',
                    browser,
                    os,
                    timestamp: now()
                });
            }
        }

        res.json({
            success: true,
            sessionId: id,
            visitorId: visitor
        });
    } catch (error) {
        console.error('Session error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/analytics/pageview
 * Track a pageview
 */
router.post('/pageview', (req, res) => {
    try {
        const { sessionId, path, title, timeOnPage } = req.body;

        if (!sessionId || !path) {
            return res.status(400).json({ error: 'sessionId and path are required' });
        }

        // Update session last activity
        db.prepare('UPDATE sessions SET last_activity = ? WHERE id = ?')
            .run(now(), sessionId);

        // Insert pageview
        const result = db.prepare(`
            INSERT INTO pageviews (session_id, path, title, time_on_page)
            VALUES (?, ?, ?, ?)
        `).run(sessionId, path, title, timeOnPage || 0);

        // Emit realtime event
        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('pageview', {
                sessionId,
                path,
                title,
                timestamp: now()
            });
        }

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Pageview error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/analytics/event
 * Track a custom event
 */
router.post('/event', (req, res) => {
    try {
        const { sessionId, category, action, label, value, metadata } = req.body;

        if (!sessionId || !category || !action) {
            return res.status(400).json({
                error: 'sessionId, category, and action are required'
            });
        }

        // Update session last activity
        db.prepare('UPDATE sessions SET last_activity = ? WHERE id = ?')
            .run(now(), sessionId);

        // Insert event
        const result = db.prepare(`
            INSERT INTO events (session_id, category, action, label, value, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            sessionId,
            category,
            action,
            label || null,
            value || null,
            metadata ? JSON.stringify(metadata) : null
        );

        // Emit realtime event
        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('event', {
                sessionId,
                category,
                action,
                label,
                value,
                timestamp: now()
            });
        }

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Event error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/analytics/error
 * Track an error
 */
router.post('/error', (req, res) => {
    try {
        const { sessionId, errorType, message, stack, url, line, column } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'message is required' });
        }

        // Insert error
        const result = db.prepare(`
            INSERT INTO errors (session_id, error_type, message, stack, url, line, column)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            sessionId || null,
            errorType || 'js',
            message,
            stack || null,
            url || null,
            line || null,
            column || null
        );

        // Emit realtime event
        const io = req.app.get('io');
        if (io) {
            io.to('admin').emit('error', {
                sessionId,
                errorType: errorType || 'js',
                message,
                url,
                timestamp: now()
            });
        }

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Error tracking error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/analytics/batch
 * Batch submit multiple events (for efficiency)
 */
router.post('/batch', (req, res) => {
    try {
        const { sessionId, events } = req.body;

        if (!sessionId || !Array.isArray(events)) {
            return res.status(400).json({ error: 'sessionId and events array required' });
        }

        const insertEvent = db.prepare(`
            INSERT INTO events (session_id, category, action, label, value, metadata, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction((items) => {
            for (const event of items) {
                insertEvent.run(
                    sessionId,
                    event.category,
                    event.action,
                    event.label || null,
                    event.value || null,
                    event.metadata ? JSON.stringify(event.metadata) : null,
                    event.timestamp || now()
                );
            }
        });

        transaction(events);

        // Update session
        db.prepare('UPDATE sessions SET last_activity = ? WHERE id = ?')
            .run(now(), sessionId);

        res.json({ success: true, count: events.length });
    } catch (error) {
        console.error('Batch error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
