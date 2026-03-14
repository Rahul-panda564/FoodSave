import React, { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { analyticsAPI } from '../services/api';
import homeHeroImage from '../assets/home-hero.png';

const STATS = [
  { value: 1000, suffix: '+', label: 'Meals Saved Daily', icon: '🍽' },
  { value: 500, suffix: '+', label: 'Active Donors', icon: '👥' },
  { value: 100, suffix: '+', label: 'Partner NGOs', icon: '🏛️' },
  { value: 50, suffix: '+', label: 'Volunteers', icon: '🚚' },
  { value: 25, suffix: '%', label: 'Waste Reduction', icon: '🌍' }
];

const TRUST_ITEMS = ['Smart Matching', 'Real-Time Coordination', 'Verified NGOs', 'Secure Donations', 'Transparent Impact'];

const PROCESS_STEPS = [
  {
    id: '01',
    title: 'List or Request Food',
    description: 'Donors post available food in seconds while NGOs and volunteers discover nearby opportunities.',
    icon: '🧾',
  },
  {
    id: '02',
    title: 'AI Match + Assign',
    description: 'FoodSave ranks best-fit NGOs and routes volunteers with faster pickup timing and reduced spoilage.',
    icon: '🧠',
  },
  {
    id: '03',
    title: 'Track Impact Instantly',
    description: 'Live analytics show meals saved, emissions reduced, and neighborhoods reached with every donation.',
    icon: '📍',
  },
];

const LIVE_STREAM = [
  { title: 'Pickup Confirmed', detail: 'Surplus meals routed to SafeHands NGO', time: '2 min ago', icon: '✅' },
  { title: 'High Priority Match', detail: 'School shelter request fulfilled', time: '5 min ago', icon: '⚡' },
  { title: 'Volunteer On Route', detail: 'Estimated arrival in 12 minutes', time: 'Just now', icon: '🚚' },
];

const STORIES = [
  {
    quote: 'FoodSave transformed our outreach. We now serve more families with less food waste and faster logistics.',
    author: 'Ananya Das',
    role: 'Program Lead, Hope NGO',
  },
  {
    quote: 'The AI matching is brilliant. Our surplus food is picked up quickly and reaches people while it is still fresh.',
    author: 'Rajiv Menon',
    role: 'Restaurant Donor Partner',
  },
  {
    quote: 'The dashboard gives us confidence. Every donation now feels measurable, meaningful, and transparent.',
    author: 'Neha Verma',
    role: 'Volunteer Coordinator',
  },
];

type AnimationPreset = 'subtle' | 'balanced' | 'dramatic';

const LANDING_ANIMATION_PRESET: AnimationPreset = 'balanced';

const REVEAL_PRESETS: Record<AnimationPreset, {
  threshold: number;
  rootMargin: string;
  durationMs: number;
  offsetPx: number;
  blurPx: number;
  entryScale: number;
}> = {
  subtle: {
    threshold: 0.12,
    rootMargin: '0px 0px -2% 0px',
    durationMs: 620,
    offsetPx: 16,
    blurPx: 1,
    entryScale: 0.995,
  },
  balanced: {
    threshold: 0.22,
    rootMargin: '0px 0px -8% 0px',
    durationMs: 900,
    offsetPx: 34,
    blurPx: 4,
    entryScale: 0.985,
  },
  dramatic: {
    threshold: 0.3,
    rootMargin: '0px 0px -14% 0px',
    durationMs: 1200,
    offsetPx: 56,
    blurPx: 7,
    entryScale: 0.97,
  },
};

interface ApiErrorPayload {
  message?: string;
}

type RevealStyleVars = React.CSSProperties & {
  '--reveal-duration': string;
  '--reveal-offset': string;
  '--reveal-blur': string;
  '--reveal-scale': string;
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return axiosError?.response?.data?.message || fallback;
};

const Home: React.FC = () => {
  const { state } = useAuth();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState({
    name: '',
    email: '',
    rating: 5,
    message: '',
  });
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeStory, setActiveStory] = useState(0);
  const revealPreset = REVEAL_PRESETS[LANDING_ANIMATION_PRESET];

  const revealStyleVars: RevealStyleVars = {
    '--reveal-duration': `${revealPreset.durationMs}ms`,
    '--reveal-offset': `${revealPreset.offsetPx}px`,
    '--reveal-blur': `${revealPreset.blurPx}px`,
    '--reveal-scale': `${revealPreset.entryScale}`,
  };

  const features = [
    {
      icon: '🍲',
      title: 'Food Donation',
      description: 'Donate excess food to reduce waste and help communities',
      color: 'bg-primary-100 text-primary-600'
    },
    {
      icon: '🏛️',
      title: 'NGO Partnerships',
      description: 'Connect with organizations that distribute food to those in need',
      color: 'bg-green-100 text-green-600'
    },
    {
      icon: '🚚',
      title: 'Volunteer Network',
      description: 'Join volunteers who help transport food from donors to NGOs',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      icon: '📊',
      title: 'Analytics Dashboard',
      description: 'Track environmental impact and platform performance',
      color: 'bg-yellow-100 text-yellow-600'
    },
    {
      icon: '🤖',
      title: 'AI-Powered Matching',
      description: 'Smart algorithms match donors with optimal NGOs',
      color: 'bg-purple-100 text-purple-600'
    }
  ];

  const [animatedStats, setAnimatedStats] = useState<number[]>(STATS.map(() => 0));

  useEffect(() => {
    let frameId = 0;
    const durationMs = 1400;
    const startTime = performance.now();

    const tick = (currentTime: number) => {
      const progress = Math.min((currentTime - startTime) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setAnimatedStats(STATS.map((stat) => Math.round(stat.value * eased)));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveStory((previous) => (previous + 1) % STORIES.length);
    }, 3200);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const revealElements = Array.from(document.querySelectorAll('.reveal-on-scroll'));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealElements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, intersectionObserver) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            intersectionObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: revealPreset.threshold,
        rootMargin: revealPreset.rootMargin,
      }
    );

    revealElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [revealPreset.threshold, revealPreset.rootMargin]);

  const handleGetStarted = () => {
    if (state.isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  const handleFeedbackSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!feedback.name.trim() || !feedback.email.trim() || !feedback.message.trim()) {
      setFeedbackStatus({ type: 'error', message: 'Please fill all feedback fields.' });
      return;
    }

    try {
      setIsSubmittingFeedback(true);
      setFeedbackStatus(null);

      await analyticsAPI.submitFeedback({
        name: feedback.name.trim(),
        email: feedback.email.trim(),
        rating: feedback.rating,
        message: feedback.message.trim(),
      });

      setFeedback({
        name: '',
        email: '',
        rating: 5,
        message: '',
      });
      setFeedbackStatus({ type: 'success', message: 'Thanks for your feedback!' });
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Unable to submit feedback right now. Please try again.');
      setFeedbackStatus({ type: 'error', message });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const feedbackLabelClass = 'block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 mb-2';
  const feedbackInputClass = 'w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-700 shadow-inner shadow-white/80 transition-all duration-200 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50" style={revealStyleVars}>

      {/* ===== Sticky Public Navigation Bar ===== */}
      <header className="sticky top-0 z-50 border-b border-white/20 bg-primary-900/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between">
            <Link to="/home" className="inline-flex items-center gap-2 text-lg sm:text-xl font-bold text-white">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 text-white text-base">🥗</span>
              <span>FoodSave</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              {state.isAuthenticated ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="rounded-xl bg-white text-primary-700 px-4 py-2 text-sm font-semibold hover:bg-primary-50 transition min-h-[40px]"
                >
                  Dashboard
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="rounded-xl border border-white/30 px-3 sm:px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition min-h-[40px]"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('/register')}
                    className="rounded-xl bg-white px-3 sm:px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 transition min-h-[40px]"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-700 via-primary-800 to-primary-900">
        <div className="absolute inset-0 bg-grid-mask opacity-20"></div>
        <div className="absolute -top-16 -left-16 h-56 w-56 rounded-full bg-white/10 blur-2xl animate-float-slow"></div>
        <div className="absolute top-20 right-4 h-48 w-48 rounded-full bg-emerald-200/20 blur-2xl animate-float-medium"></div>
        <div className="absolute bottom-10 left-1/3 h-40 w-40 rounded-full bg-lime-200/20 blur-2xl animate-float-fast"></div>
        <div className="absolute right-6 top-8 h-72 w-72 border border-white/20 rounded-full animate-spin-slow"></div>
        <div className="absolute right-12 top-14 h-60 w-60 border border-primary-200/30 rounded-full animate-spin-slow-reverse"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-12 sm:py-16 lg:py-24">
            <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-center">
              <div className="text-center lg:text-left lg:col-span-7 animate-enter-up">
                <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-4 py-1.5 text-sm text-primary-100">
                  Next-Gen Hunger Relief Platform
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-6xl">
                  Transform Surplus Food Into{' '}
                  <span className="text-emerald-200">
                    Daily Community Impact
                  </span>
                  <br className="text-emerald-200" />
                  <span className="text-2xl sm:text-3xl">with FoodSave</span>
                </h1>
                <p className="mt-6 text-lg text-primary-100 max-w-3xl mx-auto lg:mx-0">
                  A premium coordination platform that brings donors, NGOs, and volunteers together with intelligent matching, live visibility, and lightning-fast operations.
                </p>

                <div className="mt-8 flex flex-wrap gap-3 justify-center lg:justify-start">
                  {TRUST_ITEMS.map((item) => (
                    <span key={item} className="rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs sm:text-sm text-white/90 backdrop-blur-sm">
                      {item}
                    </span>
                  ))}
                </div>
                
                {state.isAuthenticated ? (
                  <div className="mt-10">
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="bg-white text-primary-700 hover:-translate-y-0.5 hover:shadow-2xl px-8 py-3 rounded-xl text-base font-semibold shadow-lg transition-all duration-300 ease-in-out"
                    >
                      Go to Dashboard
                    </button>
                  </div>
                ) : (
                  <div className="mt-10 space-y-4 sm:flex sm:items-center sm:justify-center lg:justify-start sm:gap-4 sm:space-y-0">
                    <div>
                      <button
                        onClick={() => navigate('/login')}
                        className="w-full sm:w-auto flex justify-center py-3 px-6 border border-white/20 rounded-xl shadow-lg text-base font-semibold text-primary-700 bg-white hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-100 transition-all duration-300 ease-in-out"
                      >
                        Sign In
                      </button>
                    </div>
                    <div>
                      <button
                        onClick={() => navigate('/register')}
                        className="w-full sm:w-auto flex justify-center py-3 px-6 border border-white/40 rounded-xl shadow-sm text-base font-semibold text-white bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-100 transition-all duration-300 ease-in-out"
                      >
                        Create Account
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="hidden lg:block lg:col-span-5 animate-enter-up" style={{ animationDelay: '140ms' }}>
                <div className="lg:max-w-lg relative space-y-4">
                  <div className="absolute -inset-3 rounded-2xl bg-white/20 blur-xl"></div>
                  <img
                    className="relative h-96 w-full object-cover rounded-2xl shadow-2xl border border-white/20"
                    src={homeHeroImage}
                    alt="Food donation and distribution"
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1521747205-af3f0c6e1?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8jZjw&auto=format&fit=crop&w=1200&q=80";
                    }}
                  />

                  <div className="grid grid-cols-2 gap-3 relative">
                    <div className="rounded-xl bg-white/10 border border-white/20 backdrop-blur p-3 text-left animate-enter-up" style={{ animationDelay: '260ms' }}>
                      <p className="text-xs text-primary-100">Live Success Rate</p>
                      <p className="text-2xl font-bold text-white">97%</p>
                    </div>
                    <div className="rounded-xl bg-white/10 border border-white/20 backdrop-blur p-3 text-left animate-enter-up" style={{ animationDelay: '320ms' }}>
                      <p className="text-xs text-primary-100">Avg Pickup Time</p>
                      <p className="text-2xl font-bold text-white">18m</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Proof Strip */}
      <div className="bg-white border-y border-gray-100 py-4 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap">
          {[...TRUST_ITEMS, ...TRUST_ITEMS].map((item, index) => (
            <span key={`${item}-${index}`} className="mx-4 inline-flex items-center rounded-full border border-primary-100 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700">
              ✨ {item}
            </span>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white reveal-on-scroll">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How FoodSave Works
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-12">
              A comprehensive platform connecting food donors, NGOs, and volunteers to reduce waste and fight hunger.
            </p>
          </div>
          
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="text-center p-6 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 reveal-on-scroll"
                style={{ transitionDelay: `${120 + index * 70}ms` }}
              >
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 shadow-sm ${feature.color}`}>
                  <span className="text-2xl font-bold">{feature.icon}</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Process Section */}
      <div className="bg-gradient-to-b from-secondary-50 to-white py-20 reveal-on-scroll">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Three Steps. Massive Impact.</h2>
            <p className="mt-3 text-gray-600 max-w-3xl mx-auto">
              Everything is engineered for speed, transparency, and meaningful social outcomes.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {PROCESS_STEPS.map((step, index) => (
              <div
                key={step.id}
                className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 reveal-on-scroll"
                style={{ transitionDelay: `${90 + index * 90}ms` }}
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700 text-xl mb-4">
                  {step.icon}
                </span>
                <p className="text-xs font-semibold text-primary-600 tracking-wider">STEP {step.id}</p>
                <h3 className="mt-2 text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Impact Stats */}
      <div className="relative overflow-hidden bg-gray-900 py-20 reveal-on-scroll">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-gray-900 to-gray-900"></div>
        <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl animate-float-medium"></div>
        <div className="absolute -right-14 bottom-0 h-72 w-72 rounded-full bg-secondary-400/20 blur-3xl animate-float-slow"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 relative">
            <h2 className="text-3xl font-bold text-white mb-8">
              Making a Real Impact
            </h2>
            <p className="text-lg text-primary-100 max-w-3xl mx-auto">
              Join thousands of users making a difference in communities worldwide.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative">
            {STATS.map((stat, index) => (
              <div
                key={index}
                className="text-center bg-white/95 rounded-2xl border border-white/20 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 reveal-on-scroll"
                style={{ transitionDelay: `${80 + index * 80}ms` }}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-2">
                  <span className="text-xl font-bold">{stat.icon}</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{animatedStats[index]}{stat.suffix}</div>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {LIVE_STREAM.map((item, index) => (
              <div
                key={item.title}
                className="rounded-2xl border border-primary-700 bg-primary-800/70 px-4 py-4 text-left reveal-on-scroll"
                style={{ transitionDelay: `${120 + index * 80}ms` }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{item.icon} {item.title}</p>
                  <span className="text-xs text-primary-200">{item.time}</span>
                </div>
                <p className="mt-2 text-sm text-primary-100">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stories Section */}
      <div className="bg-white py-20 reveal-on-scroll">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900">Voices from the Community</h2>
            <p className="mt-3 text-gray-600">Real teams using FoodSave to serve with speed and dignity.</p>
          </div>

          <div className="relative rounded-3xl border border-gray-100 bg-gradient-to-br from-primary-50 via-white to-secondary-50 p-8 sm:p-10 shadow-lg reveal-on-scroll" style={{ transitionDelay: '120ms' }}>
            <div className="min-h-[140px]">
              <p className="text-xl sm:text-2xl font-semibold text-gray-900 leading-relaxed">“{STORIES[activeStory].quote}”</p>
              <p className="mt-6 text-base font-semibold text-primary-700">{STORIES[activeStory].author}</p>
              <p className="text-sm text-gray-600">{STORIES[activeStory].role}</p>
            </div>

            <div className="mt-8 flex justify-center gap-2">
              {STORIES.map((story, index) => (
                <button
                  key={story.author}
                  onClick={() => setActiveStory(index)}
                  aria-label={`Show story ${index + 1}`}
                  className={`h-2.5 rounded-full transition-all ${activeStory === index ? 'w-8 bg-primary-600' : 'w-2.5 bg-primary-200 hover:bg-primary-300'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Section */}
      <div className="bg-white py-20 reveal-on-scroll">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900">Share Your Feedback</h2>
            <p className="mt-3 text-gray-600">Tell us how we can improve FoodSave for you.</p>
          </div>

          <form
            onSubmit={handleFeedbackSubmit}
            className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_34%),radial-gradient(circle_at_86%_15%,_rgba(249,115,22,0.12),_transparent_30%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-6 sm:p-8 shadow-[0_25px_60px_-35px_rgba(15,23,42,0.28)] reveal-on-scroll"
            style={{ transitionDelay: '120ms' }}
            autoComplete="off"
          >
            <div className="pointer-events-none absolute -top-14 -right-10 h-32 w-32 rounded-full bg-primary-200/35 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 left-8 h-28 w-28 rounded-full bg-secondary-200/35 blur-2xl" />

            <div className="relative mb-5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-700">
                Community Feedback
              </span>
              <span className="text-xs text-slate-400">Your inputs help shape the next updates</span>
            </div>

            <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-100 bg-white/70 p-3">
                <label className={feedbackLabelClass}>Name</label>
                <input
                  type="text"
                  value={feedback.name}
                  onChange={(e) => setFeedback((prev) => ({ ...prev, name: e.target.value }))}
                  className={feedbackInputClass}
                  placeholder="Your name"
                  maxLength={120}
                />
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white/70 p-3">
                <label className={feedbackLabelClass}>Email</label>
                <input
                  type="email"
                  value={feedback.email}
                  onChange={(e) => setFeedback((prev) => ({ ...prev, email: e.target.value }))}
                  className={feedbackInputClass}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="relative mt-4 rounded-2xl border border-slate-100 bg-white/70 p-3">
              <label className={feedbackLabelClass}>Rating</label>
              <select
                value={feedback.rating}
                onChange={(e) => setFeedback((prev) => ({ ...prev, rating: Number(e.target.value) }))}
                className={feedbackInputClass}
              >
                <option value={5}>5 - Excellent</option>
                <option value={4}>4 - Good</option>
                <option value={3}>3 - Average</option>
                <option value={2}>2 - Needs Improvement</option>
                <option value={1}>1 - Poor</option>
              </select>
            </div>

            <div className="relative mt-4 rounded-2xl border border-slate-100 bg-white/70 p-3">
              <label className={feedbackLabelClass}>Message</label>
              <textarea
                rows={4}
                value={feedback.message}
                onChange={(e) => setFeedback((prev) => ({ ...prev, message: e.target.value }))}
                className={`${feedbackInputClass} min-h-[120px] resize-none`}
                placeholder="Share your experience..."
                maxLength={1000}
              />
            </div>

            {feedbackStatus && (
              <div className={`relative mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${feedbackStatus.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                {feedbackStatus.message}
              </div>
            )}

            <div className="relative mt-6 text-right">
              <button
                type="submit"
                disabled={isSubmittingFeedback}
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-primary-600 to-secondary-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary-500/35 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-primary-800 via-primary-700 to-primary-600 reveal-on-scroll">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Build the Future of Community Food Rescue?
            </h2>
            <p className="text-lg text-primary-100 max-w-3xl mx-auto mb-8">
              Launch your impact journey with a platform designed like modern SaaS, powered by mission-first intelligence.
            </p>
            <div className="mt-8">
              <button
                onClick={handleGetStarted}
                className="bg-white text-primary-700 hover:-translate-y-0.5 px-8 py-3 rounded-xl text-base font-semibold shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out"
              >
                {state.isAuthenticated ? 'Go to Dashboard' : 'Get Started Today'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
