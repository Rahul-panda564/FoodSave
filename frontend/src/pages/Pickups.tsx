import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { pickupAPI } from '../services/api';

interface PickupItem {
  id: number;
  status: 'PENDING' | 'ASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';
  notes?: string;
  ngo_name?: string;
  volunteer_name?: string;
  created_at: string;
  donation_details: {
    id: number;
    food_name: string;
    category_name?: string;
    quantity: number | string;
    unit: string;
    pickup_address: string;
    expiry_time: string;
  };
}

interface ApiErrorPayload {
  error?: string;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return axiosError?.response?.data?.error || fallback;
};

const Pickups: React.FC = () => {
  const { state } = useAuth();
  const location = useLocation();
  const userRole = (state.user?.role || '').toUpperCase();
  const [pickups, setPickups] = useState<PickupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'expiry' | 'status'>('newest');
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const handledDonationRequest = useRef<string>('');

  const fetchPickups = useCallback(async () => {
    try {
      setError('');
      const response = await pickupAPI.getPickups();
      const data = Array.isArray(response.data) ? response.data : [];
      setPickups(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load pickups.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPickups();
  }, [fetchPickups]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const donationId = params.get('donation');
    if (!donationId || userRole !== 'NGO') return;
    if (handledDonationRequest.current === donationId) return;

    const createPickupFromQuery = async () => {
      try {
        handledDonationRequest.current = donationId;
        await pickupAPI.createPickup({ donation: Number(donationId), notes: '' });
        setSuccess('Pickup request created successfully.');
        fetchPickups();
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Failed to create pickup request for this donation.'));
      }
    };

    createPickupFromQuery();
  }, [location.search, userRole, fetchPickups]);

  const updateStatus = async (pickup: PickupItem, status: string) => {
    try {
      setActionLoadingId(pickup.id);
      setError('');
      setSuccess('');
      await pickupAPI.updatePickup(pickup.id, { status });
      setSuccess(`Pickup #${pickup.id} updated to ${status}.`);
      await fetchPickups();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to update pickup status.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const saveNotes = async (pickup: PickupItem) => {
    try {
      setActionLoadingId(pickup.id);
      setError('');
      setSuccess('');
      await pickupAPI.updatePickup(pickup.id, { notes: notesDraft[pickup.id] ?? pickup.notes ?? '' });
      setSuccess(`Notes saved for pickup #${pickup.id}.`);
      await fetchPickups();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to save notes.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const decidePickup = async (pickup: PickupItem, decision: 'ACCEPT' | 'DECLINE') => {
    try {
      setActionLoadingId(pickup.id);
      setError('');
      setSuccess('');
      await pickupAPI.decidePickup(pickup.id, decision);
      setSuccess(`Pickup #${pickup.id} ${decision === 'ACCEPT' ? 'accepted' : 'declined'}.`);
      await fetchPickups();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to submit pickup decision.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusPill = (status: PickupItem['status']) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'ASSIGNED': return 'bg-blue-100 text-blue-800';
      case 'PICKED_UP': return 'bg-purple-100 text-purple-800';
      case 'DELIVERED': return 'bg-emerald-100 text-emerald-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressValue = (status: PickupItem['status']) => {
    switch (status) {
      case 'PENDING': return 22;
      case 'ASSIGNED': return 52;
      case 'PICKED_UP': return 76;
      case 'DELIVERED': return 100;
      case 'CANCELLED': return 100;
      default: return 0;
    }
  };

  const getStatusMessage = (status: PickupItem['status']) => {
    switch (status) {
      case 'PENDING': return 'Waiting for a volunteer or NGO action.';
      case 'ASSIGNED': return 'Pickup has been accepted and is moving to collection.';
      case 'PICKED_UP': return 'Donation is in transit to final delivery.';
      case 'DELIVERED': return 'Delivery completed successfully.';
      case 'CANCELLED': return 'Pickup request was cancelled.';
      default: return 'No workflow state available.';
    }
  };

  const stats = useMemo(() => {
    const total = pickups.length;
    const pending = pickups.filter((p) => p.status === 'PENDING').length;
    const inTransit = pickups.filter((p) => p.status === 'ASSIGNED' || p.status === 'PICKED_UP').length;
    const delivered = pickups.filter((p) => p.status === 'DELIVERED').length;
    return { total, pending, inTransit, delivered };
  }, [pickups]);

  const servicePulse = useMemo(() => ([
    {
      label: 'Open Queue',
      value: stats.pending,
      detail: 'Requests waiting to be accepted into the route stream.',
      tone: 'from-amber-400 to-orange-500',
    },
    {
      label: 'Route Momentum',
      value: stats.inTransit,
      detail: 'Pickups currently in assignment or transport.',
      tone: 'from-primary-500 to-secondary-500',
    },
    {
      label: 'Completed Drops',
      value: stats.delivered,
      detail: 'Deliveries closed successfully and ready for reporting.',
      tone: 'from-emerald-500 to-primary-500',
    },
  ]), [stats]);

  const visiblePickups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pickups
      .filter((pickup) => {
        const matchesStatus = !statusFilter || pickup.status === statusFilter;
        const matchesSearch = !query
          || pickup.donation_details.food_name.toLowerCase().includes(query)
          || (pickup.donation_details.category_name || '').toLowerCase().includes(query)
          || pickup.donation_details.pickup_address.toLowerCase().includes(query)
          || (pickup.ngo_name || '').toLowerCase().includes(query)
          || (pickup.volunteer_name || '').toLowerCase().includes(query);
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'expiry') {
          return new Date(a.donation_details.expiry_time).getTime() - new Date(b.donation_details.expiry_time).getTime();
        }
        if (sortBy === 'status') {
          return a.status.localeCompare(b.status);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [pickups, search, sortBy, statusFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600" />
        <p className="text-sm text-gray-500 animate-pulse">Loading pickups...</p>
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
              Live pickup module
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Pickups and delivery orchestration</h1>
            <p className="max-w-2xl text-sm leading-7 text-white/75 md:text-base">
              Monitor requests, route volunteer actions, save handling notes, and close rescue deliveries with a clearer operational view.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Total Requests', value: stats.total },
              { label: 'Pending', value: stats.pending },
              { label: 'In Transit', value: stats.inTransit },
              { label: 'Delivered', value: stats.delivered },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/12 bg-white/10 px-4 py-4 backdrop-blur-sm">
                <p className="text-2xl font-black">{item.value}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/55">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {servicePulse.map((item) => (
          <div key={item.label} className="rounded-[1.6rem] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.22)]">
            <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${item.tone}`} />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{item.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">⚠️ {error}</div>}
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">✅ {success}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.2)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.2em] mb-1.5">Search</label>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Food, category, address, NGO..."
              className="ui-input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-[0.2em] mb-1.5">Sort By</label>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as 'newest' | 'expiry' | 'status')}
              className="ui-select"
            >
              <option value="newest">Newest</option>
              <option value="expiry">Expiry Soonest</option>
              <option value="status">Status</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setSortBy('newest');
              }}
              className="w-full min-h-[44px] rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all"
            >
              Clear Filters
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {['', 'PENDING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELLED'].map((status) => (
            <button
              key={status || 'all'}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                statusFilter === status
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              {status || 'All'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-400 text-center uppercase tracking-[0.14em]">Showing {visiblePickups.length} of {pickups.length}</p>

      {visiblePickups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-500">
          {pickups.length === 0 ? 'No pickup requests yet.' : 'No pickup requests match your current filters.'}
        </div>
      ) : (
        <div className="space-y-4">
          {visiblePickups.map((pickup) => (
            <div key={pickup.id} className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white/95 p-5 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.24)] space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-900">{pickup.donation_details.food_name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">Pickup #{pickup.id} • {pickup.donation_details.category_name || 'Uncategorized'} • Qty: {pickup.donation_details.quantity} {pickup.donation_details.unit}</p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusPill(pickup.status)}`}>
                  {pickup.status}
                </span>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  <span>Workflow progress</span>
                  <span>{getProgressValue(pickup.status)}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary-500 via-secondary-500 to-emerald-400" style={{ width: `${getProgressValue(pickup.status)}%` }} />
                </div>
                <p className="mt-3 text-sm text-slate-500">{getStatusMessage(pickup.status)}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm text-slate-600">
                {[
                  { label: 'Address', value: pickup.donation_details.pickup_address },
                  { label: 'Expires', value: new Date(pickup.donation_details.expiry_time).toLocaleString() },
                  { label: 'NGO', value: pickup.ngo_name || '—' },
                  { label: 'Volunteer', value: pickup.volunteer_name || 'Not assigned' },
                ].map((field) => (
                  <div key={field.label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{field.label}</p>
                    <p className="mt-2 text-sm font-medium text-slate-700">{field.value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-[0.2em]">Notes</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={notesDraft[pickup.id] ?? pickup.notes ?? ''}
                    onChange={(event) => setNotesDraft((prev) => ({ ...prev, [pickup.id]: event.target.value }))}
                    className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Add handling or delivery notes"
                  />
                  <button
                    onClick={() => saveNotes(pickup)}
                    disabled={actionLoadingId === pickup.id}
                    className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {userRole === 'VOLUNTEER' && pickup.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => decidePickup(pickup, 'ACCEPT')}
                      disabled={actionLoadingId === pickup.id}
                      className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold"
                    >
                      Accept Pickup
                    </button>
                    <button
                      onClick={() => decidePickup(pickup, 'DECLINE')}
                      disabled={actionLoadingId === pickup.id}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold"
                    >
                      Decline Pickup
                    </button>
                  </>
                )}
                {userRole === 'VOLUNTEER' && pickup.status === 'ASSIGNED' && (
                  <button
                    onClick={() => updateStatus(pickup, 'PICKED_UP')}
                    disabled={actionLoadingId === pickup.id}
                    className="px-4 py-2 rounded-xl bg-secondary-600 hover:bg-secondary-700 text-white text-sm font-semibold"
                  >
                    Mark Picked Up
                  </button>
                )}
                {userRole === 'VOLUNTEER' && pickup.status === 'PICKED_UP' && (
                  <button
                    onClick={() => updateStatus(pickup, 'DELIVERED')}
                    disabled={actionLoadingId === pickup.id}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                  >
                    Mark Delivered
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Pickups;
