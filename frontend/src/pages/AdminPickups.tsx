import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { pickupAPI } from '../services/api';

interface DonationDetails {
  id: number;
  food_name: string;
  category_name?: string | null;
  quantity: number;
  unit: string;
  status: string;
  expiry_time: string;
  pickup_address: string;
  donor_name?: string | null;
  donor: number;
  ai_safety_score?: number | string | null;
  ai_prediction?: 'GOOD' | 'CAUTION' | 'NOT_GOOD' | null;
  storage_condition: string;
  description: string;
  cooked_time: string | null;
  is_safe_for_consumption: boolean;
}

interface PickupRequest {
  id: number;
  donation: number;
  donation_details?: DonationDetails;
  ngo: number;
  ngo_name?: string | null;
  volunteer?: number | null;
  volunteer_name?: string | null;
  status: string;
  assigned_time?: string | null;
  pickup_time?: string | null;
  delivery_time?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-800 border-amber-200',
  ASSIGNED:  'bg-blue-100 text-blue-800 border-blue-200',
  PICKED_UP: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  DELIVERED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
  REJECTED:  'bg-red-100 text-red-700 border-red-200',
};

const DONATION_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700',
  ACCEPTED:  'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-purple-100 text-purple-700',
  EXPIRED:   'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
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

