import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapContainer, Marker, Popup, TileLayer, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { analyticsAPI, donationsAPI } from '../services/api';
import {
  buildOdishaAddress,
  findOdishaLocationByCoordinates,
  ODISHA_DEFAULT_CENTER,
  ODISHA_LOCATIONS,
} from '../data/odishaLocations';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const LeafletDefaultIcon = L.Icon.Default as typeof L.Icon.Default & {
  mergeOptions: (options: L.IconOptions) => void;
};

LeafletDefaultIcon.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type ApiError = {
  message?: string;
  response?: {
    data?: {
      error?: string;
      detail?: string;
      message?: string;
    };
  };
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const apiError = error as ApiError;
  return (
    apiError?.message
    || apiError?.response?.data?.error
    || apiError?.response?.data?.detail
    || apiError?.response?.data?.message
    || fallback
  );
};

type FoodSafetyResult = {
  food_name: string;
  prediction: 'SAFE' | 'EXPIRING_SOON' | 'UNSAFE';
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  safety_score: number;
  freshness_score: number;
  hours_since_cooked: number;
  hours_until_expiry: number;
  risk_factors: string[];
  recommended_action: string;
};

type NearestNgoResult = {
  ngo_id: number;
  name: string;
  organization_name?: string;
  distance_km: number;
  eta_minutes?: number;
  match_reason?: string;
};

type PriorityDonationResult = {
  donation_id: number;
  food_name: string;
  hours_until_expiry: number;
  priority_score?: number;
  priority_band?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  pickup_recommendation?: string;
};

type NgoRecommendationResult = {
  ngo_id: number;
  name: string;
  organization_name?: string;
  recommendation_score: number;
  distance_km: number;
  eta_minutes?: number;
  reason?: string;
};

type NotificationResult = {
  donation_id: number;
  notified_ngos_count: number;
  notified_volunteers_count: number;
};

type FoodSafetyFormState = {
  foodName: string;
  storageCondition: 'AMBIENT' | 'HOT' | 'REFRIGERATED' | 'FROZEN';
  cookedTime: string;
  expiryTime: string;
};

type DonationContext = {
  id: number;
  food_name: string;
  cooked_time: string | null;
  expiry_time: string;
  storage_condition: string;
  pickup_latitude: number | string | null;
  pickup_longitude: number | string | null;
  pickup_address?: string;
  status?: string;
};

const toLocalDateTimeInput = (date: Date) => {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
};

const getPredictionTheme = (prediction?: FoodSafetyResult['prediction']) => {
  switch (prediction) {
    case 'SAFE':
      return {
        pill: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        glow: 'from-emerald-400/30 to-primary-500/10',
      };
    case 'EXPIRING_SOON':
      return {
        pill: 'bg-amber-100 text-amber-700 border-amber-200',
        glow: 'from-amber-300/30 to-orange-400/10',
      };
    case 'UNSAFE':
      return {
        pill: 'bg-rose-100 text-rose-700 border-rose-200',
        glow: 'from-rose-400/30 to-red-500/10',
      };
    default:
      return {
        pill: 'bg-slate-100 text-slate-600 border-slate-200',
        glow: 'from-slate-200/40 to-slate-100',
      };
  }
};

const getPriorityTone = (band?: PriorityDonationResult['priority_band']) => {
  switch (band) {
    case 'CRITICAL':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'HIGH':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    default:
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
};

const MapAutoResize: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => {
      map.invalidateSize({ pan: false, debounceMoveend: true });
    };

    const timer = window.setTimeout(invalidate, 180);
    window.addEventListener('resize', invalidate);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => invalidate());
      const container = map.getContainer();
      observer.observe(container);
      if (container.parentElement) {
        observer.observe(container.parentElement);
      }
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', invalidate);
      observer?.disconnect();
    };
  }, [map]);

  return null;
};

const MapViewportController: React.FC<{ center: [number, number]; hasLocation: boolean }> = ({ center, hasLocation }) => {
  const map = useMap();

  useEffect(() => {
    const targetZoom = hasLocation ? Math.max(map.getZoom(), 12) : 7;
    map.setView(center, targetZoom, { animate: false });
    const timer = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(timer);
  }, [center, hasLocation, map]);

  return null;
};

