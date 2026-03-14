import React, { useState, useEffect, useCallback } from 'react';
import { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { donationsAPI } from '../services/api';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll';
import { formatLocalDate, getDonationStatusColor, isDonationExpiringSoon } from '../utils/donationUtils';

interface FoodCategory {
  id: number;
  name: string;
}

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
  donor: number;
  donor_name?: string | null;
  image?: string;
  ai_safety_score?: number | string | null;
  ai_prediction?: 'GOOD' | 'CAUTION' | 'NOT_GOOD' | null;
  is_safe_for_consumption?: boolean;
}

interface ApiErrorPayload {
  detail?: string;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return axiosError?.response?.data?.detail || fallback;
};

const Donations: React.FC = () => {
  const { state } = useAuth();
  const navigate = useNavigate();
  const userRole = (state.user?.role || '').toUpperCase();
  const canViewAllStatuses = userRole === 'ADMIN';
  const [donations, setDonations] = useState<Donation[]>([]);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'expiring' | 'quantity'>('newest');
  const [filters, setFilters] = useState({
    category: '',
    status: canViewAllStatuses ? '' : 'AVAILABLE',
    search: '',
  });

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      status: canViewAllStatuses ? prev.status : 'AVAILABLE',
    }));
  }, [canViewAllStatuses]);

  useEffect(() => {
    donationsAPI.getCategories().then(res => {
      setCategories(res.data);
    }).catch((_error: unknown) => {});
  }, []);

  const fetchDonations = useCallback(async (activeFilters: typeof filters) => {
    try {
      const response = await donationsAPI.getDonations({
        status: activeFilters.status,
        category: activeFilters.category,
        search: activeFilters.search,
      });
      // Handle paginated response
      const donationsData = response.data.results || response.data;
      setDonations(Array.isArray(donationsData) ? donationsData : []);
    } catch (error: unknown) {
      console.error('Failed to fetch donations:', error);
      setError(getApiErrorMessage(error, 'Failed to load donations'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDonations(filters);
  }, [fetchDonations, filters]);

  useRevealOnScroll(`${donations.length}-${isLoading}`);

  const getAISafetyBadge = (donation: Donation) => {
    const score = donation.ai_safety_score !== undefined && donation.ai_safety_score !== null
      ? Number(donation.ai_safety_score)
      : null;
    const prediction = donation.ai_prediction;

    if (prediction === 'NOT_GOOD' || (score !== null && score < 45)) {
      return { label: 'AI: Not Good', className: 'bg-red-100 text-red-800' };
    }
    if (prediction === 'CAUTION' || (score !== null && score < 70)) {
      return { label: 'AI: Caution', className: 'bg-yellow-100 text-yellow-800' };
    }
    if (prediction === 'GOOD' || (score !== null && score >= 70)) {
      return { label: 'AI: Good', className: 'bg-emerald-100 text-emerald-800' };
    }
    return { label: 'AI: Pending', className: 'bg-gray-100 text-gray-700' };
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const applyFilters = () => {
    fetchDonations(filters);
  };

  const clearFilters = () => {
    const defaultFilters = {
      category: '',
      status: canViewAllStatuses ? '' : 'AVAILABLE',
      search: '',
    };
    setFilters(defaultFilters);
    fetchDonations(defaultFilters);
  };

  const statusOptions = canViewAllStatuses
    ? [
        { value: '', label: 'All Status' },
        { value: 'AVAILABLE', label: 'Available' },
        { value: 'ACCEPTED', label: 'Accepted' },
        { value: 'PICKED_UP', label: 'Picked Up' },
        { value: 'DELIVERED', label: 'Delivered' },
        { value: 'EXPIRED', label: 'Expired' },
        { value: 'CANCELLED', label: 'Cancelled' },
      ]
    : [
        { value: 'AVAILABLE', label: 'Available' },
      ];

  const handleDonationClick = (donation: Donation) => {
    if (state.user?.role === 'NGO' || state.user?.role === 'VOLUNTEER') {
      // For NGOs and volunteers, create pickup request
      navigate(`/pickups?donation=${donation.id}`);
    } else {
      // For others, show donation details
      navigate(`/donations/${donation.id}`);
    }
  };

  const availableCount = donations.filter((item) => item.status === 'AVAILABLE').length;
  const expiringSoonCount = donations.filter((item) => isDonationExpiringSoon(item.expiry_time)).length;
  const safeCount = donations.filter((item) => {
    const badge = getAISafetyBadge(item);
    return badge.label === 'AI: Good';
  }).length;

  const rolePresentation = (() => {
    switch (userRole) {
      case 'DONOR':
        return {
          title: 'Community Donations',
          subtitle: 'Discover what is being shared and benchmark your impact.',
          ctaLabel: '🍲 Create Donation',
          ctaPath: '/create-donation',
        };
      case 'NGO':
        return {
          title: 'Available Donations',
          subtitle: 'Find suitable food listings and move quickly on pickup requests.',
          ctaLabel: '🚚 Open Pickups',
          ctaPath: '/pickups',
        };
      case 'VOLUNTEER':
        return {
          title: 'Available Donations',
          subtitle: 'Track fresh listings and coordinate active delivery flow.',
          ctaLabel: '🚚 Open Pickups',
          ctaPath: '/pickups',
        };
      default:
        return {
          title: 'Available Donations',
          subtitle: 'Browse, filter, and claim food donations in your community.',
          ctaLabel: '',
          ctaPath: '',
        };
    }
  })();

  const sortedDonations = [...donations].sort((a, b) => {
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
        <p className="text-sm text-gray-500 animate-pulse">Loading donations…</p>
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
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-white/5 rounded-full blur-xl animate-float-fast pointer-events-none" />

        <div className="relative flex flex-col items-center text-center gap-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-white/20 text-white border-white/30 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse inline-block" />
            {donations.length} Listings
          </span>
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
              {rolePresentation.title}
            </h1>
            <p className="text-primary-100/80 mt-3 text-base md:text-lg max-w-lg mx-auto">
              {rolePresentation.subtitle}
            </p>
            <p className="text-xs text-white/70 mt-2">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          {rolePresentation.ctaLabel && (
            <button
              onClick={() => navigate(rolePresentation.ctaPath)}
              className="mt-1 inline-flex items-center gap-2 bg-white text-primary-700 font-semibold px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
            >
              {rolePresentation.ctaLabel}
            </button>
          )}
        </div>
      </div>

      {/* ── SUMMARY SNAPSHOT ───────────────────────────── */}
      <div className="reveal-on-scroll grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-lg transition-all duration-300">
          <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-2xl">📦</div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{availableCount}</p>
            <p className="text-xs text-gray-500 font-medium">Currently Available</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-lg transition-all duration-300">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-2xl">⏰</div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{expiringSoonCount}</p>
            <p className="text-xs text-gray-500 font-medium">Expiring in 24h</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:shadow-lg transition-all duration-300">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-2xl">🛡️</div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{safeCount}</p>
            <p className="text-xs text-gray-500 font-medium">AI: Good Quality</p>
          </div>
        </div>
      </div>

      {/* ── FILTERS ──────────────────────────────────────── */}
      <div className="reveal-on-scroll">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">Filter Donations</h2>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="search" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Search</label>
              <input
                type="text"
                id="search"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Search by food name…"
                className="w-full px-3 py-2.5 border border-primary-100 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-300 transition"
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
              <select
                id="status"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="w-full px-3 py-2.5 border border-primary-100 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-300 transition"
              >
                {statusOptions.map((option) => (
                  <option key={option.value || 'all-status'} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sortBy" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sort By</label>
              <select
                id="sortBy"
                name="sortBy"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as 'newest' | 'expiring' | 'quantity')}
                className="w-full px-3 py-2.5 border border-primary-100 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-300 transition"
              >
                <option value="newest">Newest</option>
                <option value="expiring">Expiry Soonest</option>
                <option value="quantity">Highest Quantity</option>
              </select>
            </div>

            <div>
              <label htmlFor="category" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
              <select
                id="category"
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                className="w-full px-3 py-2.5 border border-primary-100 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-300 transition"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2 md:col-span-4 lg:col-span-1">
              <button
                onClick={applyFilters}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2.5 px-3 rounded-xl shadow transition-all duration-300 hover:-translate-y-0.5"
              >
                Apply
              </button>
              <button
                onClick={clearFilters}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold py-2.5 px-3 rounded-xl transition-all duration-300 hover:-translate-y-0.5"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <button
                key={option.value || 'all'}
                onClick={() => setFilters((prev) => ({ ...prev, status: option.value }))}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filters.status === option.value
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <span>⚠️</span><span>{error}</span>
        </div>
      )}

      {/* ── DONATIONS LIST ───────────────────────────────── */}
      <div className="reveal-on-scroll">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">
            {sortedDonations.length > 0 ? `${sortedDonations.length} Donation${sortedDonations.length !== 1 ? 's' : ''}` : 'Listings'}
          </h2>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <p className="text-xs text-gray-400 mb-4 text-center uppercase tracking-[0.14em]">Showing {sortedDonations.length} of {donations.length}</p>

        {sortedDonations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary-50 flex items-center justify-center text-4xl mx-auto mb-4">🍲</div>
            <p className="text-lg font-semibold text-gray-800">
              {donations.length === 0 ? 'No donations available right now' : 'No donations match your current filters'}
            </p>
            <p className="text-sm text-gray-400 mt-1 mb-5">
              {donations.length === 0
                ? (state.user?.role === 'DONOR' ? 'Be the first to create a donation!' : 'Check back later for available food donations.')
                : 'Try adjusting search, status, category, or sorting to find more results.'}
            </p>
            {state.user?.role === 'DONOR' && donations.length === 0 && (
              <button
                onClick={() => navigate('/create-donation')}
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2.5 px-5 rounded-xl shadow transition-all duration-300 hover:-translate-y-0.5"
              >
                Create First Donation
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDonations.map((donation, index) => (
              <div
                key={donation.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary-100 group"
                style={{ transitionDelay: `${index * 30}ms` }}
                onClick={() => handleDonationClick(donation)}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    {donation.image ? (
                      <img
                        src={donation.image}
                        alt={donation.food_name}
                        className="w-20 h-20 object-cover rounded-xl shadow-sm group-hover:shadow-md transition-all duration-300"
                        onError={(e) => { e.currentTarget.src = "https://via.placeholder.com/150x150?text=No+Image"; }}
                      />
                    ) : (
                      <div className="w-20 h-20 bg-primary-50 rounded-xl flex items-center justify-center text-3xl">🍲</div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-base font-bold text-gray-900 group-hover:text-primary-700 transition-colors duration-200">{donation.food_name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getDonationStatusColor(donation.status)}`}>
                        {donation.status}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getAISafetyBadge(donation).className}`}>
                        {getAISafetyBadge(donation).label}
                      </span>
                      {isDonationExpiringSoon(donation.expiry_time) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                          ⏰ Expiring Soon
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-gray-500">
                      <span><span className="font-semibold text-gray-700">Category:</span> {donation.category_name || 'Uncategorized'}</span>
                      <span><span className="font-semibold text-gray-700">Qty:</span> {donation.quantity} {donation.unit}</span>
                      <span><span className="font-semibold text-gray-700">Storage:</span> {donation.storage_condition}</span>
                      <span><span className="font-semibold text-gray-700">Donor:</span> {donation.donor_name || 'Unknown donor'}</span>
                      <span className="sm:col-span-2 lg:col-span-2"><span className="font-semibold text-gray-700">Address:</span> {donation.pickup_address}</span>
                    </div>

                    {donation.description && (
                      <p className="mt-2 text-xs text-gray-400 line-clamp-1">{donation.description}</p>
                    )}
                  </div>

                  {/* Expiry badge */}
                  <div className="flex-shrink-0 text-right hidden sm:block">
                    <p className="text-xs text-gray-400">Expires</p>
                    <p className="text-xs font-semibold text-gray-700 mt-0.5">{formatLocalDate(donation.expiry_time)}</p>
                  </div>
                </div>

                  <div className="flex justify-center pt-1">
                    <span className="inline-flex items-center text-primary-600 text-xs font-semibold group-hover:underline">View →</span>
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

export default Donations;
