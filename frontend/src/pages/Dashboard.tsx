import React, { useState, useEffect } from 'react';
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

const DEFAULT_DASHBOARD_STATS: DashboardStats = {
  total_donations: 0,
  active_donations: 0,
  total_meals_saved: 0,
  active_users: 0,
  total_ngos: 0,
  total_volunteers: 0,
  food_waste_prevented_kg: 0,
  co2_emissions_saved: 0,
  weekly_growth: 0,
  monthly_growth: 0,
};

const parseUserRole = (role: string | undefined): UserRole => {
  const normalized = (role || '').toUpperCase();
  if (normalized === 'DONOR' || normalized === 'NGO' || normalized === 'VOLUNTEER' || normalized === 'ADMIN') {
    return normalized;
  }
  return '';
};

const parseDashboardStats = (payload: unknown): DashboardStats => {
  if (!payload || typeof payload !== 'object') {
    return DEFAULT_DASHBOARD_STATS;
  }
  return {
    ...DEFAULT_DASHBOARD_STATS,
    ...(payload as Partial<DashboardStats>),
  };
};

const parseNotifications = (payload: unknown): ActivityNotification[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter((item): item is ActivityNotification => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<ActivityNotification>;
      return (
        typeof candidate.id === 'number'
        && typeof candidate.activity_type === 'string'
        && typeof candidate.description === 'string'
        && typeof candidate.timestamp === 'string'
      );
    });
};

