import React, { useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { analyticsAPI } from '../services/api';

interface ActivityItem {
  id: number;
  activity_type: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface ApiErrorPayload {
  error?: string;
  detail?: string;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return axiosError?.response?.data?.error || axiosError?.response?.data?.detail || fallback;
};

type NotificationFilter = 'ALL' | 'DONATION' | 'PICKUP' | 'SYSTEM';

const Notifications: React.FC = () => {
  const { state } = useAuth();
  const userRole = (state.user?.role || '').toUpperCase();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('ALL');

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setError('');
        const response = await analyticsAPI.getUserActivities({ limit: 100 });
        const data = Array.isArray(response.data) ? response.data : [];
        setActivities(data);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Failed to load notifications.'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const relevantActivities = useMemo(() => {
    return activities.filter((item) => {
      if (item.activity_type.startsWith('notification_')) return true;
      if (userRole === 'DONOR' && item.activity_type === 'donation_expired') return true;
      return false;
    });
  }, [activities, userRole]);

  const getNotificationBucket = (item: ActivityItem): NotificationFilter => {
    if (item.activity_type.includes('donation')) return 'DONATION';
    if (item.activity_type.includes('pickup')) return 'PICKUP';
    return 'SYSTEM';
  };

  const visibleNotifications = useMemo(() => {
    return relevantActivities.filter((item) => {
      if (activeFilter === 'ALL') return true;
      return getNotificationBucket(item) === activeFilter;
    });
  }, [activeFilter, relevantActivities]);

  const stats = useMemo(() => ({
    total: relevantActivities.length,
    donations: relevantActivities.filter((item) => getNotificationBucket(item) === 'DONATION').length,
    pickups: relevantActivities.filter((item) => getNotificationBucket(item) === 'PICKUP').length,
    system: relevantActivities.filter((item) => getNotificationBucket(item) === 'SYSTEM').length,
  }), [relevantActivities]);

  const getTone = (item: ActivityItem) => {
    if (item.activity_type.includes('accepted')) return 'border-emerald-200 bg-emerald-50';
    if (item.activity_type.includes('declined') || item.activity_type.includes('expired')) return 'border-rose-200 bg-rose-50';
    if (item.activity_type.includes('pickup')) return 'border-sky-200 bg-sky-50';
    return 'border-amber-200 bg-amber-50';
  };

  const getLabel = (item: ActivityItem) => {
    if (item.activity_type === 'notification_donation_posted') return 'New donation';
    if (item.activity_type === 'notification_pickup_requested') return 'Pickup request';
    if (item.activity_type === 'notification_pickup_accepted') return 'Volunteer accepted';
    if (item.activity_type === 'notification_pickup_declined') return 'Volunteer declined';
    if (item.activity_type === 'donation_expired') return 'Donation expired';
    return 'Update';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
        <p className="text-sm text-gray-500 animate-pulse">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 shadow-[0_30px_85px_-44px_rgba(15,23,42,0.85)] md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.24),_transparent_36%),radial-gradient(circle_at_85%_18%,_rgba(249,115,22,0.22),_transparent_28%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,118,110,0.9))]" />
        <div className="absolute inset-0 bg-grid-mask opacity-20" />
        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end text-white">
          <div className="space-y-4">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/85">
              Live notification feed
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Workflow notifications</h1>
            <p className="max-w-2xl text-sm leading-7 text-white/75 md:text-base">
              Track donation alerts, pickup requests, volunteer decisions, and operational updates from one place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'All Alerts', value: stats.total },
              { label: 'Donation Alerts', value: stats.donations },
              { label: 'Pickup Alerts', value: stats.pickups },
              { label: 'System Alerts', value: stats.system },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/12 bg-white/10 px-4 py-4 backdrop-blur-sm">
                <p className="text-2xl font-black">{item.value}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/55">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">⚠️ {error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.2)]">
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'DONATION', 'PICKUP', 'SYSTEM'] as NotificationFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeFilter === filter
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              {filter === 'ALL' ? 'All' : filter}
            </button>
          ))}
        </div>
      </div>

      {visibleNotifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-500">
          No notifications found for this filter.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleNotifications.map((item) => (
            <div key={item.id} className={`rounded-[1.6rem] border p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.18)] ${getTone(item)}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{getLabel(item)}</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{item.description}</p>
                </div>
                <p className="text-xs font-medium text-slate-500">{new Date(item.timestamp).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;