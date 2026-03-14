import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
  ChartOptions,
} from 'chart.js';
import { Bar, Doughnut, Line, Radar, Scatter } from 'react-chartjs-2';
import AIAlgorithmPanel from '../components/AIAlgorithmPanel';
import { analyticsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
);

interface DashboardStats {
  total_donations: number;
  active_donations: number;
  total_meals_saved: number;
  active_users: number;
  total_ngos: number;
  total_volunteers: number;
  food_waste_prevented_kg: number;
  co2_emissions_saved: number;
}

interface ChartDataset {
  label: string;
  data: number[];
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

interface TopEntity {
  user_id: number;
  name: string;
  organization_name?: string;
  total_donations?: number;
  total_pickups?: number;
}

const extractList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (typeof payload === 'object' && payload !== null) {
    const results = (payload as { results?: unknown }).results;
    if (Array.isArray(results)) {
      return results as T[];
    }
  }
  return [];
};

const compactFormatter = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const formatCompact = (value: number) => compactFormatter.format(value || 0);

const clampScore = (value: number) => Math.max(12, Math.min(100, Math.round(value)));

const AITools: React.FC = () => {
  const { state } = useAuth();
  const isAdmin = state.user?.role === 'ADMIN';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [topDonors, setTopDonors] = useState<TopEntity[]>([]);
  const [topNgos, setTopNgos] = useState<TopEntity[]>([]);
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | '90days'>('7days');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      setIsLoading(true);
      const period = timeRange === '7days' ? 'week' : timeRange;

      try {
        const [statsRes, chartRes, donorsRes, ngosRes] = await Promise.allSettled([
          analyticsAPI.getDashboardStats(),
          analyticsAPI.getDonationChartData({ period }),
          analyticsAPI.getTopDonors({ limit: 5, range: timeRange }),
          analyticsAPI.getTopNGOs({ limit: 5, range: timeRange }),
        ]);

        if (!active) return;

        if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
        if (chartRes.status === 'fulfilled') setChartData(chartRes.value.data);
        if (donorsRes.status === 'fulfilled') setTopDonors(extractList<TopEntity>(donorsRes.value.data));
        if (ngosRes.status === 'fulfilled') setTopNgos(extractList<TopEntity>(ngosRes.value.data));
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchData();
    return () => { active = false; };
  }, [timeRange]);

  const donationSeries = useMemo(
    () => chartData?.datasets?.find((dataset) => dataset.label.toLowerCase().includes('donation'))?.data || [],
    [chartData],
  );
  const mealsSeries = useMemo(
    () => chartData?.datasets?.find((dataset) => dataset.label.toLowerCase().includes('meal'))?.data || [],
    [chartData],
  );
  const labels = useMemo(() => chartData?.labels || [], [chartData]);

  const metrics = useMemo(() => {
    const baseStats = stats || {
      total_donations: 0,
      active_donations: 0,
      total_meals_saved: 0,
      active_users: 0,
      total_ngos: 0,
      total_volunteers: 0,
      food_waste_prevented_kg: 0,
      co2_emissions_saved: 0,
    };

    const rescueCoverage = clampScore(
      ((baseStats.active_donations * 2 + baseStats.total_ngos * 6 + baseStats.total_volunteers * 4) /
        Math.max(baseStats.total_donations + baseStats.total_ngos + 1, 1)) * 10,
    );
    const freshnessConfidence = clampScore(
      ((baseStats.total_meals_saved + baseStats.food_waste_prevented_kg * 3) /
        Math.max(baseStats.total_donations * 6 + 1, 1)) * 18,
    );
    const logisticsReadiness = clampScore(
      ((baseStats.total_volunteers * 10 + baseStats.total_ngos * 12) /
        Math.max(baseStats.active_donations * 3 + 1, 1)) * 20,
    );
    const climateEfficiency = clampScore(
      ((baseStats.co2_emissions_saved * 14 + baseStats.food_waste_prevented_kg * 8) /
        Math.max(baseStats.total_meals_saved + 1, 1)) * 16,
    );

    return {
      rescueCoverage,
      freshnessConfidence,
      logisticsReadiness,
      climateEfficiency,
    };
  }, [stats]);

  const lineChartData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Donation Flow',
        data: donationSeries,
        borderColor: '#0f766e',
        backgroundColor: 'rgba(20, 184, 166, 0.22)',
        fill: true,
        borderWidth: 3,
        tension: 0.42,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#0f766e',
        pointBorderWidth: 2,
      },
      {
        label: 'Meals Projection',
        data: mealsSeries,
        borderColor: '#f97316',
        backgroundColor: 'rgba(251, 146, 60, 0.16)',
        fill: true,
        borderWidth: 2.5,
        tension: 0.38,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#fff7ed',
        pointBorderColor: '#f97316',
        pointBorderWidth: 2,
      },
    ],
  }), [donationSeries, labels, mealsSeries]);

  const networkChartData = useMemo(() => ({
    labels: ['Active Donations', 'NGO Network', 'Volunteer Layer', ...(isAdmin ? ['User Signals'] : [])],
    datasets: [
      {
        data: [
          stats?.active_donations || 0,
          stats?.total_ngos || 0,
          stats?.total_volunteers || 0,
          ...(isAdmin ? [stats?.active_users || 0] : []),
        ],
        backgroundColor: ['#14b8a6', '#0f766e', '#f97316', '#7c3aed'],
        borderColor: '#f8fafc',
        borderWidth: 4,
        hoverOffset: 10,
        cutout: '58%',
      },
    ],
  }), [isAdmin, stats]);

  const radarChartData = useMemo(() => ({
    labels: ['Coverage', 'Freshness', 'Dispatch', 'Volunteer Depth', 'NGO Readiness', 'Climate'],
    datasets: [
      {
        label: 'AI Rescue Index',
        data: [
          metrics.rescueCoverage,
          metrics.freshnessConfidence,
          metrics.logisticsReadiness,
          clampScore((stats?.total_volunteers || 0) * 7),
          clampScore((stats?.total_ngos || 0) * 13),
          metrics.climateEfficiency,
        ],
        backgroundColor: 'rgba(15, 118, 110, 0.22)',
        borderColor: '#0f766e',
        borderWidth: 2.5,
        pointBackgroundColor: '#f97316',
        pointBorderColor: '#ffffff',
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: '#0f766e',
      },
    ],
  }), [metrics, stats]);

  const barChartData = useMemo(() => ({
    labels: ['Coverage', 'Freshness', 'Dispatch', 'Climate'],
    datasets: [
      {
        label: 'AI Score',
        data: [
          metrics.rescueCoverage,
          metrics.freshnessConfidence,
          metrics.logisticsReadiness,
          metrics.climateEfficiency,
        ],
        backgroundColor: 'rgba(20, 184, 166, 0.72)',
        borderRadius: 10,
      },
      {
        label: 'Target',
        data: [85, 85, 85, 85],
        backgroundColor: 'rgba(249, 115, 22, 0.45)',
        borderRadius: 10,
      },
    ],
  }), [metrics]);

  const scatterChartData = useMemo(() => {
    const points = donationSeries.map((donationValue, index) => ({
      x: Number(donationValue || 0),
      y: Number(mealsSeries[index] || 0),
      label: labels[index] || `Point ${index + 1}`,
    }));

    return {
      datasets: [
        {
          label: 'Donation → Meals correlation',
          data: points,
          backgroundColor: 'rgba(15, 118, 110, 0.8)',
          borderColor: '#0f766e',
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    };
  }, [donationSeries, labels, mealsSeries]);

  const lineOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1100, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        labels: {
          color: '#475569',
          usePointStyle: true,
          boxWidth: 10,
          padding: 18,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        padding: 12,
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b' },
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.18)' },
        ticks: { color: '#64748b' },
      },
    },
  }), []);

  const doughnutOptions = useMemo<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1200, easing: 'easeOutBounce' },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#475569',
          usePointStyle: true,
          boxWidth: 10,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        padding: 12,
      },
    },
  }), []);

  const radarOptions = useMemo<ChartOptions<'radar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1000, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        padding: 12,
      },
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          display: false,
          stepSize: 20,
        },
        angleLines: { color: 'rgba(148, 163, 184, 0.18)' },
        grid: { color: 'rgba(148, 163, 184, 0.18)' },
        pointLabels: {
          color: '#475569',
          font: { size: 11, weight: 600 },
        },
      },
    },
  }), []);

  const barOptions = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#475569',
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b' },
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(148, 163, 184, 0.18)' },
        ticks: { color: '#64748b' },
      },
    },
  }), []);

  const scatterOptions = useMemo<ChartOptions<'scatter'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#475569',
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        callbacks: {
          label: (context) => {
            const point = context.raw as { x: number; y: number; label?: string };
            return `${point.label || 'Point'}: donations ${point.x}, meals ${point.y.toFixed(1)}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Donations', color: '#64748b' },
        grid: { color: 'rgba(148, 163, 184, 0.18)' },
        ticks: { color: '#64748b' },
      },
      y: {
        title: { display: true, text: 'Meals Saved', color: '#64748b' },
        grid: { color: 'rgba(148, 163, 184, 0.18)' },
        ticks: { color: '#64748b' },
      },
    },
  }), []);

  const leadershipCards = useMemo(() => ([
    {
      title: 'Top Donors',
      accent: 'from-primary-500/15 via-white to-white',
      border: 'border-primary-100',
      badge: 'text-primary-700 bg-primary-50',
      empty: { user_id: 0, name: 'No donor data yet', total_donations: 0 },
      data: topDonors,
      valueKey: 'total_donations' as const,
      label: 'donations',
      resolveName: (entity: TopEntity) => entity.name,
    },
    {
      title: 'Top NGOs',
      accent: 'from-secondary-500/15 via-white to-white',
      border: 'border-secondary-100',
      badge: 'text-secondary-700 bg-secondary-50',
      empty: { user_id: 0, name: 'No NGO data yet', organization_name: '-', total_pickups: 0 },
      data: topNgos,
      valueKey: 'total_pickups' as const,
      label: 'pickups',
      resolveName: (entity: TopEntity) => entity.organization_name || entity.name,
    },
  ]), [topDonors, topNgos]);

  const missionSignals = useMemo(() => ([
    {
      label: 'Rescue Coverage',
      value: `${metrics.rescueCoverage}%`,
      detail: 'How effectively the active donation pool is matched to the field network.',
      color: 'from-primary-500 to-secondary-500',
    },
    {
      label: 'Freshness Confidence',
      value: `${metrics.freshnessConfidence}%`,
      detail: 'Composite confidence built from meals saved, waste prevented and food safety readiness.',
      color: 'from-amber-400 to-orange-500',
    },
    {
      label: 'Climate Efficiency',
      value: `${metrics.climateEfficiency}%`,
      detail: 'Relative carbon and waste reduction efficiency across the latest rescue cycle.',
      color: 'from-emerald-400 to-primary-600',
    },
  ]), [metrics]);

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
        <p className="text-sm text-gray-500 animate-pulse">Loading AI dashboard...</p>
      </div>
    );
  }

  return (
    <motion.div className="max-w-7xl mx-auto space-y-8 pb-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 md:p-10 shadow-[0_35px_90px_-45px_rgba(15,23,42,0.85)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.26),_transparent_38%),radial-gradient(circle_at_82%_18%,_rgba(249,115,22,0.24),_transparent_30%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(15,118,110,0.88))]" />
        <div className="absolute inset-0 bg-grid-mask opacity-25" />
        <div className="absolute -top-20 right-[-2rem] h-56 w-56 rounded-full bg-white/10 blur-3xl animate-float-slow" />
        <div className="absolute bottom-[-5rem] left-10 h-48 w-48 rounded-full bg-teal-300/20 blur-3xl animate-float-medium" />

        <div className="relative grid gap-8 lg:grid-cols-[1.3fr_0.85fr] lg:items-end">
          <div className="space-y-6 text-white">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/85 backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(134,239,172,0.9)]" />
                AI Command Center
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">
                {isAdmin ? 'System-wide visibility enabled' : 'Operational intelligence ready'}
              </span>
            </div>

            <div className="max-w-3xl space-y-4">
              <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl lg:text-6xl">
                Food rescue intelligence with a sharper visual signal.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                This view now behaves like an operations cockpit: live rescue momentum, layered network capacity, AI readiness scores, and rapid access to the algorithm actions that move donations faster.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {missionSignals.map((signal, index) => (
                <motion.div
                  key={signal.label}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.1 + index * 0.08 }}
                  className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur-md"
                >
                  <div className={`inline-flex rounded-full bg-gradient-to-r px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white ${signal.color}`}>
                    {signal.label}
                  </div>
                  <p className="mt-4 text-3xl font-black text-white">{signal.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200/85">{signal.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="relative"
            style={{ perspective: 1400 }}
          >
            <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-white/10 p-6 shadow-[0_25px_80px_-40px_rgba(15,23,42,0.95)] backdrop-blur-xl">
              <div className="absolute inset-x-6 top-6 h-24 rounded-full bg-gradient-to-r from-teal-300/30 via-cyan-300/10 to-amber-300/20 blur-3xl" />
              <div className="relative space-y-6 text-white [transform:rotateX(10deg)_rotateY(-7deg)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/55">Signal Stack</p>
                    <h2 className="mt-2 text-2xl font-bold">Realtime rescue spectrum</h2>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 p-1">
                    {(['7days', '30days', '90days'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${timeRange === range ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80 hover:bg-white/10'}`}
                      >
                        {range === '7days' ? '7D' : range === '30days' ? '30D' : '90D'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Total Donations', value: formatCompact(stats?.total_donations || 0), accent: 'from-primary-300/35 to-primary-500/5' },
                    { label: 'Meals Saved', value: formatCompact(Math.round(stats?.total_meals_saved || 0)), accent: 'from-amber-300/35 to-orange-500/5' },
                    { label: 'Waste Prevented', value: `${Number(stats?.food_waste_prevented_kg || 0).toFixed(1)} kg`, accent: 'from-emerald-300/35 to-teal-500/5' },
                    { label: 'CO2 Saved', value: `${Number(stats?.co2_emissions_saved || 0).toFixed(1)} kg`, accent: 'from-violet-300/35 to-fuchsia-500/5' },
                  ].map((card) => (
                    <div key={card.label} className={`rounded-2xl border border-white/12 bg-gradient-to-br ${card.accent} p-4`}>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/60">{card.label}</p>
                      <p className="mt-3 text-2xl font-black text-white">{card.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Active Rescue Flow', value: stats?.active_donations || 0, suffix: 'live donations', tone: 'from-primary-500 to-teal-400' },
          { label: 'NGO Mesh', value: stats?.total_ngos || 0, suffix: 'available NGOs', tone: 'from-secondary-500 to-orange-400' },
          { label: 'Volunteer Layer', value: stats?.total_volunteers || 0, suffix: 'field responders', tone: 'from-emerald-500 to-primary-400' },
          { label: isAdmin ? 'User Signals' : 'Rescue Confidence', value: isAdmin ? stats?.active_users || 0 : metrics.logisticsReadiness, suffix: isAdmin ? 'active participants' : 'dispatch score', tone: 'from-violet-500 to-fuchsia-400' },
        ].map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 + index * 0.05 }}
            className="group relative overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.3)] backdrop-blur-sm"
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.tone}`} />
            <div className="absolute right-[-1.2rem] top-[-1.2rem] h-24 w-24 rounded-full bg-slate-900/5 blur-2xl transition-transform duration-500 group-hover:scale-125" />
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
            <p className="mt-4 text-3xl font-black text-slate-900">{item.value}</p>
            <p className="mt-2 text-sm text-slate-500">{item.suffix}</p>
          </motion.div>
        ))}
      </motion.section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_0.9fr]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }} className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/70 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.28)]">
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-primary-500/10 via-secondary-400/10 to-transparent" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Temporal View</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">Donation velocity vs meal recovery</h3>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              Animated intelligence chart
            </span>
          </div>
          <div className="mt-6 h-[320px]">
            <AnimatePresence mode="wait">
              {labels.length > 0 ? (
                <motion.div
                  key={`line-${timeRange}-${labels.length}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28 }}
                  className="h-full"
                >
                  <Line data={lineChartData} options={lineOptions} />
                </motion.div>
              ) : (
                <motion.div
                  key={`line-empty-${timeRange}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400"
                >
                  No trend data available for this time range.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <div className="grid gap-5">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.14 }} className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/70 bg-white/95 p-6 shadow-[0_22px_60px_-36px_rgba(15,23,42,0.28)]">
            <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-primary-500/10 blur-2xl" />
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Network Composition</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">Layered rescue mesh</h3>
            <div className="mt-5 h-[250px]">
              <motion.div
                key={`doughnut-${timeRange}-${stats?.active_donations || 0}`}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                <Doughnut data={networkChartData} options={doughnutOptions} />
              </motion.div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.18 }} className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/70 bg-white/95 p-6 shadow-[0_22px_60px_-36px_rgba(15,23,42,0.28)]">
            <div className="absolute left-5 top-5 h-14 w-14 rounded-full bg-secondary-500/10 blur-2xl" />
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">AI Scorecard</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">Operational readiness radar</h3>
            <div className="mt-5 h-[250px]">
              <motion.div
                key={`radar-${timeRange}-${metrics.logisticsReadiness}`}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                <Radar data={radarChartData} options={radarOptions} />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.22 }} className="rounded-[1.8rem] border border-slate-200/70 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.28)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Priority Signals</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">Where the next intervention matters most</h3>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {missionSignals.map((signal) => (
              <div key={signal.label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className={`h-2 w-full rounded-full bg-gradient-to-r ${signal.color}`} />
                <p className="mt-4 text-sm font-semibold text-slate-900">{signal.label}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{signal.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{signal.detail}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.26 }} className="rounded-[1.8rem] border border-slate-200/70 bg-slate-950 p-6 text-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.75)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">AI Snapshot</p>
          <h3 className="mt-1 text-2xl font-bold">Command deck highlights</h3>
          <div className="mt-6 space-y-4">
            {[
              { label: 'Live active donation stream', value: formatCompact(stats?.active_donations || 0), note: 'Open rescue opportunities currently in system.' },
              { label: 'Meals pushed toward recovery', value: formatCompact(Math.round(stats?.total_meals_saved || 0)), note: 'Captured output from recent operations and predictive routing.' },
              { label: 'Response layer strength', value: `${metrics.logisticsReadiness}%`, note: 'Volunteer and NGO readiness under the current donation load.' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-white/75">{item.label}</p>
                  <span className="text-xl font-black">{item.value}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/55">{item.note}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.24 }}
          className="rounded-[1.8rem] border border-slate-200/70 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.28)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Performance Matrix</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900">AI score vs target</h3>
          <div className="mt-6 h-[300px]">
            <Bar data={barChartData} options={barOptions} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.28 }}
          className="rounded-[1.8rem] border border-slate-200/70 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.28)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Insight Scatter</p>
          <h3 className="mt-1 text-2xl font-bold text-slate-900">Donations vs meal recovery</h3>
          <div className="mt-6 h-[300px]">
            <Scatter data={scatterChartData} options={scatterOptions} />
          </div>
        </motion.div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {leadershipCards.map((card, cardIndex) => {
          const items = card.data.length ? card.data : [card.empty as TopEntity];
          const maxValue = Math.max(...items.map((item) => Number(item[card.valueKey] || 0)), 1);

          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.28 + cardIndex * 0.05 }}
              className={`rounded-[1.8rem] border ${card.border} bg-gradient-to-br ${card.accent} p-6 shadow-[0_22px_60px_-36px_rgba(15,23,42,0.22)]`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Leadership Board</p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-900">{card.title}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${card.badge}`}>Ranked by {card.label}</span>
              </div>
              <div className="mt-6 space-y-4">
                {items.map((entity, index) => {
                  const value = Number(entity[card.valueKey] || 0);
                  const fill = Math.max(10, (value / maxValue) * 100);

                  return (
                    <div key={entity.user_id || index} className="rounded-2xl border border-white/60 bg-white/80 p-4 backdrop-blur-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{card.resolveName(entity)}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">Rank {index + 1}</p>
                        </div>
                        <span className="text-lg font-black text-slate-900">{value}</span>
                      </div>
                      <div className="mt-4 h-2.5 rounded-full bg-slate-100">
                        <div className={`h-full rounded-full bg-gradient-to-r ${cardIndex === 0 ? 'from-primary-500 to-teal-400' : 'from-secondary-500 to-amber-400'}`} style={{ width: `${fill}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </section>

      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.32 }} className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-slate-200" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">AI Execution Layer</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-slate-200 via-slate-300 to-transparent" />
        </div>
        <div className="rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-[0_26px_75px_-38px_rgba(15,23,42,0.3)] md:p-6">
          <AIAlgorithmPanel title="Precision Rescue Lab" />
        </div>
      </motion.section>
    </motion.div>
  );
};

export default AITools;
