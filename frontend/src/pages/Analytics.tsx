import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AxiosError } from 'axios';
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  RadialLinearScale,
  Tooltip,
  ChartOptions,
} from 'chart.js';
import { Doughnut, Line, Radar } from 'react-chartjs-2';
import { useAuth } from '../contexts/AuthContext';
import { analyticsAPI } from '../services/api';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll';

ChartJS.register(
  ArcElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  RadialLinearScale,
  Tooltip,
);

interface AnalyticsData {
  total_donations: number;
  active_donations: number;
  total_meals_saved: number;
  active_users: number;
  total_ngos: number;
  total_volunteers: number;
  food_waste_prevented_kg: number;
  co2_emissions_saved: number;
  weekly_growth: number | null;
  monthly_growth: number | null;
}

interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string;
  borderColor?: string;
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

interface TopDonorResult {
  user_id: number;
  name: string;
  email: string;
  total_donations: number;
  total_quantity: number | string;
}

interface TopNgoResult {
  user_id: number;
  name: string;
  email: string;
  organization_name: string;
  total_pickups: number;
  total_meals_received: number | string;
}

type TimeRange = '7days' | '30days' | '90days';

interface PaginatedPayload<T> {
  results?: T[];
}

interface ApiErrorPayload {
  detail?: string;
}

const extractList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as PaginatedPayload<T>).results)) {
    return (payload as PaginatedPayload<T>).results as T[];
  }
  return [];
};

const getErrorMessage = (error: unknown): string => {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return axiosError?.response?.data?.detail || 'Failed to load analytics dashboard.';
};

const parseTimeRange = (value: string): TimeRange => {
  if (value === '30days' || value === '90days') {
    return value;
  }
  return '7days';
};

const SectionTitle: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gray-400">Insights</p>
      <h2 className="text-2xl font-bold text-gray-900 mt-1">{title}</h2>
    </div>
    {subtitle ? <p className="text-sm leading-6 text-gray-400 max-w-md md:text-right">{subtitle}</p> : null}
  </div>
);

