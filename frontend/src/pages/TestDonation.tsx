import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { donationsAPI } from '../services/api';

type ApiError = {
  response?: {
    data?: {
      detail?: string;
    };
  };
  message?: string;
};

const getErrorMessage = (error: unknown): string => {
  const apiError = error as ApiError;
  return apiError?.response?.data?.detail || apiError?.message || 'Unknown error';
};

const TestDonation: React.FC = () => {
  const { state } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      // Simple test donation data
      const donationData = {
        food_name: 'Test Food Donation',
        category: 1, // Use first category
        quantity: 5.0,
        unit: 'kg',
        description: 'This is a test donation',
        expiry_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        storage_condition: 'REFRIGERATED',
        pickup_address: '123 Test Street, Test City',
        pickup_latitude: null,
        pickup_longitude: null,
      };

      console.log('Submitting donation:', donationData);
      
      const response = await donationsAPI.createDonation(donationData);
      console.log('Response:', response);
      
      setSuccess('✅ Donation created successfully!');
      setTimeout(() => navigate('/my-donations'), 2000);
      
    } catch (error: unknown) {
      console.error('Donation creation error:', error);
      setError(`❌ Error: ${getErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (state.user?.role !== 'DONOR') {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-5 py-4 text-sm sm:text-base shadow-sm">
          ❌ This page is only accessible to DONOR users. Current role: {state.user?.role}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 px-4 sm:px-0 pb-10">
      <div className="relative overflow-hidden rounded-[1.6rem] sm:rounded-[2rem] bg-slate-950 p-6 sm:p-8 shadow-[0_30px_85px_-44px_rgba(15,23,42,0.85)] md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.24),_transparent_35%),radial-gradient(circle_at_84%_20%,_rgba(249,115,22,0.2),_transparent_28%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,118,110,0.9))]" />
        <div className="absolute inset-0 bg-grid-mask opacity-20" />
        <div className="relative text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Internal QA Surface</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">🧪 Test Donation Creation</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">Fast donor test panel to validate create-donation API, auth scope, and post-create navigation.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm">
          {success}
        </div>
      )}

      <div className="rounded-[1.4rem] sm:rounded-[1.8rem] border border-slate-200 bg-white/95 p-5 sm:p-6 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.22)]">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 mb-6 text-sm">
          <p><strong>Test Mode:</strong> This will create a simple test donation with predefined data.</p>
          <p><strong>User Role:</strong> {state.user?.role}</p>
          <p><strong>User Email:</strong> {state.user?.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <h3 className="font-semibold text-slate-900 mb-2">Test Donation Data:</h3>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Food Name: Test Food Donation</li>
              <li>• Category: 1 (Vegetables)</li>
              <li>• Quantity: 5.0 kg</li>
              <li>• Storage: Refrigerated</li>
              <li>• Address: 123 Test Street, Test City</li>
              <li>• Expiry: Tomorrow</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-gradient-to-r from-primary-600 to-secondary-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Creating Donation...
              </div>
            ) : (
              '🧪 Create Test Donation'
            )}
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-2">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex min-h-[42px] items-center text-primary-600 hover:text-primary-700 font-semibold text-sm"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default TestDonation;
