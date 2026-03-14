import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { analyticsAPI } from '../services/api';

interface FeedbackItem {
  id: number;
  name: string;
  email: string;
  rating: number;
  message: string;
  created_at: string;
}

const Feedbacks: React.FC = () => {
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | 'ALL'>('ALL');

  const averageRating = useMemo(() => {
    if (!feedbackEntries.length) return 0;
    const total = feedbackEntries.reduce((sum, item) => sum + item.rating, 0);
    return total / feedbackEntries.length;
  }, [feedbackEntries]);

  const filteredFeedbackEntries = useMemo(() => {
    if (selectedRating === 'ALL') return feedbackEntries;
    return feedbackEntries.filter((entry) => entry.rating === selectedRating);
  }, [feedbackEntries, selectedRating]);

  const ratingBreakdown = useMemo(() => {
    const total = feedbackEntries.length || 1;
    return [5, 4, 3, 2, 1].map((rating) => {
      const count = feedbackEntries.filter((entry) => entry.rating === rating).length;
      return {
        rating,
        count,
        percent: Math.round((count / total) * 100),
      };
    });
  }, [feedbackEntries]);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await analyticsAPI.getFeedbackList({ limit: 200 });
        setFeedbackEntries(Array.isArray(response.data) ? response.data : []);
      } catch (err: unknown) {
        setError('Failed to load feedback. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 shadow-[0_30px_85px_-44px_rgba(15,23,42,0.85)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.24),_transparent_35%),radial-gradient(circle_at_82%_18%,_rgba(249,115,22,0.22),_transparent_28%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,118,110,0.9))]" />
        <div className="absolute inset-0 bg-grid-mask opacity-20" />
        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Admin review board</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight">User feedback intelligence</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">Monitor sentiment, filter ratings, and quickly inspect detailed feedback from the landing page submissions.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Total Feedback', value: feedbackEntries.length },
              { label: 'Average Rating', value: `${averageRating.toFixed(1)} / 5` },
              { label: 'Latest Submission', value: feedbackEntries[0] ? new Date(feedbackEntries[0].created_at).toLocaleDateString() : 'No data' },
              { label: 'Active Filter', value: selectedRating === 'ALL' ? 'All Ratings' : `${selectedRating} / 5` },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/12 bg-white/10 px-4 py-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-white/55">{item.label}</p>
                <p className="mt-2 text-xl font-black">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="rounded-[1.8rem] border border-slate-200 bg-white/95 p-6 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.22)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Rating distribution</p>
          <div className="mt-5 space-y-4">
            {ratingBreakdown.map((item) => (
              <div key={item.rating}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{item.rating} ★</span>
                  <span className="text-slate-500">{item.count} ({item.percent}%)</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-secondary-500" style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <label className="ui-kicker block text-slate-400 mb-2">Filter by Rating</label>
            <select
              value={selectedRating}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedRating(value === 'ALL' ? 'ALL' : Number(value));
              }}
              className="ui-select"
            >
              <option value="ALL">All Ratings</option>
              <option value="5">5 / 5</option>
              <option value="4">4 / 5</option>
              <option value="3">3 / 5</option>
              <option value="2">2 / 5</option>
              <option value="1">1 / 5</option>
            </select>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="rounded-[1.8rem] border border-slate-200 bg-white/95 p-6 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.22)]"
        >
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : filteredFeedbackEntries.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">No feedback found for the selected rating.</div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {filteredFeedbackEntries.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.02 }}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{entry.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{entry.email}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex min-h-[30px] items-center rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">{entry.rating} / 5</span>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 mt-2">{new Date(entry.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="mt-3.5 text-sm leading-6 text-slate-600">{entry.message}</p>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Feedbacks;
