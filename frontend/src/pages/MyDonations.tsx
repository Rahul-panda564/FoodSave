import React, { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { donationsAPI } from '../services/api';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll';
import { formatLocalDateTime, getDonationStatusColor, isDonationExpiringSoon } from '../utils/donationUtils';

interface Donation {
  id: number;
  food_name: string;
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
  created_at: string;
}

interface ApiErrorPayload {
  detail?: string;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return axiosError?.response?.data?.detail || fallback;
};

const MyDonations: React.FC = () => {
  const { state } = useAuth();
  const navigate = useNavigate();
  const userRole = (state.user?.role || '').toUpperCase();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'expiring' | 'quantity'>('newest');

  useEffect(() => {
    const fetchMyDonations = async () => {
      try {
        const response = await donationsAPI.getMyDonations();
        setDonations(response.data);
      } catch (error: unknown) {
        console.error('Failed to fetch donations:', error);
        setError(getApiErrorMessage(error, 'Failed to load donations'));
      } finally {
        setIsLoading(false);
      }
    };

    if (!state.user) {
      return;
    }

    if (userRole !== 'DONOR') {
      navigate('/dashboard');
      return;
    }
    fetchMyDonations();
  }, [navigate, state.user, userRole]);

  useRevealOnScroll(`${isLoading}-${donations.length}`);

  const stats = {
    total: donations.length,
    active: donations.filter((item) => ['AVAILABLE', 'RESERVED', 'ACCEPTED'].includes(item.status)).length,
    completed: donations.filter((item) => ['COLLECTED', 'PICKED_UP', 'DELIVERED'].includes(item.status)).length,
    expiringSoon: donations.filter((item) => isDonationExpiringSoon(item.expiry_time)).length,
  };

  const visibleDonations = donations
    .filter((item) => {
      const matchesStatus = !statusFilter || item.status === statusFilter;
      const query = search.trim().toLowerCase();
      const matchesSearch = !query
        || item.food_name.toLowerCase().includes(query)
        || (item.category_name || '').toLowerCase().includes(query)
        || (item.pickup_address || '').toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'expiring') {
        return new Date(a.expiry_time).getTime() - new Date(b.expiry_time).getTime();
      }
      if (sortBy === 'quantity') {
        return Number(b.quantity) - Number(a.quantity);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
        <p className="text-sm text-gray-500 animate-pulse">Loading your donations…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">

      {/* ── HERO ─────────────────────────────────────────── */}
      <div className="reveal-on-scroll relative overflow-hidden rounded-3xl shadow-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-secondary-500 p-7 md:p-12">
        <div className="absolute inset-0 bg-grid-mask opacity-15" />
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-2xl animate-float-slow pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-black/10 rounded-full blur-2xl animate-float-medium pointer-events-none" />

        <div className="relative flex flex-col items-center text-center gap-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-white/20 text-white border-white/30 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse inline-block" />
            {donations.length} Donation{donations.length !== 1 ? 's' : ''}
          </span>
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">My Donations</h1>
            <p className="text-primary-100/80 mt-3 text-base md:text-lg max-w-lg mx-auto">Track and manage all the food donations you've created.</p>
            <p className="text-xs text-white/70 mt-2">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button
            onClick={() => navigate('/create-donation')}
            className="mt-1 inline-flex items-center gap-2 bg-white text-primary-700 font-semibold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
          >
            ➕ New Donation
          </button>
        </div>
      </div>

      <div className="reveal-on-scroll grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500">Active</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500">Expiring Soon</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.expiringSoon}</p>
        </div>
      </div>

      <div className="reveal-on-scroll bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Search</label>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Food, category, address..."
              className="ui-input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="ui-select">
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
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'newest' | 'expiring' | 'quantity')} className="ui-select">
              <option value="newest">Newest</option>
              <option value="expiring">Expiry Soonest</option>
              <option value="quantity">Highest Quantity</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <span>⚠️</span><span>{error}</span>
        </div>
      )}

      {/* ── DONATIONS ────────────────────────────────────── */}
      <div className="reveal-on-scroll">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">Your Listings</h2>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <p className="text-xs text-gray-400 mb-4 text-center uppercase tracking-[0.14em]">Showing {visibleDonations.length} of {donations.length}</p>

        {visibleDonations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary-50 flex items-center justify-center text-4xl mx-auto mb-4">📦</div>
            <p className="text-lg font-semibold text-gray-800">
              {donations.length === 0 ? 'No donations yet' : 'No donations match your current filters'}
            </p>
            <p className="text-sm text-gray-400 mt-1 mb-5">
              {donations.length === 0 ? 'Start by creating your first food donation.' : 'Try changing search, status, or sort to see more results.'}
            </p>
            {donations.length === 0 && (
              <button
                onClick={() => navigate('/create-donation')}
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2.5 px-5 rounded-xl shadow transition-all duration-300 hover:-translate-y-0.5"
              >
                Create Your First Donation
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {visibleDonations.map((donation, index) => (
              <div
                key={donation.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary-100"
                style={{ transitionDelay: `${index * 30}ms` }}
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary-50 flex items-center justify-center text-2xl flex-shrink-0">📦</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-base font-bold text-gray-900">{donation.food_name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getDonationStatusColor(donation.status)}`}>
                        {donation.status}
                      </span>
                      {isDonationExpiringSoon(donation.expiry_time) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                          ⏰ Expiring Soon
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs text-gray-500">
                      <span><span className="font-semibold text-gray-700">Category:</span> {donation.category_name || 'Uncategorized'}</span>
                      <span><span className="font-semibold text-gray-700">Qty:</span> {donation.quantity} {donation.unit}</span>
                      <span><span className="font-semibold text-gray-700">Storage:</span> {donation.storage_condition}</span>
                      <span className="md:col-span-2"><span className="font-semibold text-gray-700">Address:</span> {donation.pickup_address}</span>
                      <span><span className="font-semibold text-gray-700">Created:</span> {formatLocalDateTime(donation.created_at)}</span>
                    </div>

                    {donation.description && (
                      <p className="mt-2 text-xs text-gray-400 line-clamp-1">{donation.description}</p>
                    )}

                    <div className="mt-3">
                      <button
                        onClick={() => navigate(`/donations/${donation.id}`)}
                        className="inline-flex items-center text-xs font-semibold text-primary-600 hover:text-primary-700"
                      >
                        View Details →
                      </button>
                    </div>
                  </div>

                  <div className="text-right hidden sm:block flex-shrink-0">
                    <p className="text-xs text-gray-400">Expires</p>
                    <p className="text-xs font-semibold text-gray-700 mt-0.5">{formatLocalDateTime(donation.expiry_time)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyDonations;
