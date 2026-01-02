import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import {
    Users, Eye, MousePointer, AlertTriangle, LogOut, RefreshCw,
    Monitor, Smartphone, Tablet, Globe, Clock, TrendingUp, Activity,
    Zap, HardDrive, Filter, ChevronDown
} from 'lucide-react';

interface DashboardProps {
    onLogout: () => void;
}

interface OverviewStats {
    realtime: { activeSessions: number };
    today: {
        sessions: number;
        visitors: number;
        pageviews: number;
        events: number;
        errors: number;
        sessionsChange: number;
    };
    week: { sessions: number; visitors: number };
    month: { sessions: number; visitors: number };
}

interface RealtimeStats {
    timestamp: string;
    activeSessions: number;
    recentPageviews: Array<{ path: string; count: number }>;
    currentPages: Array<{ path: string; visitors: number }>;
    today: { sessions: number; pageviews: number; events: number; errors: number };
}

interface PageviewStats {
    byDay: Array<{ date: string; count: number }>;
    topPages: Array<{ path: string; views: number; unique_views: number }>;
}

interface EventStats {
    byCategory: Array<{ category: string; count: number }>;
    byAction: Array<{ category: string; action: string; count: number }>;
    recent: Array<{
        category: string;
        action: string;
        label?: string;
        value?: number;
        timestamp: string;
        device_type?: string;
        browser?: string;
    }>;
}

interface DeviceStats {
    deviceTypes: Array<{ device_type: string; count: number }>;
    browsers: Array<{ browser: string; count: number }>;
    operatingSystems: Array<{ os: string; count: number }>;
}

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