const MapZoomButtons: React.FC = () => {
  const map = useMap();

  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
        title="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
        title="Zoom out"
      >
        −
      </button>
    </div>
  );
};

const normalizeStorageCondition = (value?: string | null): FoodSafetyFormState['storageCondition'] => {
  const normalized = (value || '').toUpperCase();
  if (normalized === 'HOT') return 'HOT';
  if (normalized === 'REFRIGERATED') return 'REFRIGERATED';
  if (normalized === 'FROZEN') return 'FROZEN';
  return 'AMBIENT';
};

const toLocalFromIso = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return toLocalDateTimeInput(date);
};

const AIAlgorithmPanel: React.FC<{ title?: string }> = ({ title = 'AI Algorithm Tool' }) => {
  const [algoLoading, setAlgoLoading] = useState<string | null>(null);
  const [algoError, setAlgoError] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [selectedOdishaLocationKey, setSelectedOdishaLocationKey] = useState('');
  const [donationIdForNotify, setDonationIdForNotify] = useState('');
  const [donationIdInput, setDonationIdInput] = useState('');
  const [donationContext, setDonationContext] = useState<DonationContext | null>(null);
  const [foodSafetyForm, setFoodSafetyForm] = useState<FoodSafetyFormState>(() => {
    const now = new Date();
    return {
      foodName: '',
      storageCondition: 'AMBIENT',
      cookedTime: toLocalDateTimeInput(new Date(now.getTime() - 3 * 60 * 60 * 1000)),
      expiryTime: toLocalDateTimeInput(new Date(now.getTime() + 5 * 60 * 60 * 1000)),
    };
  });
  const [foodSafetyResult, setFoodSafetyResult] = useState<FoodSafetyResult | null>(null);
  const [nearestNgoResults, setNearestNgoResults] = useState<NearestNgoResult[]>([]);
  const [priorityResults, setPriorityResults] = useState<PriorityDonationResult[]>([]);
  const [recommendationResults, setRecommendationResults] = useState<NgoRecommendationResult[]>([]);
  const [notificationResult, setNotificationResult] = useState<NotificationResult | null>(null);

  const hasLocation = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
  }, [latitude, longitude]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (!hasLocation) return ODISHA_DEFAULT_CENTER;
    return [Number(latitude), Number(longitude)];
  }, [hasLocation, latitude, longitude]);

  const resolvedLocation = useMemo(() => {
    if (selectedOdishaLocationKey) {
      return ODISHA_LOCATIONS.find((location) => location.key === selectedOdishaLocationKey) || null;
    }

    if (!hasLocation) {
      return null;
    }

    return findOdishaLocationByCoordinates(latitude, longitude);
  }, [hasLocation, latitude, longitude, selectedOdishaLocationKey]);

  const mapRings = useMemo(() => {
    const nearest = nearestNgoResults.map((ngo) => ({
      key: `nearest-${ngo.ngo_id}`,
      label: ngo.organization_name || ngo.name,
      distanceKm: ngo.distance_km,
      color: '#0284c7',
    }));

    const recommended = recommendationResults.map((ngo) => ({
      key: `recommended-${ngo.ngo_id}`,
      label: ngo.organization_name || ngo.name,
      distanceKm: ngo.distance_km,
      color: '#ca8a04',
    }));

    return [...nearest, ...recommended].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 8);
  }, [nearestNgoResults, recommendationResults]);

  const summaryDeck = useMemo(() => ([
    {
      label: 'Safety Confidence',
      value: foodSafetyResult ? `${foodSafetyResult.safety_score}%` : 'Awaiting run',
      detail: foodSafetyResult ? foodSafetyResult.prediction.replace('_', ' ') : 'Food safety model idle',
      tone: 'from-primary-500 to-teal-400',
    },
    {
      label: 'Nearest Match',
      value: nearestNgoResults[0] ? `${nearestNgoResults[0].distance_km} km` : 'No match yet',
      detail: nearestNgoResults[0] ? (nearestNgoResults[0].organization_name || nearestNgoResults[0].name) : 'Run nearest NGO match',
      tone: 'from-secondary-500 to-amber-400',
    },
    {
      label: 'Queue Pressure',
      value: priorityResults[0] ? `${priorityResults[0].hours_until_expiry}h left` : 'No queue',
      detail: priorityResults[0] ? `${priorityResults.length} urgent donations surfaced` : 'Run priority queue',
      tone: 'from-rose-500 to-orange-400',
    },
    {
      label: 'Notification Burst',
      value: notificationResult ? `${notificationResult.notified_ngos_count + notificationResult.notified_volunteers_count}` : 'Standby',
      detail: notificationResult ? 'Stakeholders alerted' : 'Trigger donation notification blast',
      tone: 'from-violet-500 to-fuchsia-400',
    },
  ]), [foodSafetyResult, nearestNgoResults, notificationResult, priorityResults]);

  const inferenceStream = useMemo(() => {
    const entries: Array<{ id: string; title: string; detail: string; tone: string }> = [];

    if (foodSafetyResult) {
      entries.push({
        id: `safety-${foodSafetyResult.prediction}`,
        title: `Safety model: ${foodSafetyResult.prediction.replace('_', ' ')}`,
        detail: `${foodSafetyResult.food_name} scored ${foodSafetyResult.safety_score}% safety and ${foodSafetyResult.freshness_score}% freshness.`,
        tone: 'from-primary-500 to-emerald-400',
      });
    }

    if (nearestNgoResults[0]) {
      entries.push({
        id: `nearest-${nearestNgoResults[0].ngo_id}`,
        title: 'Nearest NGO match ready',
        detail: `${nearestNgoResults[0].organization_name || nearestNgoResults[0].name} at ${nearestNgoResults[0].distance_km} km.`,
        tone: 'from-secondary-500 to-primary-500',
      });
    }

    if (recommendationResults[0]) {
      entries.push({
        id: `reco-${recommendationResults[0].ngo_id}`,
        title: 'Recommendation score updated',
        detail: `${recommendationResults[0].organization_name || recommendationResults[0].name} scored ${recommendationResults[0].recommendation_score}% fit.`,
        tone: 'from-amber-400 to-secondary-500',
      });
    }

    if (priorityResults[0]) {
      entries.push({
        id: `priority-${priorityResults[0].donation_id}`,
        title: 'Priority queue refreshed',
        detail: `Donation #${priorityResults[0].donation_id} is ${priorityResults[0].priority_band || 'LOW'} with ${priorityResults[0].hours_until_expiry}h left.`,
        tone: 'from-rose-500 to-orange-400',
      });
    }

    if (notificationResult) {
      entries.push({
        id: `notify-${notificationResult.donation_id}`,
        title: 'Notification burst delivered',
        detail: `NGOs: ${notificationResult.notified_ngos_count}, Volunteers: ${notificationResult.notified_volunteers_count}.`,
        tone: 'from-violet-500 to-fuchsia-500',
      });
    }

    return entries.slice(0, 5);
  }, [foodSafetyResult, nearestNgoResults, notificationResult, priorityResults, recommendationResults]);

  const inputClass = 'w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 shadow-inner shadow-white focus:outline-none focus:ring-2 focus:ring-primary-500';
  const predictionTheme = getPredictionTheme(foodSafetyResult?.prediction);

  const parseCoordinates = () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new Error('Set a valid location first.');
    }
    return { lat, lng };
  };

  const updateFoodSafetyField = (field: keyof FoodSafetyFormState, value: string) => {
    setFoodSafetyForm((current) => ({ ...current, [field]: value }));
  };

  const handleDonationIdKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      loadDonationContext();
    }
  };

  const loadDonationContext = async () => {
    setAlgoLoading('donation-context');
    setAlgoError('');

    try {
      const donationId = Number(donationIdInput || donationIdForNotify);
      if (!Number.isFinite(donationId) || donationId <= 0) {
        throw new Error('Enter a valid donation ID first.');
      }

      const response = await donationsAPI.getDonation(donationId);
      const donation = response.data as DonationContext;
      setDonationContext(donation);
      setDonationIdInput(String(donation.id));
      setDonationIdForNotify(String(donation.id));

      setFoodSafetyForm((current) => ({
        ...current,
        foodName: donation.food_name || current.foodName,
        storageCondition: normalizeStorageCondition(donation.storage_condition),
        cookedTime: toLocalFromIso(donation.cooked_time) || current.cookedTime,
        expiryTime: toLocalFromIso(donation.expiry_time) || current.expiryTime,
      }));

      const lat = donation.pickup_latitude;
      const lng = donation.pickup_longitude;
      if (lat !== null && lng !== null && lat !== '' && lng !== '') {
        setLatitude(String(lat));
        setLongitude(String(lng));
        setSelectedOdishaLocationKey('');
      }
    } catch (error: unknown) {
      setDonationContext(null);
      setAlgoError(getApiErrorMessage(error, 'Failed to load donation context.'));
    } finally {
      setAlgoLoading(null);
    }
  };

  const handleOdishaLocationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const key = event.target.value;
    setSelectedOdishaLocationKey(key);
    setAlgoError('');

    const selectedLocation = ODISHA_LOCATIONS.find((location) => location.key === key);
    if (!selectedLocation) {
      return;
    }

    setLatitude(String(selectedLocation.latitude));
    setLongitude(String(selectedLocation.longitude));
  };

  const useCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setAlgoError('Location is not supported in this browser.');
      return;
    }

    if (!window.isSecureContext) {
      setAlgoError('Location access requires a secure context. Use https or localhost in a regular browser tab.');
      return;
    }

    setAlgoLoading('location');
    setAlgoError('');

    const applyPosition = (position: GeolocationPosition) => {
      setLatitude(String(position.coords.latitude));
      setLongitude(String(position.coords.longitude));
      setSelectedOdishaLocationKey('');
      setAlgoLoading(null);
    };

    const handleFailure = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        setAlgoError('Location permission denied. Allow location access in your browser settings and try again.');
      } else if (error.code === error.TIMEOUT) {
        setAlgoError('Location request timed out. Try again with better network/GPS signal.');
      } else {
        setAlgoError('Could not get current location. Allow location permission and try again.');
      }
      setAlgoLoading(null);
    };

    navigator.geolocation.getCurrentPosition(
      applyPosition,
      (error) => {
        if (error.code === error.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            applyPosition,
            handleFailure,
            {
              enableHighAccuracy: false,
              timeout: 18000,
              maximumAge: 120000,
            }
          );
          return;
        }
        handleFailure(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const runFoodSafetyCheck = async () => {
    setAlgoLoading('food-safety');
    setAlgoError('');

    try {
      if (!foodSafetyForm.expiryTime) {
        throw new Error('Expiry time is required for the safety prediction.');
      }

      const response = await analyticsAPI.predictFoodSafety({
        food_name: donationContext?.food_name || foodSafetyForm.foodName || 'Donation Item',
        cooked_time: foodSafetyForm.cookedTime ? new Date(foodSafetyForm.cookedTime).toISOString() : null,
        expiry_time: new Date(foodSafetyForm.expiryTime).toISOString(),
        storage_condition: foodSafetyForm.storageCondition,
      });

      setFoodSafetyResult(response.data);
    } catch (error: unknown) {
      setAlgoError(getApiErrorMessage(error, 'Failed to run food safety prediction.'));
    } finally {
      setAlgoLoading(null);
    }
  };

  const runNearestNgoMatch = async () => {
    setAlgoLoading('nearest-ngo');
    setAlgoError('');

    try {
      const { lat, lng } = parseCoordinates();
      const response = await analyticsAPI.nearestNgoMatch({ latitude: lat, longitude: lng, limit: 5 });
      setNearestNgoResults(response.data.nearest_ngos || []);
    } catch (error: unknown) {
      setAlgoError(getApiErrorMessage(error, 'Failed to get nearest NGOs.'));
    } finally {
      setAlgoLoading(null);
    }
  };

  const runPriorityQueue = async () => {
    setAlgoLoading('priority-queue');
    setAlgoError('');

    try {
      const response = await analyticsAPI.donationPriorityQueue({ limit: 6 });
      const prioritizedRaw = response.data.prioritized_donations || [];

      if (donationContext?.id) {
        const selected = prioritizedRaw.find((item: PriorityDonationResult) => item.donation_id === donationContext.id);
        const ordered = selected
          ? [selected, ...prioritizedRaw.filter((item: PriorityDonationResult) => item.donation_id !== donationContext.id)]
          : prioritizedRaw;
        setPriorityResults(ordered);
        setDonationIdForNotify(String(donationContext.id));
      } else {
        setPriorityResults(prioritizedRaw);
        if (!donationIdForNotify && prioritizedRaw.length > 0) {
          setDonationIdForNotify(String(prioritizedRaw[0].donation_id));
        }
      }
    } catch (error: unknown) {
      setAlgoError(getApiErrorMessage(error, 'Failed to fetch prioritized donations.'));
    } finally {
      setAlgoLoading(null);
    }
  };

  const runRecommendations = async () => {
    setAlgoLoading('recommend-ngos');
    setAlgoError('');

    try {
      const { lat, lng } = parseCoordinates();
      const response = await analyticsAPI.recommendNgos({ latitude: lat, longitude: lng, limit: 5 });
      setRecommendationResults(response.data.recommended_ngos || []);
    } catch (error: unknown) {
      setAlgoError(getApiErrorMessage(error, 'Failed to get NGO recommendations.'));
    } finally {
      setAlgoLoading(null);
    }
  };

  const runNotificationTrigger = async () => {
    setAlgoLoading('trigger-notifications');
    setAlgoError('');

    try {
      if (!donationIdForNotify) {
        throw new Error('Select or enter a donation ID first.');
      }
      const response = await analyticsAPI.triggerDonationNotifications({ donation_id: Number(donationIdForNotify) });
      setNotificationResult(response.data);
    } catch (error: unknown) {
      setAlgoError(getApiErrorMessage(error, 'Failed to trigger notifications.'));
    } finally {
      setAlgoLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Algorithm workspace</p>
          <h3 className="mt-1 text-3xl font-bold text-slate-900">{title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
            Run food safety prediction, smart NGO routing, queue prioritization and notification bursts from a single operational layer.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          {algoLoading ? `Processing ${algoLoading.replace('-', ' ')}` : 'All AI actions ready'}
        </div>
      </div>

      {algoError ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="mt-0.5 text-lg">⚠️</span>
          <span>{algoError}</span>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryDeck.map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="group relative overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.24)]"
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.tone}`} />
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{card.label}</p>
            <p className="mt-4 text-2xl font-black text-slate-900">{card.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{card.detail}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="relative overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white/95 p-6 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.25)]">
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-primary-500/10 via-secondary-400/10 to-transparent" />
          <div className="relative space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Food safety model</p>
              <h4 className="mt-1 text-xl font-bold text-slate-900">Freshness and risk profiling</h4>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="text"
                value={foodSafetyForm.foodName}
                onChange={(event) => updateFoodSafetyField('foodName', event.target.value)}
                placeholder="Food name"
                className={inputClass}
              />
              <select
                value={foodSafetyForm.storageCondition}
                onChange={(event) => updateFoodSafetyField('storageCondition', event.target.value)}
                className={inputClass}
              >
                <option value="AMBIENT">Ambient</option>
                <option value="HOT">Hot-held</option>
                <option value="REFRIGERATED">Refrigerated</option>
                <option value="FROZEN">Frozen</option>
              </select>
              <input
                type="datetime-local"
                value={foodSafetyForm.cookedTime}
                onChange={(event) => updateFoodSafetyField('cookedTime', event.target.value)}
                className={inputClass}
              />
              <input
                type="datetime-local"
                value={foodSafetyForm.expiryTime}
                onChange={(event) => updateFoodSafetyField('expiryTime', event.target.value)}
                className={inputClass}
              />
            </div>
            <button
              onClick={runFoodSafetyCheck}
              disabled={!!algoLoading}
              className="inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {algoLoading === 'food-safety' ? 'Running safety model...' : 'Run Food Safety Model'}
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[1.8rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_22px_60px_-34px_rgba(15,23,42,0.8)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.2),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.18),_transparent_35%)]" />
          <div className="relative space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">Location intelligence</p>
                <h4 className="mt-1 text-xl font-bold">Target the right rescue radius</h4>
              </div>
              <button
                onClick={useCurrentLocation}
                disabled={algoLoading === 'location'}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
              >
                {algoLoading === 'location' ? 'Detecting...' : 'Use Current Location'}
              </button>
            </div>
            <input
              type="number"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              placeholder="Latitude"
              step="any"
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-secondary-400"
            />
            <input
              type="number"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              placeholder="Longitude"
              step="any"
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-secondary-400"
            />
            <select
              value={selectedOdishaLocationKey}
              onChange={handleOdishaLocationChange}
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-secondary-400"
            >
              <option value="" className="text-slate-900 bg-white">Select Odisha district / area</option>
              {ODISHA_LOCATIONS.map((location) => (
                <option key={location.key} value={location.key} className="text-slate-900 bg-white">
                  {location.district} - {location.area}
                </option>
              ))}
            </select>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Selected area</p>
              <p className="mt-1 text-sm font-medium text-white">
                {resolvedLocation ? `${resolvedLocation.district} - ${resolvedLocation.area}` : 'No district / area selected yet'}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {resolvedLocation ? buildOdishaAddress(resolvedLocation) : 'Choose from the Odisha list or use a known matching coordinate pair.'}
              </p>
            </div>
            <input
              type="number"
              value={donationIdInput}
              onChange={(event) => {
                const value = event.target.value;
                setDonationIdInput(value);
                setDonationIdForNotify(value);
              }}
              onKeyDown={handleDonationIdKeyDown}
              placeholder="Donation ID context (e.g. 12)"
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-secondary-400"
            />
            <button
              onClick={loadDonationContext}
              disabled={!!algoLoading}
              className="inline-flex rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
            >
              {algoLoading === 'donation-context' ? 'Loading donation...' : 'Load Donation Context'}
            </button>
            {donationContext ? (
              <div className="rounded-2xl border border-emerald-200/40 bg-emerald-500/10 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">Loaded donation</p>
                <p className="mt-1 text-sm font-medium text-white">#{donationContext.id} • {donationContext.food_name}</p>
                <p className="mt-1 text-xs text-white/70">Status: {donationContext.status || 'N/A'}{donationContext.pickup_address ? ` • ${donationContext.pickup_address}` : ''}</p>
              </div>
            ) : null}
            <input
              type="number"
              value={donationIdForNotify}
              onChange={(event) => setDonationIdForNotify(event.target.value)}
              placeholder="Donation ID for notifications"
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-secondary-400"
            />
            <p className="text-xs leading-6 text-white/60">
              Donation ID is the numeric value like <span className="font-semibold text-white">#12</span>. You can copy it from the priority queue below or use one of the recent donations listed in the selection panel.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-xs shadow-[0_12px_30px_-24px_rgba(15,23,42,0.25)]">
        <span className="font-semibold uppercase tracking-[0.18em] text-slate-400">Context</span>
        {donationContext ? (
          <>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
              Donation #{donationContext.id}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
              {donationContext.food_name}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
              Notify ID: {donationIdForNotify || donationContext.id}
            </span>
          </>
        ) : (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
            No donation context loaded
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            key: 'nearest-ngo',
            label: 'Nearest NGOs',
            detail: 'Locate the fastest pickup possibilities by distance.',
            action: runNearestNgoMatch,
            tone: 'from-secondary-500 to-primary-500',
          },
          {
            key: 'priority-queue',
            label: 'Priority Queue',
            detail: 'Surface donations that need immediate intervention.',
            action: runPriorityQueue,
            tone: 'from-rose-500 to-orange-400',
          },
          {
            key: 'recommend-ngos',
            label: 'Recommend NGOs',
            detail: 'Blend distance, readiness and score into best-fit matches.',
            action: runRecommendations,
            tone: 'from-amber-400 to-secondary-500',
          },
          {
            key: 'trigger-notifications',
            label: 'Trigger Notify',
            detail: 'Send immediate alerts to NGOs and volunteers.',
            action: runNotificationTrigger,
            tone: 'from-violet-500 to-fuchsia-500',
          },
        ].map((button) => (
          <button
            key={button.key}
            onClick={button.action}
            disabled={!!algoLoading}
            className="group relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-5 text-left shadow-[0_18px_45px_-30px_rgba(15,23,42,0.25)] transition hover:-translate-y-1 disabled:opacity-50"
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${button.tone}`} />
            <p className="text-sm font-bold text-slate-900">{algoLoading === button.key ? 'Running...' : button.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{button.detail}</p>
          </button>
        ))}
      </div>

      <div className="rounded-[1.8rem] border border-slate-200 bg-white/95 p-6 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Live stream</p>
            <h4 className="mt-1 text-2xl font-bold text-slate-900">AI inference events</h4>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
            {inferenceStream.length} active signal{inferenceStream.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="mt-5 space-y-3">
          <AnimatePresence mode="popLayout">
            {inferenceStream.length > 0 ? (
              inferenceStream.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, delay: index * 0.04 }}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-2.5 w-2.5 rounded-full bg-gradient-to-r ${event.tone}`} />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{event.detail}</p>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.p
                key="empty-stream"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-slate-500"
              >
                Run any AI action to populate the live inference stream.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className={`relative overflow-hidden rounded-[1.8rem] border border-slate-200 bg-gradient-to-br ${predictionTheme.glow} p-6 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.22)]`}>
          <div className="rounded-[1.4rem] border border-white/60 bg-white/80 p-5 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Food safety result</p>
                <h4 className="mt-1 text-2xl font-bold text-slate-900">Confidence profile</h4>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${predictionTheme.pill}`}>
                {foodSafetyResult ? foodSafetyResult.prediction.replace('_', ' ') : 'No prediction yet'}
              </span>
            </div>

            <AnimatePresence mode="wait">
              {foodSafetyResult ? (
                <motion.div
                  key={`food-${foodSafetyResult.prediction}-${foodSafetyResult.safety_score}-${foodSafetyResult.freshness_score}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6 space-y-5"
                >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold text-slate-900">{foodSafetyResult.food_name}</p>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{foodSafetyResult.recommended_action}</p>
                  </div>
                  <div className="flex gap-4">
                    {[
                      { label: 'Safety', value: foodSafetyResult.safety_score, color: '#0f766e' },
                      { label: 'Freshness', value: foodSafetyResult.freshness_score, color: '#f97316' },
                    ].map((ring) => (
                      <div key={ring.label} className="text-center">
                        <div
                          className="flex h-24 w-24 items-center justify-center rounded-full"
                          style={{
                            background: `conic-gradient(${ring.color} ${Math.max(0, Math.min(360, ring.value * 3.6))}deg, rgba(148,163,184,0.18) 0deg)`,
                          }}
                        >
                          <div className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-white text-slate-900 shadow-inner">
                            <span className="text-lg font-black">{ring.value}%</span>
                          </div>
                        </div>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{ring.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { label: 'Risk Level', value: foodSafetyResult.risk_level },
                    { label: 'Cooked Ago', value: `${foodSafetyResult.hours_since_cooked}h` },
                    { label: 'Expires In', value: `${foodSafetyResult.hours_until_expiry}h` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                      <p className="mt-2 text-lg font-bold text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Risk factors</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {foodSafetyResult.risk_factors.length > 0 ? foodSafetyResult.risk_factors.map((factor) => (
                      <span key={factor} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {factor}
                      </span>
                    )) : (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        No major risk factors detected
                      </span>
                    )}
                  </div>
                </div>
                </motion.div>
              ) : (
                <motion.p
                  key="food-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 text-sm text-slate-500"
                >
                  Run the food safety model to generate a prediction profile.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-slate-200 bg-white/95 p-6 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.25)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Spatial layer</p>
              <h4 className="mt-1 text-2xl font-bold text-slate-900">Route map view</h4>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              {mapRings.length} active ring{mapRings.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">Blue rings show nearest NGOs by distance. Amber rings show recommendation distances.</p>
          <div className="mt-5 h-[340px] overflow-hidden rounded-2xl border border-slate-200">
            <MapContainer
              center={mapCenter}
              zoom={hasLocation ? 12 : 7}
              scrollWheelZoom={true}
              zoomControl={false}
              minZoom={4}
              maxZoom={18}
              preferCanvas
              style={{ height: '100%', width: '100%' }}
            >
              <MapAutoResize />
              <MapViewportController center={mapCenter} hasLocation={hasLocation} />
              <MapZoomButtons />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {hasLocation ? (
                <>
                  <Marker position={mapCenter}>
                    <Popup>Pickup location</Popup>
                  </Marker>
                  {mapRings.map((ring) => (
                    <Circle
                      key={ring.key}
                      center={mapCenter}
                      radius={Math.max(100, ring.distanceKm * 1000)}
                      pathOptions={{ color: ring.color, weight: 2, fillOpacity: 0.06 }}
                    >
                      <Popup>{ring.label} • ~{ring.distanceKm} km</Popup>
                    </Circle>
                  ))}
                </>
              ) : null}
            </MapContainer>
          </div>
          {!hasLocation ? <p className="mt-3 text-xs font-semibold text-amber-700">Set a valid latitude and longitude to visualize matches.</p> : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[1.8rem] border border-slate-200 bg-white/95 p-6 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.24)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Distance ranking</p>
              <h4 className="mt-1 text-2xl font-bold text-slate-900">Nearest NGOs</h4>
            </div>
          </div>
          {nearestNgoResults.length > 0 ? (
            <div className="mt-5 space-y-4">
              {nearestNgoResults.map((ngo, index) => {
                const fill = Math.max(12, 100 - Math.min(85, ngo.distance_km * 10));

                return (
                  <motion.div
                    key={ngo.ngo_id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{ngo.organization_name || ngo.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">Match rank {index + 1}</p>
                      </div>
                      <span className="rounded-full bg-secondary-50 px-3 py-1 text-xs font-semibold text-secondary-700">{ngo.distance_km} km</span>
                    </div>
                    <div className="mt-4 h-2.5 rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-gradient-to-r from-secondary-500 to-primary-500" style={{ width: `${fill}%` }} />
                    </div>
                    {ngo.match_reason ? <p className="mt-3 text-sm leading-6 text-slate-500">{ngo.match_reason}</p> : null}
                  </motion.div>
                );
              })}
            </div>
          ) : <p className="mt-4 text-sm text-slate-500">Run nearest NGO search to build the ranking.</p>}
        </div>

        <div className="rounded-[1.8rem] border border-slate-200 bg-white/95 p-6 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.24)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Recommendation engine</p>
              <h4 className="mt-1 text-2xl font-bold text-slate-900">Best-fit NGOs</h4>
            </div>
          </div>
          {recommendationResults.length > 0 ? (
            <div className="mt-5 space-y-4">
              {recommendationResults.map((ngo, index) => (
                <motion.div
                  key={ngo.ngo_id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{ngo.organization_name || ngo.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">Recommendation rank {index + 1}</p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{ngo.recommendation_score}%</span>
                  </div>
                  <div className="mt-4 h-2.5 rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-secondary-500" style={{ width: `${Math.max(10, ngo.recommendation_score)}%` }} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {ngo.distance_km} km away{ngo.reason ? ` • ${ngo.reason}` : ''}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-slate-500">Run NGO recommendations to see best-fit assignments.</p>}
        </div>
      </div>

      <div className="rounded-[1.8rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_22px_60px_-34px_rgba(15,23,42,0.78)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">Urgency lane</p>
            <h4 className="mt-1 text-2xl font-bold">Priority queue</h4>
          </div>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white/75">
            {priorityResults.length} prioritized items
          </span>
        </div>
        {priorityResults.length > 0 ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {priorityResults.map((item, index) => (
              <motion.div
                key={item.donation_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">#{item.donation_id} {item.food_name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/40">{item.pickup_recommendation || 'Dispatch review recommended'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDonationIdForNotify(String(item.donation_id))}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                    >
                      Use ID
                    </button>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getPriorityTone(item.priority_band)}`}>
                      {item.priority_band || 'LOW'}
                    </span>
                  </div>
                </div>
                <div className="mt-4 h-2.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300"
                    style={{ width: `${Math.max(12, Math.min(100, item.priority_score || (100 - item.hours_until_expiry * 8))) }%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-white/70">
                  <span>{item.hours_until_expiry}h left</span>
                  <span>Priority {item.priority_score || 'n/a'}</span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-white/55">Run the priority queue to identify expiring donations first.</p>}
      </div>

      {notificationResult ? (
        <div className="flex items-center gap-3 rounded-[1.6rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 shadow-[0_14px_40px_-28px_rgba(16,185,129,0.45)]">
          <span className="text-xl">🔔</span>
          <span>
            Notification burst completed for donation <strong>#{notificationResult.donation_id}</strong>. NGOs notified: {notificationResult.notified_ngos_count}. Volunteers notified: {notificationResult.notified_volunteers_count}.
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default AIAlgorithmPanel;