const Dashboard: React.FC = () => {
  const { state } = useAuth();
  const navigate = useNavigate();
  const userRole = parseUserRole(state.user?.role);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchDashboardStats();
    fetchNotifications();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useRevealOnScroll(isLoading);

  const fetchDashboardStats = async () => {
    try {
      const response = await analyticsAPI.getDashboardStats();
      setStats(parseDashboardStats(response.data));
    } catch (error: unknown) {
      console.error('Failed to fetch dashboard stats:', error);
      setStats(DEFAULT_DASHBOARD_STATS);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await analyticsAPI.getUserActivities({ limit: 6, notification_only: true });
      setNotifications(parseNotifications(response.data));
    } catch (error: unknown) {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const getWelcomeMessage = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(currentTime);

    const hourPart = parts.find((part) => part.type === 'hour');
    const hour = hourPart ? Number(hourPart.value) : currentTime.getHours();

    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Good evening';
    return 'Good night';
  };

  const formatNumber = (value: number) => new Intl.NumberFormat('en-IN').format(Math.max(0, Math.round(value || 0)));

  const roleTheme = (() => {
    switch (userRole) {
      case 'DONOR':
        return {
          label: 'Donor Dashboard',
          icon: '🍱',
          hero: 'from-primary-700 via-primary-600 to-emerald-500',
          chip: 'bg-emerald-300',
        };
      case 'NGO':
        return {
          label: 'NGO Dashboard',
          icon: '🏛️',
          hero: 'from-secondary-700 via-amber-600 to-orange-500',
          chip: 'bg-amber-300',
        };
      case 'VOLUNTEER':
        return {
          label: 'Volunteer Dashboard',
          icon: '🚚',
          hero: 'from-sky-700 via-blue-600 to-indigo-500',
          chip: 'bg-cyan-300',
        };
      case 'ADMIN':
        return {
          label: 'Admin Dashboard',
          icon: '🛡️',
          hero: 'from-violet-700 via-purple-600 to-fuchsia-500',
          chip: 'bg-fuchsia-300',
        };
      default:
        return {
          label: 'Dashboard',
          icon: '📊',
          hero: 'from-primary-700 via-primary-600 to-secondary-500',
          chip: 'bg-green-300',
        };
    }
  })();

  const getRoleSpecificContent = () => {
    switch (userRole) {
      case 'DONOR':
        return {
          title: 'Your Donation Impact',
          stats: [
            { label: 'Total Donations', value: stats?.my_donations || 0, icon: '📦' },
            { label: 'Active Donations', value: stats?.my_active_donations || 0, icon: '🔄' },
            { label: 'Completed Donations', value: stats?.my_completed_donations || 0, icon: '✅' },
            { label: 'Meals Saved', value: Math.round(stats?.my_total_meals_saved || 0), icon: '🍽️' },
          ],
        };
      case 'NGO':
        return {
          title: 'Your NGO Impact',
          stats: [
            { label: 'Total Pickups', value: stats?.my_pickups || 0, icon: '🚚' },
            { label: 'Completed Pickups', value: stats?.my_completed_pickups || 0, icon: '✅' },
            { label: 'Pending Pickups', value: stats?.my_pending_pickups || 0, icon: '⏳' },
            { label: 'Meals Received', value: Math.round(stats?.my_total_meals_received || 0), icon: '🍽️' },
          ],
        };
      case 'VOLUNTEER':
        return {
          title: 'Your Volunteer Impact',
          stats: [
            { label: 'Total Deliveries', value: stats?.my_deliveries || 0, icon: '🚚' },
            { label: 'Completed Deliveries', value: stats?.my_completed_deliveries || 0, icon: '✅' },
            { label: 'Active Deliveries', value: stats?.my_active_deliveries || 0, icon: '🔄' },
            { label: 'People Helped', value: Math.round((stats?.my_completed_deliveries || 0) * 10), icon: '👥' },
          ],
        };
      case 'ADMIN':
        return {
          title: 'Platform Overview',
          stats: [
            { label: 'Total Donations', value: stats?.total_donations || 0, icon: '📦' },
            { label: 'Active Donations', value: stats?.active_donations || 0, icon: '🔄' },
            { label: 'Total Users', value: stats?.active_users || 0, icon: '👥' },
            { label: 'Meals Saved', value: Math.round(stats?.total_meals_saved || 0), icon: '🍽️' },
          ],
        };
      default:
        return {
          title: 'Dashboard',
          stats: [],
        };
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
        <p className="text-sm text-gray-500 animate-pulse">Loading your dashboard…</p>
      </div>
    );
  }

  const roleContent = getRoleSpecificContent();

  const pulseMetrics = (() => {
    if (userRole === 'DONOR') {
      const completionRate = (stats.my_donations || 0) > 0 ? ((stats.my_completed_donations || 0) / (stats.my_donations || 1)) * 100 : 0;
      const activeRate = (stats.my_donations || 0) > 0 ? ((stats.my_active_donations || 0) / (stats.my_donations || 1)) * 100 : 0;
      return [
        { label: 'Completion Rate', value: Math.min(100, Math.round(completionRate)), color: 'bg-primary-500' },
        { label: 'Active Pipeline', value: Math.min(100, Math.round(activeRate)), color: 'bg-emerald-500' },
      ];
    }

    if (userRole === 'NGO') {
      const successRate = (stats.my_pickups || 0) > 0 ? ((stats.my_completed_pickups || 0) / (stats.my_pickups || 1)) * 100 : 0;
      const pendingRate = (stats.my_pickups || 0) > 0 ? ((stats.my_pending_pickups || 0) / (stats.my_pickups || 1)) * 100 : 0;
      return [
        { label: 'Pickup Success', value: Math.min(100, Math.round(successRate)), color: 'bg-secondary-500' },
        { label: 'Pending Queue', value: Math.min(100, Math.round(pendingRate)), color: 'bg-orange-500' },
      ];
    }

    if (userRole === 'VOLUNTEER') {
      const completionRate = (stats.my_deliveries || 0) > 0 ? ((stats.my_completed_deliveries || 0) / (stats.my_deliveries || 1)) * 100 : 0;
      const activeRate = (stats.my_deliveries || 0) > 0 ? ((stats.my_active_deliveries || 0) / (stats.my_deliveries || 1)) * 100 : 0;
      return [
        { label: 'Delivery Completion', value: Math.min(100, Math.round(completionRate)), color: 'bg-sky-500' },
        { label: 'Active Routes', value: Math.min(100, Math.round(activeRate)), color: 'bg-blue-500' },
      ];
    }

    const activeDonationRate = (stats.total_donations || 0) > 0 ? ((stats.active_donations || 0) / (stats.total_donations || 1)) * 100 : 0;
    const userNetworkHealth = (stats.active_users || 0) > 0 ? Math.min(100, Math.round(((stats.total_ngos + stats.total_volunteers) / (stats.active_users || 1)) * 100)) : 0;
    return [
      { label: 'Active Donation Ratio', value: Math.min(100, Math.round(activeDonationRate)), color: 'bg-purple-500' },
      { label: 'Network Health', value: Math.min(100, userNetworkHealth), color: 'bg-fuchsia-500' },
    ];
  })();

  const smartSuggestions = (() => {
    switch (userRole) {
      case 'DONOR':
        return [
          { title: 'List a new donation', text: 'Your nearby NGOs have active demand right now.', action: 'Create Donation', path: '/create-donation' },
          { title: 'Review active listings', text: 'Keep your donation status updated to improve pickup speed.', action: 'Open My Donations', path: '/my-donations' },
        ];
      case 'NGO':
        return [
          { title: 'Check nearby donations', text: 'Fresh listings may match your current delivery capacity.', action: 'Browse Donations', path: '/donations' },
          { title: 'Optimize pickup queue', text: 'Prioritize pending pickups to increase completion rate.', action: 'Open Pickups', path: '/pickups' },
        ];
      case 'VOLUNTEER':
        return [
          { title: 'Accept new routes', text: 'There are active requests waiting for volunteer assignment.', action: 'Open Pickups', path: '/pickups' },
          { title: 'Maintain profile readiness', text: 'Updated profile details improve assignment quality.', action: 'Go to Profile', path: '/profile' },
        ];
      case 'ADMIN':
        return [
          { title: 'Review platform analytics', text: 'Track ecosystem trends and identify growth opportunities.', action: 'Open Analytics', path: '/analytics' },
          { title: 'Check donation moderation', text: 'Review listing quality, expiry timelines, and safety scores.', action: 'Open All Donations', path: '/admin-donations' },
        ];
      default:
        return [
          { title: 'Complete your profile', text: 'A complete profile helps the platform personalize your workflow.', action: 'Open Profile', path: '/profile' },
        ];
    }
  })();

  const quickActions = (() => {
    switch (userRole) {
      case 'DONOR':
        return [
          { icon: '📦', label: 'Create Donation', desc: 'Share food with your community', path: '/create-donation', color: 'from-primary-500 to-primary-600' },
          { icon: '📋', label: 'My Donations', desc: "Track donations you've listed", path: '/my-donations', color: 'from-secondary-500 to-secondary-600' },
          { icon: '🍲', label: 'Browse All', desc: 'See what others have shared', path: '/donations', color: 'from-emerald-500 to-emerald-600' },
          { icon: '👤', label: 'Profile', desc: 'Update your details', path: '/profile', color: 'from-gray-500 to-gray-600' },
        ];
      case 'NGO':
        return [
          { icon: '🍲', label: 'Browse Donations', desc: 'Find available food near you', path: '/donations', color: 'from-primary-500 to-primary-600' },
          { icon: '🚚', label: 'My Pickups', desc: 'Manage scheduled pickups', path: '/pickups', color: 'from-secondary-500 to-secondary-600' },
          { icon: '👤', label: 'Profile', desc: "Update your organisation info", path: '/profile', color: 'from-gray-500 to-gray-600' },
        ];
      case 'VOLUNTEER':
        return [
          { icon: '🚚', label: 'Available Pickups', desc: 'Find pickups to volunteer for', path: '/pickups', color: 'from-primary-500 to-primary-600' },
          { icon: '📋', label: 'My Deliveries', desc: 'Track your delivery history', path: '/pickups', color: 'from-secondary-500 to-secondary-600' },
          { icon: '👤', label: 'Profile', desc: 'Update your volunteer info', path: '/profile', color: 'from-gray-500 to-gray-600' },
        ];
      case 'ADMIN':
        return [
          { icon: '📊', label: 'Analytics', desc: 'Platform-wide insights', path: '/analytics', color: 'from-primary-500 to-primary-600' },
          { icon: '🍲', label: 'All Donations', desc: 'View and moderate listings', path: '/admin-donations', color: 'from-secondary-500 to-secondary-600' },
          { icon: '🚛', label: 'All Pickups', desc: 'Track request lifecycle', path: '/admin-pickups', color: 'from-emerald-500 to-emerald-600' },
          { icon: '👥', label: 'Admin Panel', desc: 'Manage users & settings', path: '__admin', color: 'from-purple-500 to-purple-600' },
        ];
      default:
        return [{ icon: '👤', label: 'Profile', desc: 'Update your details', path: '/profile', color: 'from-gray-500 to-gray-600' }];
    }
  })();

  const roleNarrative = (() => {
    switch (userRole) {
      case 'DONOR':
        return {
          eyebrow: 'Rescue supply view',
          title: 'Keep fresh donations moving before value is lost.',
          description: 'Monitor your active food pipeline, spot completion trends, and push new donations into the network with faster timing.',
          panelTitle: 'Donor command brief',
          panelNote: 'Your listings create the first link in the rescue chain. Keep cadence high and expiry risk low.',
        };
      case 'NGO':
        return {
          eyebrow: 'Distribution operations',
          title: 'Coordinate incoming supply with pickup capacity.',
          description: 'Track pickup throughput, monitor pending pressure, and respond to new donation flow with faster claim decisions.',
          panelTitle: 'NGO command brief',
          panelNote: 'Routing quality depends on how fast your team turns nearby donations into scheduled pickups.',
        };
      case 'VOLUNTEER':
        return {
          eyebrow: 'Field mobility layer',
          title: 'Turn assignments into completed deliveries with less friction.',
          description: 'Stay ahead of new requests, keep delivery momentum visible, and manage route readiness from one clean workspace.',
          panelTitle: 'Volunteer command brief',
          panelNote: 'Fast accept-or-decline decisions reduce idle pickup time and help NGOs coordinate the next move.',
        };
      case 'ADMIN':
        return {
          eyebrow: 'Platform command center',
          title: 'See the health of the full food rescue network at a glance.',
          description: 'Track ecosystem growth, moderation surfaces, and operational efficiency without jumping between fragmented panels.',
          panelTitle: 'Admin command brief',
          panelNote: 'Use this page as the live summary layer before drilling into analytics, moderation, and pickup workflows.',
        };
      default:
        return {
          eyebrow: 'Workspace overview',
          title: 'Stay aligned with the latest FoodSave activity.',
          description: 'A compact snapshot of impact, growth, and your next likely actions.',
          panelTitle: 'Workspace brief',
          panelNote: 'The dashboard highlights the most important operational signals first.',
        };
    }
  })();

  const spotlightMetrics = (() => {
    const activeDonationRatio = (stats.total_donations || 0) > 0
      ? Math.round(((stats.active_donations || 0) / (stats.total_donations || 1)) * 100)
      : 0;
    const responseLayer = Math.min(100, Math.round((((stats.total_ngos || 0) + (stats.total_volunteers || 0)) / Math.max(stats.active_users || 1, 1)) * 100));
    const weeklyTrend = Math.round(stats.weekly_growth || 0);
    const monthlyTrend = Math.round(stats.monthly_growth || 0);

    return [
      {
        label: 'Active donation ratio',
        value: `${activeDonationRatio}%`,
        detail: 'Live listings compared with total donations recorded on the platform.',
        tone: 'from-primary-500 to-emerald-400',
      },
      {
        label: 'Response layer',
        value: `${responseLayer}%`,
        detail: 'NGO and volunteer density relative to total active users.',
        tone: 'from-secondary-500 to-orange-400',
      },
      {
        label: 'Weekly growth',
        value: `${weeklyTrend >= 0 ? '+' : ''}${weeklyTrend}%`,
        detail: 'Week-over-week platform donation movement.',
        tone: 'from-sky-500 to-indigo-400',
      },
      {
        label: 'Monthly growth',
        value: `${monthlyTrend >= 0 ? '+' : ''}${monthlyTrend}%`,
        detail: 'Longer-range momentum across donation activity.',
        tone: 'from-fuchsia-500 to-violet-400',
      },
    ];
  })();

  const commandDeck = (() => {
    switch (userRole) {
      case 'DONOR':
        return [
          { label: 'My active listings', value: formatNumber(stats.my_active_donations || 0) },
          { label: 'My completed rescues', value: formatNumber(stats.my_completed_donations || 0) },
          { label: 'Meals moved', value: formatNumber(Math.round(stats.my_total_meals_saved || 0)) },
        ];
      case 'NGO':
        return [
          { label: 'Pending queue', value: formatNumber(stats.my_pending_pickups || 0) },
          { label: 'Completed pickups', value: formatNumber(stats.my_completed_pickups || 0) },
          { label: 'Meals received', value: formatNumber(Math.round(stats.my_total_meals_received || 0)) },
        ];
      case 'VOLUNTEER':
        return [
          { label: 'Active routes', value: formatNumber(stats.my_active_deliveries || 0) },
          { label: 'Completed drops', value: formatNumber(stats.my_completed_deliveries || 0) },
          { label: 'Total deliveries', value: formatNumber(stats.my_deliveries || 0) },
        ];
      case 'ADMIN':
        return [
          { label: 'Total donations', value: formatNumber(stats.total_donations || 0) },
          { label: 'Network users', value: formatNumber(stats.active_users || 0) },
          { label: 'Meals saved', value: formatNumber(Math.round(stats.total_meals_saved || 0)) },
        ];
      default:
        return [
          { label: 'Active donations', value: formatNumber(stats.active_donations || 0) },
          { label: 'Users', value: formatNumber(stats.active_users || 0) },
          { label: 'Meals saved', value: formatNumber(Math.round(stats.total_meals_saved || 0)) },
        ];
    }
  })();

  const impactCards = [
    { icon: '🌍', label: 'Food Waste Prevented', value: `${Number(stats.food_waste_prevented_kg || 0).toFixed(1)} kg`, accent: 'from-primary-500 to-emerald-400' },
    { icon: '🌱', label: 'CO₂ Emissions Saved', value: `${Number(stats.co2_emissions_saved || 0).toFixed(1)} kg`, accent: 'from-secondary-500 to-orange-400' },
    { icon: '🍽️', label: 'Total Meals Saved', value: `${Math.round(stats.total_meals_saved || 0)}`, accent: 'from-sky-500 to-indigo-400' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-1 pb-10 sm:px-0">

      <div className={`reveal-on-scroll relative overflow-hidden rounded-[2rem] shadow-[0_35px_90px_-45px_rgba(15,23,42,0.72)] bg-gradient-to-br ${roleTheme.hero} p-8 md:p-10`}>
        <div className="absolute inset-0 bg-grid-mask opacity-15" />
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-2xl animate-float-slow pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-black/10 rounded-full blur-2xl animate-float-medium pointer-events-none" />
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-white/5 rounded-full blur-xl animate-float-fast pointer-events-none" />

        <div className="relative space-y-8 text-white">
          <div className="space-y-5 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/85 backdrop-blur-sm">
              <span className={`w-1.5 h-1.5 rounded-full ${roleTheme.chip} animate-pulse inline-block`} />
              {roleNarrative.eyebrow}
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/60">{roleTheme.icon} {roleTheme.label}</p>
              <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white md:text-5xl lg:text-6xl">
                {getWelcomeMessage()}, <span className="text-primary-100">{state.user?.first_name}.</span>
              </h1>
              <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-white/78 md:text-base">
                {roleNarrative.title} {roleNarrative.description}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 text-xs text-white/75">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">{currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Live sync {currentTime.toLocaleTimeString('en-IN')}</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">Meals saved {formatNumber(Math.round(stats.total_meals_saved || 0))}</span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-4xl rounded-[1.8rem] border border-white/12 bg-slate-950/20 p-5 text-white backdrop-blur-md shadow-[0_25px_70px_-40px_rgba(15,23,42,0.9)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">{roleNarrative.panelTitle}</p>
            <h2 className="mt-2 text-2xl font-bold text-center">Today's operating picture</h2>
            <p className="mt-2 text-center text-sm leading-6 text-white/70">{roleNarrative.panelNote}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {commandDeck.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/12 bg-white/10 px-4 py-4 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/55">{item.label}</p>
                  <p className="mt-2 text-2xl font-black text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="reveal-on-scroll grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {spotlightMetrics.map((item) => (
          <div key={item.label} className="group relative overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/95 p-5 shadow-[0_20px_55px_-34px_rgba(15,23,42,0.26)]">
            <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${item.tone}`} />
            <div className="absolute right-[-1.25rem] top-[-1.25rem] h-24 w-24 rounded-full bg-slate-900/5 blur-2xl transition-transform duration-500 group-hover:scale-125" />
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
            <p className="mt-4 text-3xl font-black text-slate-900">{item.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="reveal-on-scroll">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">{roleContent.title}</h2>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {roleContent.stats.map((stat, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white/95 p-5 text-center shadow-[0_18px_45px_-30px_rgba(15,23,42,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_65px_-34px_rgba(15,23,42,0.28)]"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary-500 via-secondary-500 to-emerald-400" />
              <div className="w-12 h-12 rounded-xl bg-primary-50 group-hover:bg-primary-100 transition-colors duration-300 flex items-center justify-center text-2xl shadow-inner mx-auto">
                {stat.icon}
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-gray-900 leading-none">{formatNumber(stat.value)}</p>
                <p className="text-xs text-gray-500 mt-1.5 font-medium">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="reveal-on-scroll rounded-[1.8rem] border border-slate-200 bg-white/95 p-6 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.24)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">Global Impact</h2>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {impactCards.map((item) => (
              <div key={item.label} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
                <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${item.accent}`} />
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">{item.icon}</div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{item.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="reveal-on-scroll rounded-[1.8rem] border border-slate-200 bg-white/95 p-6 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.24)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">Performance Pulse</h2>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="space-y-4">
            {pulseMetrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">{metric.label}</p>
                  <p className="text-sm font-bold text-gray-900">{metric.value}%</p>
                </div>
                <div className="mt-3 h-2.5 bg-white rounded-full overflow-hidden shadow-inner">
                  <div className={`h-full ${metric.color} rounded-full transition-all duration-700`} style={{ width: `${metric.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="reveal-on-scroll">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">Quick Actions</h2>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => action.path === '__admin' ? window.open('http://localhost:8000/admin', '_blank') : navigate(action.path)}
              className="group relative overflow-hidden bg-white rounded-[1.7rem] border border-gray-100 shadow-sm p-5 flex flex-col items-center text-center gap-3 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-primary-100 cursor-pointer"
            >
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${action.color}`} />
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-xl shadow-md group-hover:scale-110 transition-transform duration-300`}>
                {action.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{action.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {(userRole === 'NGO' || userRole === 'VOLUNTEER') && (
        <div className="reveal-on-scroll">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">Notifications</h2>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.22)] p-5">
            {notificationsLoading ? (
              <p className="text-sm text-gray-500">Loading notifications...</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-gray-500">No new notifications yet.</p>
            ) : (
              <>
                <div className="space-y-3">
                  {notifications.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-gray-800">{item.description}</p>
                        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700">Alert</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-right">
                  <button
                    onClick={() => navigate('/notifications')}
                    className="inline-flex items-center rounded-lg bg-primary-600 text-white text-sm font-medium px-4 py-2 hover:bg-primary-700 transition-colors"
                  >
                    View all notifications
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="reveal-on-scroll">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-200" />
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">Smart Suggestions</h2>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {smartSuggestions.map((suggestion) => (
            <div key={suggestion.title} className="relative overflow-hidden bg-white rounded-[1.7rem] border border-gray-100 shadow-sm p-5 hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary-500 via-secondary-500 to-emerald-400" />
              <h3 className="text-base font-semibold text-gray-900">{suggestion.title}</h3>
              <p className="text-sm text-gray-600 mt-2 leading-6">{suggestion.text}</p>
              <button
                onClick={() => navigate(suggestion.path)}
                className="mt-4 inline-flex items-center rounded-lg bg-primary-600 text-white text-sm font-medium px-4 py-2 hover:bg-primary-700 transition-colors"
              >
                {suggestion.action}
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
