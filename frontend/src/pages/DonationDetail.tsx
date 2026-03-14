import React, { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { donationsAPI } from '../services/api';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll';

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
}

interface ApiErrorPayload {
  detail?: string;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return axiosError?.response?.data?.detail || fallback;
};

const DonationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { state } = useAuth();
  const navigate = useNavigate();
  const [donation, setDonation] = useState<Donation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useRevealOnScroll(`${Boolean(donation)}-${isLoading}`);

  useEffect(() => {
    const fetchDonation = async () => {
      try {
        const response = await donationsAPI.getDonation(Number(id));
        setDonation(response.data);
      } catch (error: unknown) {
        console.error('Failed to fetch donation:', error);
        setError(getApiErrorMessage(error, 'Failed to load donation'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchDonation();
  }, [id]);

  const handleRequestPickup = () => {
    if (state.user?.role === 'NGO' || state.user?.role === 'VOLUNTEER') {
      navigate(`/pickups?donation=${id}`);
    } else {
      navigate('/login');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-100 text-green-800';
      case 'ACCEPTED':
        return 'bg-blue-100 text-blue-800';
      case 'PICKED_UP':
        return 'bg-yellow-100 text-yellow-800';
      case 'DELIVERED':
        return 'bg-purple-100 text-purple-800';
      case 'EXPIRED':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isExpiringSoon = (expiryTime: string) => {
    const expiry = new Date(expiryTime);
    const now = new Date();
    const hoursUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getAISafetyInfo = () => {
    if (!donation) return { label: 'Pending', className: 'bg-gray-100 text-gray-700' };
    const score = donation.ai_safety_score !== undefined && donation.ai_safety_score !== null
      ? Number(donation.ai_safety_score)
      : null;

    if (donation.ai_prediction === 'NOT_GOOD' || (score !== null && score < 45)) {
      return { label: 'Not Good', className: 'bg-red-100 text-red-800' };
    }
    if (donation.ai_prediction === 'CAUTION' || (score !== null && score < 70)) {
      return { label: 'Caution', className: 'bg-yellow-100 text-yellow-800' };
    }
    if (donation.ai_prediction === 'GOOD' || (score !== null && score >= 70)) {
      return { label: 'Good', className: 'bg-emerald-100 text-emerald-800' };
    }
    return { label: 'Pending', className: 'bg-gray-100 text-gray-700' };
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      </div>
    );
  }

  if (!donation) {
    return (
      <div className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center text-gray-500">
            <span className="text-6xl">🍲</span>
            <p className="mt-4 text-lg">Donation not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-7 pb-10">
      <div className="reveal-on-scroll relative overflow-hidden rounded-3xl shadow-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-secondary-500 p-7 md:p-10">
        <div className="absolute inset-0 bg-grid-mask opacity-15" />
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-2xl animate-float-slow pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-black/10 rounded-full blur-2xl animate-float-medium pointer-events-none" />

        <div className="relative text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-white/20 text-white border-white/30 backdrop-blur-sm">
            🍲 Donation Detail
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-3">{donation.food_name}</h1>
          <p className="text-primary-100/85 mt-2 max-w-2xl mx-auto">Full donation context, safety estimate, and pickup readiness in one place.</p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(donation.status)}`}>
              {donation.status}
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getAISafetyInfo().className}`}>
              AI: {getAISafetyInfo().label}
            </span>
            {isExpiringSoon(donation.expiry_time) && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                ⏰ Expiring Soon
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="reveal-on-scroll grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500">Quantity</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{donation.quantity} {donation.unit}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500">Category</p>
          <p className="text-base font-semibold text-gray-900 mt-1">{donation.category_name || 'Uncategorized'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500">Created</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(donation.created_at)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500">Expires</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(donation.expiry_time)}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden reveal-on-scroll">
        <div className="p-6 sm:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Image and Basic Info */}
            <div className="space-y-6">
              {/* Image */}
              {donation.image ? (
                <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-100">
                  <img
                    src={donation.image}
                    alt={donation.food_name}
                    className="w-full h-64 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "https://via.placeholder.com/400x300?text=No+Image";
                    }}
                  />
                </div>
              ) : (
                <div className="w-full h-64 bg-gray-100 rounded-2xl border border-gray-100 flex items-center justify-center">
                  <span className="text-gray-400 text-6xl">🍲</span>
                </div>
              )}

              {/* Basic Information */}
              <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Donation Details</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Category:</span>
                    <span className="text-sm text-gray-900">{donation.category_name || 'Uncategorized'}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Quantity:</span>
                    <span className="text-sm text-gray-900">{donation.quantity} {donation.unit}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Storage:</span>
                    <span className="text-sm text-gray-900">{donation.storage_condition}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className={`text-sm px-2 py-1 rounded-full font-medium ${getStatusColor(donation.status)}`}>
                      {donation.status}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">AI Food Safety:</span>
                    <span className={`text-sm px-2 py-1 rounded-full font-medium ${getAISafetyInfo().className}`}>
                      {getAISafetyInfo().label}
                    </span>
                  </div>

                  {donation.ai_safety_score !== undefined && donation.ai_safety_score !== null && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">AI Score:</span>
                      <span className="text-sm text-gray-900">{Number(donation.ai_safety_score).toFixed(1)} / 100</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Expires:</span>
                    <span className="text-sm text-gray-900">{formatDate(donation.expiry_time)}</span>
                  </div>
                  
                  {donation.cooked_time && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">Cooked:</span>
                      <span className="text-sm text-gray-900">{formatDateTime(donation.cooked_time)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Donor and Action */}
            <div className="space-y-6">
              {/* Donor Information */}
              <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Donor Information</h2>
                
                <div className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Name:</span>
                    <p className="text-sm text-gray-900 mt-1">{donation.donor_name || 'Unknown donor'}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-600">Pickup Address:</span>
                    <p className="text-sm text-gray-900 mt-1">{donation.pickup_address}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {donation.description && (
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
                  <p className="text-sm text-gray-700">{donation.description}</p>
                </div>
              )}

              {/* Action Button */}
              {donation.status === 'AVAILABLE' && state.isAuthenticated && (
                <div className="bg-primary-50 rounded-2xl p-6 border border-primary-100">
                  <h2 className="text-lg font-semibold text-primary-900 mb-4">Request Pickup</h2>
                  <p className="text-sm text-primary-700 mb-4">
                    Help reduce food waste by requesting this donation for pickup.
                  </p>
                  <button
                    onClick={handleRequestPickup}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-xl shadow transition duration-200 ease-in-out"
                  >
                    {state.user?.role === 'DONOR' ? 'View Details' : 'Request Pickup'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonationDetail;
