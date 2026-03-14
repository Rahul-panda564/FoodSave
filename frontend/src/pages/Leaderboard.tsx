import React, { useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  name: string;
  role: string;
  contribution_score: number;
  points_balance: number;
  total_points_earned: number;
}

interface PointRules {
  [key: string]: number;
}

interface Prize {
  id: number;
  name: string;
  description: string;
  points_required: number;
  stock: number;
  is_active: boolean;
}

interface Redemption {
  id: number;
  prize: Prize;
  points_spent: number;
  status: string;
  redeemed_at: string;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  my_rank: number | null;
  my_entry: LeaderboardEntry | null;
  points_balance: number;
  total_points_earned: number;
  point_rules: PointRules;
  prizes: Prize[];
  recent_redemptions: Redemption[];
}

interface ApiErrorPayload {
  error?: string;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return axiosError?.response?.data?.error || fallback;
};

const roleEmoji = (role: string) => {
  switch ((role || '').toUpperCase()) {
    case 'DONOR':
      return '🍱';
    case 'NGO':
      return '🏛️';
    case 'VOLUNTEER':
      return '🚚';
    case 'ADMIN':
      return '🛡️';
    default:
      return '👤';
  }
};

const Leaderboard: React.FC = () => {
  const { state } = useAuth();
  const isAdmin = (state.user?.role || '').toUpperCase() === 'ADMIN';
  const pageSize = 10;

  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedeeming, setIsRedeeming] = useState<number | null>(null);
  const [isAwarding, setIsAwarding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    try {
      setError(null);
      const response = await authAPI.getLeaderboard();
      setData(response.data);
    } catch (apiError: unknown) {
      setError(getApiErrorMessage(apiError, 'Failed to load leaderboard.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [data?.leaderboard?.length]);

  const sortedRules = useMemo(() => {
    if (!data?.point_rules) return [] as Array<[string, number]>;
    return Object.entries(data.point_rules).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [data?.point_rules]);

  const totalEntries = data?.leaderboard?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const paginatedLeaderboard = data?.leaderboard?.slice(pageStart, pageEnd) || [];

  const handleRedeem = async (prizeId: number) => {
    try {
      setIsRedeeming(prizeId);
      setMessage(null);
      setError(null);
      const response = await authAPI.redeemPrize(prizeId);
      setMessage(response.data?.message || 'Prize redeemed successfully.');
      await fetchLeaderboard();
    } catch (apiError: unknown) {
      setError(getApiErrorMessage(apiError, 'Failed to redeem prize.'));
    } finally {
      setIsRedeeming(null);
    }
  };

  const handleAwardTop = async () => {
    try {
      setIsAwarding(true);
      setMessage(null);
      setError(null);
      const response = await authAPI.awardTopLeaderboard();
      setMessage(response.data?.message || 'Leaderboard points awarded.');
      await fetchLeaderboard();
    } catch (apiError: unknown) {
      setError(getApiErrorMessage(apiError, 'Failed to award leaderboard points.'));
    } finally {
      setIsAwarding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
        <p className="text-sm text-gray-500 animate-pulse">Loading leaderboard…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl shadow-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-secondary-500 p-7 md:p-12">
        <div className="absolute inset-0 bg-grid-mask opacity-15" />
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-2xl animate-float-slow pointer-events-none" />

        <div className="relative grid gap-4 md:grid-cols-3 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-primary-100/80">Rewards</p>
            <h1 className="text-3xl md:text-4xl font-extrabold mt-2">🏆 Leaderboard</h1>
            <p className="mt-3 text-primary-50/90 text-sm">Earn points through completed contributions and redeem rewards.</p>
          </div>
          <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-primary-100/80">My Rank</p>
            <p className="mt-2 text-3xl font-black">{data?.my_rank ?? '-'}</p>
          </div>
          <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-primary-100/80">Points Balance</p>
            <p className="mt-2 text-3xl font-black">{data?.points_balance ?? 0}</p>
          </div>
        </div>
      </div>

      {(message || error) && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border text-sm ${
          error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-primary-50 border-primary-200 text-primary-700'
        }`}>
          <span>{error ? '⚠️' : '✅'}</span>
          <span>{error || message}</span>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Admin Actions</h2>
              <p className="text-sm text-slate-500">Award points to today’s top 3 contributors once per day.</p>
            </div>
            <button
              onClick={handleAwardTop}
              disabled={isAwarding}
              className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-60"
            >
              {isAwarding ? 'Awarding…' : 'Award Top 3'}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Top Contributors</h2>
            <span className="text-xs text-slate-500">Top 50</span>
          </div>

          {!data?.leaderboard?.length ? (
            <p className="text-sm text-slate-500">No leaderboard data available yet.</p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                      <th className="py-2 pr-3">Rank</th>
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3">Contribution</th>
                      <th className="py-2 pr-3">Balance</th>
                      <th className="py-2">Total Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLeaderboard.map((item) => {
                      const isMe = item.user_id === state.user?.id;
                      const isTopThree = item.rank <= 3;
                      const rankLabel = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '#';
                      return (
                        <tr
                          key={item.user_id}
                          className={`border-b border-slate-50 ${
                            isTopThree ? 'bg-amber-50/60' : ''
                          } ${
                            isMe ? 'bg-primary-50/70' : ''
                          }`}
                        >
                          <td className="py-2 pr-3 font-semibold">{isTopThree ? `${rankLabel} #${item.rank}` : `#${item.rank}`}</td>
                          <td className="py-2 pr-3">
                            <span className="mr-2">{roleEmoji(item.role)}</span>
                            <span className="font-medium text-slate-800">{item.name}</span>
                            {isMe ? <span className="ml-2 text-xs text-primary-700">(You)</span> : null}
                          </td>
                          <td className="py-2 pr-3">{item.contribution_score}</td>
                          <td className="py-2 pr-3">{item.points_balance}</td>
                          <td className="py-2">{item.total_points_earned}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Showing {Math.min(totalEntries, pageStart + 1)}-{Math.min(totalEntries, pageEnd)} of {totalEntries}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="text-xs font-semibold text-slate-600">Page {currentPage} / {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-3">Point Rules</h3>
            {!sortedRules.length ? (
              <p className="text-sm text-slate-500">No reward rules configured.</p>
            ) : (
              <ul className="space-y-2">
                {sortedRules.map(([rank, points]) => (
                  <li key={rank} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Rank #{rank}</span>
                    <span className="font-semibold text-slate-900">+{points} pts</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-3">Redeem Rewards</h3>
            {!data?.prizes?.length ? (
              <p className="text-sm text-slate-500">No active prizes available.</p>
            ) : (
              <div className="space-y-3">
                {data.prizes.map((prize) => {
                  const canRedeem = (data.points_balance || 0) >= prize.points_required && prize.stock > 0;
                  const loading = isRedeeming === prize.id;
                  return (
                    <div key={prize.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{prize.name}</p>
                          <p className="text-xs text-slate-500 mt-1">{prize.description}</p>
                          <p className="text-xs text-slate-600 mt-2">{prize.points_required} pts • Stock {prize.stock}</p>
                        </div>
                        <button
                          onClick={() => handleRedeem(prize.id)}
                          disabled={!canRedeem || loading}
                          className="px-3 py-2 rounded-lg text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50"
                        >
                          {loading ? 'Redeeming…' : 'Redeem'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-3">Recent Redemptions</h3>
            {!data?.recent_redemptions?.length ? (
              <p className="text-sm text-slate-500">No recent redemptions yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.recent_redemptions.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="text-sm font-medium text-slate-800">{entry.prize?.name || 'Prize'}</p>
                    <p className="text-xs text-slate-500">{entry.points_spent} pts • {new Date(entry.redeemed_at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