// Category colors for visual distinction
const CATEGORY_COLORS: Record<string, string> = {
    'edl': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'adb': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'fastboot': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'mode': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'download': 'bg-green-500/20 text-green-400 border-green-500/30',
    'default': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

// Action icons
const getActionIcon = (category: string, action: string) => {
    if (category === 'edl') {
        if (action.includes('flash')) return <Zap className="w-4 h-4" />;
        if (action.includes('backup')) return <HardDrive className="w-4 h-4" />;
        if (action.includes('connection')) return <Activity className="w-4 h-4" />;
    }
    return <MousePointer className="w-4 h-4" />;
};

export function Dashboard({ onLogout }: DashboardProps) {
    const [_socket, setSocket] = useState<Socket | null>(null);
    const [realtimeStats, setRealtimeStats] = useState<RealtimeStats | null>(null);
    const [overview, setOverview] = useState<OverviewStats | null>(null);
    const [pageviews, setPageviews] = useState<PageviewStats | null>(null);
    const [events, setEvents] = useState<EventStats | null>(null);
    const [devices, setDevices] = useState<DeviceStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'journey' | 'errors'>('overview');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);

    const token = localStorage.getItem('admin_token');

    // Fetch data from API
    const fetchData = useCallback(async () => {
        if (!token) return;

        const headers = { 'Authorization': `Bearer ${token}` };

        try {
            const [overviewRes, pageviewsRes, eventsRes, devicesRes] = await Promise.all([
                fetch('/api/stats/overview', { headers }),
                fetch('/api/stats/pageviews?days=7', { headers }),
                fetch('/api/stats/events?days=7', { headers }),
                fetch('/api/stats/devices?days=30', { headers }),
            ]);

            if (overviewRes.ok) setOverview(await overviewRes.json());
            if (pageviewsRes.ok) setPageviews(await pageviewsRes.json());
            if (eventsRes.ok) setEvents(await eventsRes.json());
            if (devicesRes.ok) setDevices(await devicesRes.json());
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    // Setup WebSocket connection
    useEffect(() => {
        const newSocket = io(window.location.origin, {
            transports: ['websocket', 'polling'],
        });

        newSocket.on('connect', () => {
            console.log('Connected to realtime server');
            newSocket.emit('join_admin', token);
        });

        newSocket.on('stats_update', (stats: RealtimeStats) => {
            setRealtimeStats(stats);
        });

        newSocket.on('pageview', (data: { path: string }) => {
            console.log('New pageview:', data);
        });

        newSocket.on('event', (data: { category: string; action: string }) => {
            console.log('New event:', data);
            // Refresh events when new event comes in
            fetchData();
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [token, fetchData]);

    // Fetch initial data
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Refresh data every 30 seconds
    useEffect(() => {
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const getDeviceIcon = (type: string) => {
        switch (type?.toLowerCase()) {
            case 'mobile': return <Smartphone className="w-4 h-4" />;
            case 'tablet': return <Tablet className="w-4 h-4" />;
            default: return <Monitor className="w-4 h-4" />;
        }
    };

    const getCategoryColor = (category: string) => {
        return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.default;
    };

    // Get unique categories for filter
    const categories = ['all', ...new Set(events?.byCategory.map(c => c.category) || [])];

    // Filter events by category
    const filteredEvents = categoryFilter === 'all'
        ? events?.recent
        : events?.recent.filter(e => e.category === categoryFilter);

    // Group events by action for journey view
    const journeyStats = events?.byAction.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push({ action: item.action, count: item.count });
        return acc;
    }, {} as Record<string, Array<{ action: string; count: number }>>);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Q-Flash Analytics</h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Real-time user behavior tracking
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={fetchData}
                            className="btn btn-secondary flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                        <button
                            onClick={onLogout}
                            className="btn btn-secondary flex items-center gap-2"
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </div>
                </header>

                {/* Realtime Banner */}
                <div className="card mb-6 bg-gradient-to-r from-primary-600/20 to-purple-600/20 border-primary-500/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="live-indicator">
                                <span className="live-dot"></span>
                                <span className="text-sm font-medium text-slate-300">LIVE</span>
                            </div>
                            <div>
                                <span className="text-4xl font-bold text-white">
                                    {realtimeStats?.activeSessions ?? overview?.realtime.activeSessions ?? 0}
                                </span>
                                <span className="text-slate-400 ml-2">active users right now</span>
                            </div>
                        </div>
                        <div className="hidden md:flex items-center gap-6">
                            {realtimeStats?.currentPages.slice(0, 3).map((page, i) => (
                                <div key={i} className="text-right">
                                    <div className="text-sm text-slate-400">{page.path}</div>
                                    <div className="text-lg font-semibold text-white">{page.visitors} users</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard
                        icon={<Users className="w-5 h-5" />}
                        title="Today's Sessions"
                        value={formatNumber(overview?.today.sessions ?? 0)}
                        change={overview?.today.sessionsChange}
                        color="blue"
                    />
                    <StatCard
                        icon={<Eye className="w-5 h-5" />}
                        title="Pageviews"
                        value={formatNumber(realtimeStats?.today.pageviews ?? overview?.today.pageviews ?? 0)}
                        color="purple"
                    />
                    <StatCard
                        icon={<MousePointer className="w-5 h-5" />}
                        title="Events"
                        value={formatNumber(realtimeStats?.today.events ?? overview?.today.events ?? 0)}
                        color="green"
                    />
                    <StatCard
                        icon={<AlertTriangle className="w-5 h-5" />}
                        title="Errors"
                        value={formatNumber(realtimeStats?.today.errors ?? overview?.today.errors ?? 0)}
                        color="red"
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {(['overview', 'events', 'journey', 'errors'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${activeTab === tab
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            {tab === 'journey' && <Activity className="w-4 h-4" />}
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Pageviews Chart */}
                        <div className="card lg:col-span-2">
                            <div className="card-header">
                                <h3 className="card-title flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-primary-500" />
                                    Pageviews (Last 7 Days)
                                </h3>
                            </div>
                            <div className="chart-container">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={pageviews?.byDay ?? []}>
                                        <defs>
                                            <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#64748b"
                                            tickFormatter={(val: string) => new Date(val).toLocaleDateString('en', { weekday: 'short' })}
                                        />
                                        <YAxis stroke="#64748b" />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1e293b',
                                                border: '1px solid #334155',
                                                borderRadius: '8px'
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="count"
                                            stroke="#0ea5e9"
                                            fillOpacity={1}
                                            fill="url(#colorPv)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top Pages */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-purple-500" />
                                    Top Pages
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {pageviews?.topPages.slice(0, 8).map((page, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <span className="text-sm text-slate-300 truncate max-w-[180px]">
                                            {page.path}
                                        </span>
                                        <span className="text-sm font-medium text-white">{page.views}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Device Breakdown */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title flex items-center gap-2">
                                    <Monitor className="w-5 h-5 text-green-500" />
                                    Devices
                                </h3>
                            </div>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={devices?.deviceTypes ?? []}
                                            dataKey="count"
                                            nameKey="device_type"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={60}
                                            label={({ device_type, percent }: { device_type: string; percent: number }) =>
                                                `${device_type} ${(percent * 100).toFixed(0)}%`
                                            }
                                        >
                                            {devices?.deviceTypes.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Browsers */}
                        <div className="card lg:col-span-2">
                            <div className="card-header">
                                <h3 className="card-title flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-amber-500" />
                                    Browsers
                                </h3>
                            </div>
                            <div className="h-48">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={devices?.browsers.slice(0, 6) ?? []} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis type="number" stroke="#64748b" />
                                        <YAxis dataKey="browser" type="category" stroke="#64748b" width={80} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1e293b',
                                                border: '1px solid #334155',
                                                borderRadius: '8px'
                                            }}
                                        />
                                        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'events' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Events by Category */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Events by Category</h3>
                            </div>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={events?.byCategory ?? []}
                                            dataKey="count"
                                            nameKey="category"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            label
                                        >
                                            {events?.byCategory.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Recent Events with Filter */}
                        <div className="card lg:col-span-2">
                            <div className="card-header flex items-center justify-between">
                                <h3 className="card-title flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-primary-500" />
                                    Recent Events
                                </h3>
                                {/* Category Filter */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 text-sm text-slate-300 hover:bg-slate-600"
                                    >
                                        <Filter className="w-4 h-4" />
                                        {categoryFilter === 'all' ? 'All Categories' : categoryFilter}
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                    {showFilterDropdown && (
                                        <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10">
                                            {categories.map(cat => (
                                                <button
                                                    key={cat}
                                                    onClick={() => {
                                                        setCategoryFilter(cat);
                                                        setShowFilterDropdown(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg ${categoryFilter === cat ? 'text-primary-400 bg-slate-700/50' : 'text-slate-300'
                                                        }`}
                                                >
                                                    {cat === 'all' ? 'All Categories' : cat.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="overflow-auto max-h-96">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Category</th>
                                            <th>Action</th>
                                            <th>Label</th>
                                            <th>Value</th>
                                            <th>Device</th>
                                            <th>Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEvents?.slice(0, 20).map((event, i) => (
                                            <tr key={i} className="hover:bg-slate-800/50">
                                                <td>
                                                    <span className={`px-2 py-1 rounded-full text-xs border ${getCategoryColor(event.category)}`}>
                                                        {event.category}
                                                    </span>
                                                </td>
                                                <td className="flex items-center gap-2">
                                                    {getActionIcon(event.category, event.action)}
                                                    <span>{event.action}</span>
                                                </td>
                                                <td className="text-slate-400 truncate max-w-[200px]" title={event.label}>
                                                    {event.label || '-'}
                                                </td>
                                                <td className="text-slate-400">
                                                    {event.value ?? '-'}
                                                </td>
                                                <td>
                                                    <span className="flex items-center gap-1">
                                                        {getDeviceIcon(event.device_type || '')}
                                                        <span className="text-xs text-slate-400">{event.browser}</span>
                                                    </span>
                                                </td>
                                                <td className="text-slate-400 text-xs">
                                                    {new Date(event.timestamp).toLocaleTimeString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'journey' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Journey by Mode */}
                        {journeyStats && Object.entries(journeyStats).map(([category, actions]) => (
                            <div key={category} className="card">
                                <div className="card-header">
                                    <h3 className="card-title flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded-full text-xs border ${getCategoryColor(category)}`}>
                                            {category.toUpperCase()}
                                        </span>
                                        User Actions
                                    </h3>
                                </div>
                                <div className="space-y-3">
                                    {actions.sort((a, b) => b.count - a.count).map((action, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50">
                                            <div className="flex items-center gap-3">
                                                {getActionIcon(category, action.action)}
                                                <span className="text-sm text-slate-300">{action.action}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary-500 rounded-full"
                                                        style={{ width: `${Math.min(100, (action.count / Math.max(...actions.map(a => a.count))) * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium text-white min-w-[40px] text-right">
                                                    {action.count}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* User Flow Funnel */}
                        <div className="card lg:col-span-2">
                            <div className="card-header">
                                <h3 className="card-title flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-primary-500" />
                                    EDL Flash Funnel
                                </h3>
                            </div>
                            <div className="flex items-center justify-center gap-4 py-8">
                                {[
                                    { label: 'Device Selected', action: 'device_selected', color: 'bg-blue-500' },
                                    { label: 'Connected', action: 'connection_complete', color: 'bg-purple-500' },
                                    { label: 'ROM Loaded', action: 'rom_loaded', color: 'bg-yellow-500' },
                                    { label: 'Flash Started', action: 'flash_start', color: 'bg-orange-500' },
                                    { label: 'Flash Complete', action: 'flash_complete', color: 'bg-green-500' },
                                ].map((step, i, arr) => {
                                    const count = events?.byAction.find(
                                        a => a.category === 'edl' && a.action === step.action
                                    )?.count ?? 0;
                                    return (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className="flex flex-col items-center">
                                                <div className={`w-16 h-16 rounded-full ${step.color} flex items-center justify-center text-white font-bold text-xl`}>
                                                    {count}
                                                </div>
                                                <span className="text-xs text-slate-400 mt-2 text-center max-w-[80px]">
                                                    {step.label}
                                                </span>
                                            </div>
                                            {i < arr.length - 1 && (
                                                <div className="w-8 h-0.5 bg-slate-600" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'errors' && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-rose-500" />
                                Error Tracking
                            </h3>
                        </div>
                        <p className="text-slate-400 text-center py-8">
                            Error data will appear here when errors are reported.
                        </p>
                    </div>
                )}

                {/* Footer */}
                <footer className="mt-8 text-center text-slate-500 text-sm">
                    Q-Flash Analytics Dashboard • Last updated: {realtimeStats?.timestamp ? new Date(realtimeStats.timestamp).toLocaleTimeString() : 'N/A'}
                </footer>
            </div>
        </div>
    );
}

// Stat Card Component
interface StatCardProps {
    icon: React.ReactNode;
    title: string;
    value: string;
    change?: number;
    color: 'blue' | 'purple' | 'green' | 'red';
}

function StatCard({ icon, title, value, change, color }: StatCardProps) {
    const colorClasses = {
        blue: 'from-blue-600/20 to-blue-600/5 border-blue-500/30',
        purple: 'from-purple-600/20 to-purple-600/5 border-purple-500/30',
        green: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/30',
        red: 'from-rose-600/20 to-rose-600/5 border-rose-500/30',
    };

    const iconColors = {
        blue: 'text-blue-500',
        purple: 'text-purple-500',
        green: 'text-emerald-500',
        red: 'text-rose-500',
    };

    return (
        <div className={`card bg-gradient-to-br ${colorClasses[color]}`}>
            <div className="flex items-center justify-between mb-2">
                <span className={`p-2 rounded-lg bg-slate-800/50 ${iconColors[color]}`}>
                    {icon}
                </span>
                {change !== undefined && (
                    <span className={change >= 0 ? 'stat-up text-sm' : 'stat-down text-sm'}>
                        {change >= 0 ? '+' : ''}{change}
                    </span>
                )}
            </div>
            <div className="card-value">{value}</div>
            <div className="card-subtitle">{title}</div>
        </div>
    );
}
