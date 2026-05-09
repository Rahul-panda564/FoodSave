import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { analyticsAPI } from '../services/api';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll';

interface DashboardStats {
  total_donations: number;
  active_donations: number;
  total_meals_saved: number;
  active_users: number;
  total_ngos: number;
  total_volunteers: number;
  food_waste_prevented_kg: number;
  co2_emissions_saved: number;
  weekly_growth?: number;
  monthly_growth?: number;
  my_donations?: number;
  my_active_donations?: number;
  my_completed_donations?: number;
  my_total_meals_saved?: number;
  my_pickups?: number;
  my_completed_pickups?: number;
  my_pending_pickups?: number;
  my_total_meals_received?: number;
  my_deliveries?: number;
  my_completed_deliveries?: number;
  my_active_deliveries?: number;
}

interface ActivityNotification {
  id: number;
  activity_type: string;
  description: string;
  timestamp: string;
}

type UserRole = 'DONOR' | 'NGO' | 'VOLUNTEER' | 'ADMIN' | '';

const DEFAULT_STATS: DashboardStats = {
  total_donations: 0, active_donations: 0, total_meals_saved: 0,
  active_users: 0, total_ngos: 0, total_volunteers: 0,
  food_waste_prevented_kg: 0, co2_emissions_saved: 0,
  weekly_growth: 0, monthly_growth: 0,
};

const parseRole = (role?: string): UserRole => {
  const n = (role || '').toUpperCase();
  return n === 'DONOR' || n === 'NGO' || n === 'VOLUNTEER' || n === 'ADMIN' ? n : '';
};

const fmt = (v: number) => new Intl.NumberFormat('en-IN').format(Math.max(0, Math.round(v || 0)));

