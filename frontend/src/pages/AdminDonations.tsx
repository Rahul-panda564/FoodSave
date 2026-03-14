import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { donationsAPI } from '../services/api';

interface FoodCategory {
  id: number;
  name: string;
}

interface Donation {
  id: number;
  food_name: string;
  donor: number;
  donor_name?: string | null;
  category: number | null;
  category_name?: string | null;
  quantity: number;
  unit: string;
  description: string;
  cooked_time: string | null;
  expiry_time: string;
  storage_condition: string;
  pickup_address: string;
  status: string;
  is_safe_for_consumption: boolean;
  ai_safety_score?: number | string | null;
  ai_prediction?: 'GOOD' | 'CAUTION' | 'NOT_GOOD' | null;
  image?: string;
  created_at: string;
  updated_at: string;
  hours_until_expiry?: number | null;
}

const INITIAL_FILTERS = { status: '', category: '', search: '' };

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ACCEPTED: 'bg-blue-100 text-blue-800 border-blue-200',
  PICKED_UP: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  DELIVERED: 'bg-purple-100 text-purple-800 border-purple-200',
  EXPIRED: 'bg-red-100 text-red-800 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
};

const AI_BADGE: Record<string, { label: string; cls: string }> = {
  GOOD: { label: 'AI: Good', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  CAUTION: { label: 'AI: Caution', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  NOT_GOOD: { label: 'AI: Not Good', cls: 'bg-red-100 text-red-700 border-red-200' },
};

const STORAGE_ICONS: Record<string, string> = {
  REFRIGERATED: '🧊',
  FROZEN: '❄️',
  AMBIENT: '🌡️',
  HOT: '🔥',
};

type ApiError = {
  response?: {
    data?: {
      detail?: string;
    };
  };
};

const getErrorDetail = (error: unknown, fallback: string): string => {
  const message = (error as ApiError)?.response?.data?.detail;
  return typeof message === 'string' && message.trim() ? message : fallback;
};

const AdminDonations: React.FC = () => {
  const { state } = useAuth();
  const navigate = useNavigate();
  const userRole = (state.user?.role || '').toUpperCase();

  const [donations, setDonations] = useState<Donation[]>([]);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'expiring' | 'quantity' | 'safety'>('newest');
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  useEffect(() => {
    if (userRole !== 'ADMIN') {
      navigate('/dashboard');
    }
  }, [userRole, navigate]);

  useEffect(() => {
    donationsAPI.getCategories().then(res => setCategories(res.data)).catch((_error: unknown) => {});
  }, []);

  const fetchDonations = useCallback(async (f: typeof filters) => {
    setIsLoading(true);
    try {
      const res = await donationsAPI.getDonations({
        status: f.status || undefined,
        category: f.category || undefined,
        search: f.search || undefined,
      });
      const data = res.data.results || res.data;
      setDonations(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      setError(getErrorDetail(error, 'Failed to load donations'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDonations(INITIAL_FILTERS);
  }, [fetchDonations]);

  const handleFilter = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const applyFilters = () => fetchDonations(filters);

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    fetchDonations(INITIAL_FILTERS);
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const statuses: Record<string, number> = {};
  donations.forEach(d => { statuses[d.status] = (statuses[d.status] || 0) + 1; });

  const sortedDonations = [...donations].sort((a, b) => {
    if (sortBy === 'expiring') {
      return new Date(a.expiry_time).getTime() - new Date(b.expiry_time).getTime();
    }
    if (sortBy === 'quantity') {
      return Number(b.quantity) - Number(a.quantity);
    }
    if (sortBy === 'safety') {
      return Number(a.ai_safety_score || 0) - Number(b.ai_safety_score || 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
        <p className="text-sm text-gray-400 animate-pulse">Loading all donations…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">

      {/* ── HERO ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 via-slate-700 to-primary-700 p-7 md:p-10 shadow-2xl">
        <div className="absolute inset-0 bg-grid-mask opacity-10 pointer-events-none" />
        <div className="absolute -top-10 -right-10 w-52 h-52 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white border border-white/25 backdrop-blur-sm mb-3">
              🛡️ Admin Panel
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">All Donations</h1>
            <p className="text-slate-300 mt-1 text-sm">Full platform-wide donation management</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(statuses).map(([s, count]) => (
              <div key={s} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-center border border-white/20">
                <p className="text-lg font-bold text-white">{count}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-300">{s.replace('_', ' ')}</p>
              </div>
            ))}
            {!Object.keys(statuses).length && (
              <div className="bg-white/10 rounded-xl px-4 py-2 border border-white/20">
                <p className="text-lg font-bold text-white">{donations.length}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-300">Total</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* ── FILTERS ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Search</label>
            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleFilter}
              placeholder="Food name, donor…"
              className="ui-input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
            <select name="status" value={filters.status} onChange={handleFilter} className="ui-select">
              <option value="">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="PICKED_UP">Picked Up</option>
              <option value="DELIVERED">Delivered</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sort By</label>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'newest' | 'expiring' | 'quantity' | 'safety')} className="ui-select">
              <option value="newest">Newest</option>
              <option value="expiring">Expiry Soonest</option>
              <option value="quantity">Highest Quantity</option>
              <option value="safety">Lowest Safety Score</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
            <select name="category" value={filters.category} onChange={handleFilter} className="ui-select">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2 md:col-span-2">
            <button onClick={applyFilters} className="flex-1 ui-btn-primary">Apply</button>
            <button onClick={clearFilters} className="px-4 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all min-h-[44px]">Clear</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {['', 'AVAILABLE', 'ACCEPTED', 'PICKED_UP', 'DELIVERED', 'EXPIRED', 'CANCELLED'].map((status) => (
            <button
              key={status || 'all'}
              onClick={() => {
                const nextFilters = { ...filters, status };
                setFilters(nextFilters);
                fetchDonations(nextFilters);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filters.status === status
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              {status || 'All'}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-400 text-center uppercase tracking-[0.14em]">Showing {sortedDonations.length} result{sortedDonations.length !== 1 ? 's' : ''}</p>
      </div>

      {/* ── DONATION CARDS ────────────────────────────── */}
      {sortedDonations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <span className="text-5xl block mb-3">📭</span>
          <p className="font-medium">No donations found for the current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDonations.map(d => {
            const aiBadge = d.ai_prediction ? AI_BADGE[d.ai_prediction] : null;
            const isExpanded = expandedId === d.id;
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
                {/* Summary Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : d.id)}
                  className="w-full text-left p-5 flex flex-wrap items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{d.food_name}</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {d.status.replace('_', ' ')}
                      </span>
                      {aiBadge && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${aiBadge.cls}`}>
                          {aiBadge.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      👤 {d.donor_name || `Donor #${d.donor}`} &nbsp;·&nbsp;
                      🏷️ {d.category_name || '—'} &nbsp;·&nbsp;
                      📦 {d.quantity} {d.unit} &nbsp;·&nbsp;
                      {STORAGE_ICONS[d.storage_condition] || '📦'} {d.storage_condition}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-400 shrink-0">
                    <p>⏰ Exp: {formatDate(d.expiry_time)}</p>
                    <p className="mt-0.5">📅 {formatDate(d.created_at)}</p>
                  </div>
                  <span className="text-gray-400 text-sm ml-1">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Food Details</p>
                        <p className="text-sm text-gray-700"><span className="font-medium">Name:</span> {d.food_name}</p>
                        <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Category:</span> {d.category_name || '—'}</p>
                        <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Quantity:</span> {d.quantity} {d.unit}</p>
                        <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Storage:</span> {STORAGE_ICONS[d.storage_condition]} {d.storage_condition}</p>
                        {d.description && (
                          <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Description:</span> {d.description}</p>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Timeline</p>
                        {d.cooked_time && (
                          <p className="text-sm text-gray-700"><span className="font-medium">Cooked:</span> {formatDate(d.cooked_time)}</p>
                        )}
                        <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Expires:</span> {formatDate(d.expiry_time)}</p>
                        <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Created:</span> {formatDate(d.created_at)}</p>
                        <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Updated:</span> {formatDate(d.updated_at)}</p>
                        {d.hours_until_expiry != null && (
                          <p className={`text-sm mt-1 font-medium ${d.hours_until_expiry < 0 ? 'text-red-600' : d.hours_until_expiry < 24 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {d.hours_until_expiry < 0 ? '⚠️ Expired' : `⏳ ${Math.round(d.hours_until_expiry)}h left`}
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Safety & Location</p>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">AI Score:</span>{' '}
                          {d.ai_safety_score != null ? `${Number(d.ai_safety_score).toFixed(1)} / 100` : '—'}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          <span className="font-medium">Safe:</span>{' '}
                          <span className={d.is_safe_for_consumption ? 'text-emerald-600' : 'text-red-600'}>
                            {d.is_safe_for_consumption ? '✅ Yes' : '❌ No'}
                          </span>
                        </p>
                        <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Address:</span> {d.pickup_address || '—'}</p>
                        <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Donor ID:</span> #{d.donor} ({d.donor_name || 'N/A'})</p>
                        <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Donation ID:</span> #{d.id}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => navigate(`/donations/${d.id}`)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-50 text-primary-700 text-sm font-medium border border-primary-100 hover:bg-primary-100 transition-colors"
                      >
                        👁 View Public Detail
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminDonations;