const Analytics: React.FC = () => {
  const { state } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [topDonors, setTopDonors] = useState<TopDonorResult[]>([]);
  const [topNGOs, setTopNGOs] = useState<TopNgoResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const chartPeriod = timeRange === '7days' ? 'week' : timeRange;

    const fetchAnalyticsData = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [analyticsResult, topDonorsResult, topNgosResult, chartResult] = await Promise.allSettled([
          analyticsAPI.getDashboardStats(),
          analyticsAPI.getTopDonors({ limit: 5, range: timeRange }),
          analyticsAPI.getTopNGOs({ limit: 5, range: timeRange }),
          analyticsAPI.getDonationChartData({ period: chartPeriod }),
        ]);

        if (!isCurrent) {
          return;
        }

        if (analyticsResult.status !== 'fulfilled') {
          throw analyticsResult.reason;
        }

        setAnalyticsData(analyticsResult.value?.data || null);
        setTopDonors(topDonorsResult.status === 'fulfilled' ? extractList<TopDonorResult>(topDonorsResult.value?.data) : []);
        setTopNGOs(topNgosResult.status === 'fulfilled' ? extractList<TopNgoResult>(topNgosResult.value?.data) : []);
        setChartData(chartResult.status === 'fulfilled' ? chartResult.value?.data || null : null);
        setLastSyncedAt(new Date());
      } catch (fetchError: unknown) {
        console.error('Failed to fetch analytics data:', fetchError);
        setError(getErrorMessage(fetchError));
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };

    fetchAnalyticsData();

    return () => {
      isCurrent = false;
    };
  }, [timeRange, refreshTick]);

  useRevealOnScroll(`${Boolean(analyticsData)}-${Boolean(chartData)}-${isLoading}`);

  const formatNumber = (num: number | string | null | undefined) => {
    const parsed = typeof num === 'string' ? parseFloat(num) : num;
    const safeNumber = typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
    return new Intl.NumberFormat('en-US').format(Math.round(safeNumber * 100) / 100);
  };

  const formatPercentage = (num: number | null | undefined) => {
    if (typeof num !== 'number' || Number.isNaN(num)) return 'N/A';
    return `${num.toFixed(1)}%`;
  };

  const getGrowthColor = (growth: number | null | undefined) => {
    if (typeof growth !== 'number' || Number.isNaN(growth)) return 'text-gray-500';
    return growth >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getGrowthIcon = (growth: number | null | undefined) => {
    if (typeof growth !== 'number' || Number.isNaN(growth)) return '•';
    return growth >= 0 ? '↗' : '↘';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
        <p className="text-sm text-gray-500 animate-pulse">Loading analytics...</p>
      </div>
    );
  }

  if (state.user?.role !== 'ADMIN') {
    return (
      <div className="max-w-6xl mx-auto pt-10 pb-16">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center text-4xl mx-auto mb-4">🔒</div>
          <p className="text-lg font-bold text-gray-800">Access Restricted</p>
          <p className="text-sm text-gray-400 mt-1">Analytics dashboard is only available to administrators.</p>
        </div>
      </div>
    );
  }

  const trendLabels = chartData?.labels || [];
  const donationsSeries = chartData?.datasets?.find((dataset) => dataset.label.toLowerCase().includes('donation'))?.data || [];
  const mealsSeries = chartData?.datasets?.find((dataset) => dataset.label.toLowerCase().includes('meal'))?.data || [];
  const trendMaxValue = Math.max(...donationsSeries, 1);
  const mealsMaxValue = Math.max(...mealsSeries, 1);

  const ngoCount = Math.max(0, analyticsData?.total_ngos || 0);
  const volunteerCount = Math.max(0, analyticsData?.total_volunteers || 0);
  const otherUsersCount = Math.max(0, (analyticsData?.active_users || 0) - ngoCount - volunteerCount);
  const totalUsersForChart = Math.max(ngoCount + volunteerCount + otherUsersCount, 1);

  const ngoPercent = Math.round((ngoCount / totalUsersForChart) * 100);
  const volunteerPercent = Math.round((volunteerCount / totalUsersForChart) * 100);
  const otherPercent = Math.max(0, 100 - ngoPercent - volunteerPercent);
  const ngoDeg = (ngoPercent / 100) * 360;
  const volunteerDeg = (volunteerPercent / 100) * 360;
  const urgentDonationCount = 0;
  const avgMealsPerDonation = analyticsData?.total_donations ? Number(analyticsData.total_meals_saved) / analyticsData.total_donations : 0;
  const activeDonationRatio = analyticsData?.total_donations ? ((analyticsData.active_donations || 0) / analyticsData.total_donations) * 100 : 0;
  const networkCoverage = analyticsData?.active_users ? (((analyticsData.total_ngos || 0) + (analyticsData.total_volunteers || 0)) / analyticsData.active_users) * 100 : 0;
  const co2PerMeal = analyticsData?.total_meals_saved ? Number(analyticsData.co2_emissions_saved) / Number(analyticsData.total_meals_saved) : 0;

  const spotlightMetrics = [
    {
      label: 'Meals per donation',
      value: `${avgMealsPerDonation.toFixed(1)}`,
      detail: 'Average meal recovery generated by each donation.',
      tone: 'from-primary-500 to-emerald-400',
    },
    {
      label: 'Active donation ratio',
      value: `${Math.round(activeDonationRatio)}%`,
      detail: 'Share of all donations still live in the current system state.',
      tone: 'from-secondary-500 to-orange-400',
    },
    {
      label: 'Network coverage',
      value: `${Math.min(100, Math.round(networkCoverage))}%`,
      detail: 'NGO and volunteer density relative to active users.',
      tone: 'from-sky-500 to-indigo-400',
    },
    {
      label: 'CO₂ per meal',
      value: `${co2PerMeal.toFixed(2)} kg`,
      detail: 'Environmental value saved per rescued meal.',
      tone: 'from-fuchsia-500 to-violet-400',
    },
  ];

  const advancedLineData = {
    labels: trendLabels,
    datasets: [
      {
        label: 'Donations',
        data: donationsSeries,
        borderColor: '#15803d',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        fill: true,
        borderWidth: 2.8,
        tension: 0.38,
        pointRadius: 3,
      },
      {
        label: 'Meals',
        data: mealsSeries,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(251, 191, 36, 0.16)',
        fill: true,
        borderWidth: 2.4,
        tension: 0.34,
        pointRadius: 2.8,
      },
    ],
  };

  const networkLoadData = {
    labels: ['NGOs', 'Volunteers', 'Other Users'],
    datasets: [
      {
        data: [ngoCount, volunteerCount, otherUsersCount],
        backgroundColor: ['#16a34a', '#ca8a04', '#7c3aed'],
        borderColor: '#f8fafc',
        borderWidth: 4,
        hoverOffset: 12,
      },
    ],
  };

  const readinessRadarData = {
    labels: ['Donation Flow', 'Meal Rescue', 'Network Reach', 'Volunteer Capacity', 'Climate Impact', 'Dispatch Momentum'],
    datasets: [
      {
        label: 'Readiness Index',
        data: [
          Math.max(10, Math.min(100, Math.round((analyticsData?.active_donations || 0) * 8))),
          Math.max(10, Math.min(100, Math.round((analyticsData?.total_meals_saved || 0) / Math.max((analyticsData?.total_donations || 1), 1) * 100))),
          Math.max(10, Math.min(100, ngoPercent + 28)),
          Math.max(10, Math.min(100, volunteerPercent + 24)),
          Math.max(10, Math.min(100, Math.round((analyticsData?.co2_emissions_saved || 0) * 6))),
          Math.max(10, Math.min(100, Math.round((analyticsData?.active_users || 0) / Math.max((analyticsData?.total_donations || 1), 1) * 100))),
        ],
        backgroundColor: 'rgba(22, 163, 74, 0.16)',
        borderColor: '#15803d',
        borderWidth: 2.4,
        pointBackgroundColor: '#f59e0b',
      },
    ],
  };

  const lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1000, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        labels: {
          color: '#475569',
          usePointStyle: true,
          boxWidth: 10,
          padding: 16,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b' } },
      y: { grid: { color: 'rgba(148,163,184,0.2)' }, ticks: { color: '#64748b' } },
    },
  };

  const doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#475569', usePointStyle: true, boxWidth: 10, padding: 14 },
      },
    },
  };

  const radarOptions: ChartOptions<'radar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { display: false, stepSize: 20 },
        angleLines: { color: 'rgba(148,163,184,0.2)' },
        grid: { color: 'rgba(148,163,184,0.2)' },
        pointLabels: { color: '#475569', font: { size: 11, weight: 600 } },
      },
    },
  };

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-8 px-1 pb-10 sm:px-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="reveal-on-scroll relative overflow-hidden rounded-[2rem] shadow-2xl bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.24),_transparent_28%),linear-gradient(135deg,#166534_0%,#16a34a_45%,#ca8a04_100%)] p-8 md:p-12">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-2xl animate-float-slow pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-black/10 rounded-full blur-2xl animate-float-medium pointer-events-none" />
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-white/5 rounded-full blur-xl animate-float-fast pointer-events-none" />
        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border bg-white/15 text-white border-white/20 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse inline-block" />
              Admin AI workspace
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mt-4">
              Analytics and AI Dispatch Studio
            </h1>
            <p className="text-primary-100/85 text-base max-w-xl mt-4 leading-7">
              Track operational health, inspect live dispatch logic, and run food-safety and NGO-matching algorithms from one screen.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:w-[320px] xl:min-w-[320px]">
            {[
              { label: 'Urgent queue', value: urgentDonationCount, suffix: 'donations' },
              { label: 'Location status', value: 'Live', suffix: '' },
              { label: 'Matching mode', value: 'Map', suffix: 'enabled' },
              { label: 'Panel type', value: 'Shared', suffix: '' },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-3 text-white">
                <p className="text-xs uppercase tracking-[0.2em] text-white/65">{card.label}</p>
                <p className="text-2xl font-bold mt-2">{card.value}</p>
                {card.suffix ? <p className="text-xs text-white/70 mt-1">{card.suffix}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-8 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
          <label className="text-xs font-semibold text-primary-100 uppercase tracking-[0.25em]">Time Range</label>
          <select
            value={timeRange}
            onChange={(event) => setTimeRange(parseTimeRange(event.target.value))}
            className="w-full lg:w-56 bg-white/15 border border-white/20 text-white text-sm font-medium rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-white/40 backdrop-blur-sm"
          >
            <option value="7days" className="text-gray-900">Last 7 Days</option>
            <option value="30days" className="text-gray-900">Last 30 Days</option>
            <option value="90days" className="text-gray-900">Last 90 Days</option>
          </select>
          <button
            onClick={() => setRefreshTick((prev) => prev + 1)}
            className="sm:w-auto w-full inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/15 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-all"
          >
            ↻ Refresh Data
          </button>
          {lastSyncedAt ? (
            <p className="text-xs text-primary-100/80">Synced: {lastSyncedAt.toLocaleTimeString('en-IN')}</p>
          ) : null}
        </div>
      </motion.div>

      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.04 }} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {spotlightMetrics.map((item) => (
          <div key={item.label} className="group relative overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/95 p-5 shadow-[0_20px_55px_-34px_rgba(15,23,42,0.24)]">
            <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${item.tone}`} />
            <div className="absolute right-[-1.2rem] top-[-1.2rem] h-24 w-24 rounded-full bg-slate-900/5 blur-2xl transition-transform duration-500 group-hover:scale-125" />
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
            <p className="mt-4 text-3xl font-black text-slate-900">{item.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</p>
          </div>
        ))}
      </motion.section>

      {error ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <span>⚠️</span>
          <span>{error}</span>
        </motion.div>
      ) : null}

      {analyticsData ? (
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }} className="reveal-on-scroll">
          <SectionTitle title="Key Metrics" subtitle="Core network totals and environmental outcomes across the platform." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: '🍲', label: 'Total Donations', value: formatNumber(analyticsData.total_donations), accent: 'bg-primary-50' },
              { icon: '✅', label: 'Active Donations', value: formatNumber(analyticsData.active_donations), accent: 'bg-green-50' },
              { icon: '🍽️', label: 'Meals Saved', value: formatNumber(analyticsData.total_meals_saved), accent: 'bg-blue-50' },
              { icon: '👥', label: 'Active Users', value: formatNumber(analyticsData.active_users), accent: 'bg-secondary-50' },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                whileHover={{ y: -6, scale: 1.01 }}
                className="relative overflow-hidden bg-white rounded-[1.6rem] border border-gray-100 shadow-sm p-5 flex flex-col items-center text-center gap-3"
              >
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary-500 via-secondary-500 to-emerald-400" />
                <div className={`w-12 h-12 rounded-xl ${stat.accent} flex items-center justify-center text-2xl shadow-inner`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900 leading-none">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1.5 font-medium">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      ) : null}

      {analyticsData ? (
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }} className="reveal-on-scroll">
          <SectionTitle title="Impact and Distribution" subtitle="Operational growth, user mix, and the strongest contributors in the selected period." />
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.22)] p-6 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Environmental impact</p>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Food Waste Prevented</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(analyticsData.food_waste_prevented_kg)} <span className="text-sm text-gray-400">kg</span></p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-2xl">🌍</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">CO2 Emissions Saved</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(analyticsData.co2_emissions_saved)} <span className="text-sm text-gray-400">kg</span></p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-2xl">🌱</div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Growth</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Weekly', value: analyticsData.weekly_growth },
                    { label: 'Monthly', value: analyticsData.monthly_growth },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-4">
                      <p className="text-xs text-gray-500">{item.label} growth</p>
                      <p className={`text-2xl font-bold mt-2 ${getGrowthColor(item.value)}`}>{getGrowthIcon(item.value)} {formatPercentage(item.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.22)] p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <motion.div
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  className="w-40 h-40 rounded-full border-8 border-white shadow-inner"
                  style={{
                    background: `conic-gradient(#16a34a 0deg ${ngoDeg}deg, #ca8a04 ${ngoDeg}deg ${ngoDeg + volunteerDeg}deg, #d1d5db ${ngoDeg + volunteerDeg}deg 360deg)`,
                  }}
                />
                <div className="flex-1 space-y-4 w-full">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">User mix</p>
                  {[
                    { label: 'NGOs', value: ngoCount, percent: ngoPercent, color: 'bg-green-500' },
                    { label: 'Volunteers', value: volunteerCount, percent: volunteerPercent, color: 'bg-yellow-500' },
                    { label: 'Other Users', value: otherUsersCount, percent: otherPercent, color: 'bg-gray-400' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium text-gray-600">{item.label}</span>
                        <span className="font-semibold text-gray-800">{formatNumber(item.value)} ({item.percent}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                        <motion.div
                          className={`${item.color} h-2 rounded-full`}
                          initial={{ width: 0 }}
                          animate={{ width: `${item.percent}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-1 xl:col-span-2 2xl:col-span-1">
              <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.22)] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">Top donors</p>
                {topDonors.length === 0 ? (
                  <p className="text-sm text-gray-400">No donor activity found for this period.</p>
                ) : (
                  <div className="space-y-3">
                    {topDonors.map((donor, index) => (
                      <div key={donor.user_id} className="rounded-2xl border border-gray-100 bg-gray-50/85 px-4 py-3.5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{donor.name || `Donor ${index + 1}`}</p>
                          <p className="text-xs text-gray-400 mt-1">{donor.email}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-sm font-bold text-primary-700">{donor.total_donations}</p>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400">{formatNumber(donor.total_quantity)} kg</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.22)] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-4">Top NGOs</p>
                {topNGOs.length === 0 ? (
                  <p className="text-sm text-gray-400">No NGO activity found for this period.</p>
                ) : (
                  <div className="space-y-3">
                    {topNGOs.map((ngo, index) => (
                      <div key={ngo.user_id} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3.5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{ngo.organization_name || ngo.name || `NGO ${index + 1}`}</p>
                          <p className="text-xs text-gray-400 mt-1">{ngo.email}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-sm font-bold text-secondary-700">{ngo.total_pickups}</p>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400">{formatNumber(ngo.total_meals_received)} meals</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}

      {analyticsData && chartData ? (
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.15 }} className="reveal-on-scroll">
          <SectionTitle title="Visual Insights" subtitle="Donation volume is now driven by live chart API data instead of synthetic placeholders." />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.22)] p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-gray-800">Donation Trend</h3>
                <span className="text-xs text-gray-400">{timeRange === '7days' ? 'Daily view' : timeRange === '30days' ? '5-day buckets' : '15-day buckets'}</span>
              </div>

              <div className="h-64 flex items-end gap-2 bg-gradient-to-t from-gray-50 to-white rounded-2xl border border-gray-100 px-3 py-4">
                {trendLabels.map((label, index) => {
                  const donationValue = donationsSeries[index] || 0;
                  const mealValue = mealsSeries[index] || 0;
                  const donationHeight = Math.max(8, Math.round((donationValue / trendMaxValue) * 100));
                  const mealHeight = Math.max(8, Math.round((mealValue / mealsMaxValue) * 100));

                  return (
                    <div key={`${label}-${index}`} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-2">
                      <div className="text-[10px] font-semibold text-gray-500">{formatNumber(donationValue)}</div>
                      <div className="w-full flex flex-col items-center justify-end gap-1 h-full">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${donationHeight}%` }}
                          transition={{ duration: 0.6, delay: index * 0.05, ease: 'easeOut' }}
                          className="w-full rounded-t-xl bg-gradient-to-t from-primary-700 via-primary-600 to-primary-300"
                        />
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(12, mealHeight)}%` }}
                          transition={{ duration: 0.5, delay: index * 0.05 + 0.1, ease: 'easeOut' }}
                          className="h-1.5 rounded-full bg-secondary-400"
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.22)] p-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-5">Signal Summary</h3>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { label: 'Peak donation bucket', value: formatNumber(Math.max(...donationsSeries, 0)), tone: 'bg-primary-50 text-primary-700' },
                  { label: 'Peak meals bucket', value: formatNumber(Math.max(...mealsSeries, 0)), tone: 'bg-secondary-50 text-secondary-700' },
                  { label: 'Current urgent queue', value: urgentDonationCount, tone: 'bg-red-50 text-red-700' },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-gray-100 bg-gray-50/85 p-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600">{item.label}</p>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${item.tone}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}

      {analyticsData && chartData ? (
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.2 }} className="reveal-on-scroll">
          <SectionTitle title="Advanced Intelligence" subtitle="Motion-enabled chart layer for dispatch readiness and network composition." />
          <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-4">
            <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.22)] p-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Dynamic trend intelligence</h3>
              <div className="h-[300px]">
                {trendLabels.length > 0 ? (
                  <Line key={`analytics-line-${timeRange}`} data={advancedLineData} options={lineOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
                    No chart data available for this range.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.22)] p-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Network load split</h3>
                <div className="h-[220px]">
                  <Doughnut key={`analytics-doughnut-${timeRange}`} data={networkLoadData} options={doughnutOptions} />
                </div>
              </div>

              <div className="bg-white rounded-[1.8rem] border border-gray-100 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.22)] p-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Dispatch readiness radar</h3>
                <div className="h-[220px]">
                  <Radar key={`analytics-radar-${timeRange}`} data={readinessRadarData} options={radarOptions} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}

    </motion.div>
  );
};

export default Analytics;