const Dashboard: React.FC = () => {
  const { state } = useAuth();
  const navigate = useNavigate();
  const role = parseRole(state.user?.role);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);
  const [notiLoading, setNotiLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    analyticsAPI.getDashboardStats()
      .then(r => setStats({ ...DEFAULT_STATS, ...(r.data as Partial<DashboardStats>) }))
      .catch(() => setStats(DEFAULT_STATS))
      .finally(() => setIsLoading(false));
    analyticsAPI.getUserActivities({ limit: 5, notification_only: true })
      .then(r => setNotifications(Array.isArray(r.data) ? r.data : []))
      .catch(() => setNotifications([]))
      .finally(() => setNotiLoading(false));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useRevealOnScroll(isLoading);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    if (h >= 17 && h < 21) return 'Good evening';
    return 'Good night';
  }, [time]);

  const theme = useMemo(() => {
    switch (role) {
      case 'DONOR': return { label: 'Donor', icon: '🍱', gradient: 'from-emerald-600 via-green-600 to-teal-500', accent: 'emerald' };
      case 'NGO': return { label: 'NGO', icon: '🏛️', gradient: 'from-amber-600 via-orange-500 to-yellow-500', accent: 'amber' };
      case 'VOLUNTEER': return { label: 'Volunteer', icon: '🚚', gradient: 'from-blue-600 via-sky-500 to-cyan-500', accent: 'sky' };
      case 'ADMIN': return { label: 'Admin', icon: '🛡️', gradient: 'from-violet-600 via-purple-500 to-fuchsia-500', accent: 'violet' };
      default: return { label: 'User', icon: '📊', gradient: 'from-emerald-600 via-green-600 to-teal-500', accent: 'emerald' };
    }
  }, [role]);

  const myStats = useMemo(() => {
    if (!stats) return [];
    switch (role) {
      case 'DONOR': return [
        { label: 'Total Donations', value: stats.my_donations || 0, icon: '📦', color: 'from-emerald-500 to-green-400' },
        { label: 'Active', value: stats.my_active_donations || 0, icon: '🔄', color: 'from-sky-500 to-blue-400' },
        { label: 'Completed', value: stats.my_completed_donations || 0, icon: '✅', color: 'from-teal-500 to-emerald-400' },
        { label: 'Meals Saved', value: Math.round(stats.my_total_meals_saved || 0), icon: '🍽️', color: 'from-amber-500 to-yellow-400' },
      ];
      case 'NGO': return [
        { label: 'Total Pickups', value: stats.my_pickups || 0, icon: '🚚', color: 'from-orange-500 to-amber-400' },
        { label: 'Completed', value: stats.my_completed_pickups || 0, icon: '✅', color: 'from-emerald-500 to-green-400' },
        { label: 'Pending', value: stats.my_pending_pickups || 0, icon: '⏳', color: 'from-sky-500 to-blue-400' },
        { label: 'Meals Received', value: Math.round(stats.my_total_meals_received || 0), icon: '🍽️', color: 'from-amber-500 to-yellow-400' },
      ];
      case 'VOLUNTEER': return [
        { label: 'Total Deliveries', value: stats.my_deliveries || 0, icon: '🚚', color: 'from-blue-500 to-sky-400' },
        { label: 'Completed', value: stats.my_completed_deliveries || 0, icon: '✅', color: 'from-emerald-500 to-green-400' },
        { label: 'Active', value: stats.my_active_deliveries || 0, icon: '🔄', color: 'from-amber-500 to-yellow-400' },
        { label: 'People Helped', value: (stats.my_completed_deliveries || 0) * 10, icon: '👥', color: 'from-violet-500 to-purple-400' },
      ];
      default: return [
        { label: 'Total Donations', value: stats.total_donations || 0, icon: '📦', color: 'from-emerald-500 to-green-400' },
        { label: 'Active', value: stats.active_donations || 0, icon: '🔄', color: 'from-sky-500 to-blue-400' },
        { label: 'Users', value: stats.active_users || 0, icon: '👥', color: 'from-violet-500 to-purple-400' },
        { label: 'Meals Saved', value: Math.round(stats.total_meals_saved || 0), icon: '🍽️', color: 'from-amber-500 to-yellow-400' },
      ];
    }
  }, [stats, role]);

  const quickActions = useMemo(() => {
    switch (role) {
      case 'DONOR': return [
        { icon: '➕', label: 'New Donation', desc: 'Share surplus food', path: '/create-donation' },
        { icon: '📋', label: 'My Donations', desc: 'Track your listings', path: '/my-donations' },
        { icon: '🍲', label: 'Browse All', desc: 'See available food', path: '/donations' },
        { icon: '🏆', label: 'Leaderboard', desc: 'Your ranking', path: '/leaderboard' },
      ];
      case 'NGO': return [
        { icon: '🍲', label: 'Browse Donations', desc: 'Find food nearby', path: '/donations' },
        { icon: '🚚', label: 'My Pickups', desc: 'Manage pickups', path: '/pickups' },
        { icon: '🏆', label: 'Leaderboard', desc: 'Your ranking', path: '/leaderboard' },
        { icon: '👤', label: 'Profile', desc: 'Update info', path: '/profile' },
      ];
      case 'VOLUNTEER': return [
        { icon: '🚚', label: 'Available Pickups', desc: 'Find assignments', path: '/pickups' },
        { icon: '🏆', label: 'Leaderboard', desc: 'Your ranking', path: '/leaderboard' },
        { icon: '🤖', label: 'AI Tools', desc: 'Smart insights', path: '/ai-tools' },
        { icon: '👤', label: 'Profile', desc: 'Update info', path: '/profile' },
      ];
      case 'ADMIN': return [
        { icon: '📊', label: 'Analytics', desc: 'Platform insights', path: '/analytics' },
        { icon: '🍲', label: 'All Donations', desc: 'Moderate listings', path: '/admin-donations' },
        { icon: '🚛', label: 'All Pickups', desc: 'Track lifecycle', path: '/admin-pickups' },
        { icon: '🏆', label: 'Leaderboard', desc: 'Award points', path: '/leaderboard' },
      ];
      default: return [
        { icon: '👤', label: 'Profile', desc: 'Update details', path: '/profile' },
      ];
    }
  }, [role]);

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3" role="status" aria-label="Loading dashboard">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
        <p className="text-sm text-gray-500 animate-pulse">Loading your dashboard…</p>
      </div>
    );
  }

  const impactItems = [
    { icon: '🌍', label: 'Food Waste Prevented', value: `${Number(stats.food_waste_prevented_kg || 0).toFixed(1)} kg`, color: 'from-emerald-500 to-teal-400' },
    { icon: '🌱', label: 'CO₂ Saved', value: `${Number(stats.co2_emissions_saved || 0).toFixed(1)} kg`, color: 'from-green-500 to-lime-400' },
    { icon: '🍽️', label: 'Total Meals Saved', value: fmt(Math.round(stats.total_meals_saved || 0)), color: 'from-amber-500 to-orange-400' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-2 pb-12 sm:px-0" role="main" aria-label={`${theme.label} Dashboard`}>

      {/* ── Hero Banner ── */}
      <section
        className={`reveal-on-scroll relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.gradient} p-6 sm:p-8 md:p-10 shadow-2xl`}
        aria-label="Welcome banner"
      >
        <div className="absolute inset-0 bg-grid-mask opacity-10 pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-3xl animate-float-slow pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-black/10 rounded-full blur-3xl animate-float-medium pointer-events-none" />

        <div className="relative text-white space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {theme.label} Dashboard
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            {greeting}, <span className="text-white/90">{state.user?.first_name || 'there'}</span>
            <span className="text-3xl ml-2">{theme.icon}</span>
          </h1>

          <p className="text-sm sm:text-base text-white/70 max-w-2xl leading-relaxed">
            {role === 'DONOR' && 'Your donations create the first link in the rescue chain. Keep listing to make an impact.'}
            {role === 'NGO' && 'Coordinate pickups efficiently. Every minute counts when food is on the clock.'}
            {role === 'VOLUNTEER' && 'You are the mobility layer. Fast accept-or-decline decisions reduce idle pickup time.'}
            {role === 'ADMIN' && 'Monitor the health of the entire food rescue network from here.'}
            {!role && 'Welcome to FoodSave. Explore your dashboard and start making an impact.'}
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              🕐 {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              📅 {time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              {fmt(Math.round(stats.total_meals_saved || 0))} meals saved globally
            </span>
            {role === 'ADMIN' && (
              <a
                href="http://localhost:8000/admin/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/20 bg-white/15 px-3 py-1.5 backdrop-blur-sm text-white/80 hover:bg-white/25 hover:text-white transition-colors font-semibold"
              >
                ⚙️ Django Admin Panel
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── My Stats Grid ── */}
      <section className="reveal-on-scroll" aria-label="Your statistics">
        <h2 className="sr-only">Your Statistics</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {myStats.map((s, i) => (
            <div
              key={s.label}
              className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.color} opacity-80`} />
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-gray-50 group-hover:bg-gray-100 text-xl transition-colors shadow-inner">
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 leading-none tabular-nums">{fmt(s.value)}</p>
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1 font-medium truncate">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Impact + Quick Actions Row ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

        {/* Impact Cards */}
        <section className="reveal-on-scroll lg:col-span-3 rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm" aria-label="Global impact">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">🌍 Global Impact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {impactItems.map(item => (
              <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 hover:bg-gray-50 transition-colors">
                <div className={`h-1 w-full rounded-full bg-gradient-to-r ${item.color} mb-3`} />
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{item.label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">{item.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Actions */}
        <section className="reveal-on-scroll lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm" aria-label="Quick actions">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">⚡ Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((a, i) => (
              <button
                key={i}
                onClick={() => navigate(a.path)}
                className="group rounded-xl border border-gray-100 bg-gray-50/60 p-3 sm:p-4 text-left hover:bg-primary-50 hover:border-primary-200 hover:shadow-md transition-all duration-200"
                aria-label={a.label}
              >
                <span className="text-xl block mb-1.5 group-hover:scale-110 transition-transform inline-block">{a.icon}</span>
                <p className="text-sm font-semibold text-gray-800 leading-snug">{a.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{a.desc}</p>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* ── Notifications ── */}
      {(role === 'NGO' || role === 'VOLUNTEER' || role === 'ADMIN') && (
        <section className="reveal-on-scroll rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm" aria-label="Recent notifications">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">🔔 Recent Activity</h2>
            <button
              onClick={() => navigate('/notifications')}
              className="text-xs text-primary-600 font-medium hover:text-primary-700 transition-colors"
            >
              View all →
            </button>
          </div>
          {notiLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No recent activity yet.</p>
          ) : (
            <div className="space-y-2">
              {notifications.map(n => (
                <div key={n.id} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-400 mt-2" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 leading-snug">{n.description}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{new Date(n.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Platform Health (visible to all) ── */}
      <section className="reveal-on-scroll rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm" aria-label="Platform health">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">📈 Platform Health</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active Donations', value: stats.active_donations, total: stats.total_donations, color: 'bg-emerald-500' },
            { label: 'NGO Coverage', value: stats.total_ngos, total: stats.active_users, color: 'bg-amber-500' },
            { label: 'Volunteer Pool', value: stats.total_volunteers, total: stats.active_users, color: 'bg-sky-500' },
            { label: 'Weekly Growth', value: Math.max(0, stats.weekly_growth || 0), total: 100, color: 'bg-violet-500' },
          ].map(m => {
            const pct = m.total > 0 ? Math.min(100, Math.round((m.value / m.total) * 100)) : 0;
            return (
              <div key={m.label} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500">{m.label}</p>
                  <p className="text-xs font-bold text-gray-800">{pct}%</p>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full ${m.color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">{fmt(m.value)} / {fmt(m.total)}</p>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
};

export default Dashboard;