const AdminPickups: React.FC = () => {
  const { state } = useAuth();
  const navigate = useNavigate();
  const userRole = (state.user?.role || '').toUpperCase();

  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'expiry' | 'status'>('newest');

  useEffect(() => {
    if (userRole !== 'ADMIN') navigate('/dashboard');
  }, [userRole, navigate]);

  const fetchPickups = useCallback(async (status?: string) => {
    setIsLoading(true);
    try {
      const res = await pickupAPI.getPickups(status ? { status } : {});
      const data = res.data.results || res.data;
      setPickups(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      setError(getErrorDetail(error, 'Failed to load pickup requests'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchPickups(); }, [fetchPickups]);

  const handleStatusFilter = (s: string) => {
    setStatusFilter(s);
    fetchPickups(s || undefined);
  };

  const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '—';

  // Status count summary
  const statusCounts: Record<string, number> = {};
  pickups.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });

  const visiblePickups = pickups
    .filter((pickup) => {
      const dd = pickup.donation_details;
      const query = search.trim().toLowerCase();
      const matchesStatus = !statusFilter || pickup.status === statusFilter;
      const matchesSearch = !query
        || (dd?.food_name || '').toLowerCase().includes(query)
        || (dd?.category_name || '').toLowerCase().includes(query)
        || (dd?.pickup_address || '').toLowerCase().includes(query)
        || (pickup.ngo_name || '').toLowerCase().includes(query)
        || (pickup.volunteer_name || '').toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'expiry') {
        return new Date(a.donation_details?.expiry_time || 0).getTime() - new Date(b.donation_details?.expiry_time || 0).getTime();
      }
      if (sortBy === 'status') {
        return a.status.localeCompare(b.status);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
        <p className="text-sm text-gray-400 animate-pulse">Loading pickup requests…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">

      {/* ── HERO ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 via-indigo-900 to-secondary-700 p-7 md:p-10 shadow-2xl">
        <div className="absolute inset-0 bg-grid-mask opacity-10 pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-52 h-52 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white border border-white/25 backdrop-blur-sm mb-3">
              🛡️ Admin Panel
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">All Pickup Requests</h1>
            <p className="text-slate-300 mt-1 text-sm">Full platform-wide pickup & delivery tracking</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-center border border-white/20">
              <p className="text-xl font-bold text-white">{pickups.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-300">Total Requests</p>
            </div>
            {Object.entries(statusCounts).map(([s, c]) => (
              <div key={s} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-center border border-white/20">
                <p className="text-lg font-bold text-white">{c}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-300">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* ── STATUS FILTER CHIPS ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Search</label>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Food, NGO, volunteer, address..."
              className="ui-input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sort By</label>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as 'newest' | 'oldest' | 'expiry' | 'status')}
              className="ui-select"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="expiry">Expiry Soonest</option>
              <option value="status">Status</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setSortBy('newest'); }}
              className="w-full min-h-[44px] rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'PENDING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELLED'].map(s => (
          <button
            key={s}
            onClick={() => handleStatusFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 ${
              statusFilter === s
                ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
            }`}
          >
            {s || 'All Statuses'}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 text-center uppercase tracking-[0.14em]">Showing {visiblePickups.length} of {pickups.length}</p>

      {/* ── PICKUP CARDS ──────────────────────────────── */}
      {visiblePickups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <span className="text-5xl block mb-3">🚚</span>
          <p className="font-medium">{pickups.length === 0 ? 'No pickup requests found.' : 'No pickup requests match your current filters.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePickups.map(p => {
            const isExpanded = expandedId === p.id;
            const dd = p.donation_details;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
                {/* Summary Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="w-full text-left p-5 flex flex-wrap items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">
                        {dd ? dd.food_name : `Donation #${p.donation}`}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {p.status}
                      </span>
                      {dd && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${DONATION_STATUS_COLORS[dd.status] || 'bg-gray-100 text-gray-600'}`}>
                          Donation: {dd.status.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      🏢 NGO: {p.ngo_name || `#${p.ngo}`} &nbsp;·&nbsp;
                      🚴 Volunteer: {p.volunteer_name || (p.volunteer ? `#${p.volunteer}` : 'Unassigned')} &nbsp;·&nbsp;
                      📋 Req #{p.id}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-400 shrink-0">
                    <p>📅 {formatDate(p.created_at)}</p>
                    {p.delivery_time && <p className="text-emerald-600 mt-0.5">✅ Delivered</p>}
                  </div>
                  <span className="text-gray-400 text-sm ml-1">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                      {/* Pickup request info */}
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Request Info</p>
                        <p className="text-sm text-gray-700"><span className="font-medium">Request ID:</span> #{p.id}</p>
                        <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Status:</span> {p.status}</p>
                        <p className="text-sm text-gray-700 mt-1"><span className="font-medium">NGO:</span> {p.ngo_name || `#${p.ngo}`}</p>
                        <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Volunteer:</span> {p.volunteer_name || (p.volunteer ? `#${p.volunteer}` : '— Unassigned')}</p>
                        {p.notes && (
                          <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Notes:</span> {p.notes}</p>
                        )}
                      </div>

                      {/* Timeline */}
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Timeline</p>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-base">📋</span>
                            <div>
                              <p className="text-xs font-semibold text-gray-600">Requested</p>
                              <p className="text-xs text-gray-500">{formatDate(p.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-base">👤</span>
                            <div>
                              <p className="text-xs font-semibold text-gray-600">Assigned</p>
                              <p className="text-xs text-gray-500">{formatDate(p.assigned_time)}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-base">🚚</span>
                            <div>
                              <p className="text-xs font-semibold text-gray-600">Picked Up</p>
                              <p className="text-xs text-gray-500">{formatDate(p.pickup_time)}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-base">✅</span>
                            <div>
                              <p className="text-xs font-semibold text-gray-600">Delivered</p>
                              <p className="text-xs text-gray-500">{formatDate(p.delivery_time)}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Donation details */}
                      {dd ? (
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Donation Details</p>
                          <p className="text-sm text-gray-700"><span className="font-medium">Food:</span> {dd.food_name}</p>
                          <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Category:</span> {dd.category_name || '—'}</p>
                          <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Qty:</span> {dd.quantity} {dd.unit}</p>
                          <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Donor:</span> {dd.donor_name || `#${dd.donor}`}</p>
                          <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Pickup At:</span> {dd.pickup_address || '—'}</p>
                          <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Expires:</span> {formatDate(dd.expiry_time)}</p>
                          {dd.ai_safety_score != null && (
                            <p className="text-sm text-gray-700 mt-1">
                              <span className="font-medium">AI Score:</span> {Number(dd.ai_safety_score).toFixed(1)}/100
                              {dd.ai_prediction && ` (${dd.ai_prediction})`}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 flex items-center text-gray-400 text-sm">
                          Donation details not available
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      {dd && (
                        <button
                          onClick={() => navigate(`/donations/${dd.id}`)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-50 text-primary-700 text-sm font-medium border border-primary-100 hover:bg-primary-100 transition-colors"
                        >
                          👁 View Donation
                        </button>
                      )}
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

export default AdminPickups;
