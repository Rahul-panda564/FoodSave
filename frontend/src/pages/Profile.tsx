import React, { useMemo, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import {
  ODISHA_LOCATIONS,
  findOdishaLocationByCoordinates,
} from '../data/odishaLocations';

const extractPinFromAddress = (address?: string | null) => {
  if (!address) return '';
  const match = address.match(/PIN:\s*(\d{4,10})/i);
  return match ? match[1] : '';
};

const stripPinFromAddress = (address?: string | null) => {
  if (!address) return '';
  return address.replace(/,?\s*PIN:\s*\d{4,10}/i, '').trim();
};

const resolveMediaUrl = (url?: string | null) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
  const backendOrigin = apiBase.replace(/\/api\/?$/, '');
  return `${backendOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface ApiErrorPayload {
  error?: string;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return axiosError?.response?.data?.error || fallback;
};

const Profile: React.FC = () => {
  const { state, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: state.user?.first_name || '',
    last_name: state.user?.last_name || '',
    organization_name: state.user?.organization_name || '',
    phone_number: state.user?.phone_number || '',
    address: stripPinFromAddress(state.user?.address || ''),
    odisha_pincode: extractPinFromAddress(state.user?.address || ''),
    latitude: state.user?.latitude != null ? String(state.user.latitude) : '',
    longitude: state.user?.longitude != null ? String(state.user.longitude) : '',
  });
  const [selectedOdishaLocationKey, setSelectedOdishaLocationKey] = useState(
    findOdishaLocationByCoordinates(state.user?.latitude, state.user?.longitude)?.key || ''
  );
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userInitials = useMemo(() => {
    const first = state.user?.first_name?.[0] || '';
    const last = state.user?.last_name?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'U';
  }, [state.user?.first_name, state.user?.last_name]);

  const profileImageUrl = useMemo(
    () => resolveMediaUrl(state.user?.profile_image || null),
    [state.user?.profile_image]
  );

  const profileCompleteness = useMemo(() => {
    const fields = [
      state.user?.first_name,
      state.user?.last_name,
      state.user?.email,
      state.user?.phone_number,
      state.user?.address,
      state.user?.organization_name,
      state.user?.latitude,
      state.user?.longitude,
      state.user?.profile_image,
    ];
    const completed = fields.filter((field) => field !== null && field !== undefined && String(field).trim() !== '').length;
    return Math.round((completed / fields.length) * 100);
  }, [state.user]);

  const profileHighlights = useMemo(() => ([
    {
      label: 'Profile Completion',
      value: `${profileCompleteness}%`,
      detail: 'Improve matching and pickup coordination with a more complete profile.',
      tone: 'from-primary-500 to-secondary-500',
    },
    {
      label: 'Location Coverage',
      value: state.user?.latitude != null && state.user?.longitude != null ? 'Mapped' : 'Pending',
      detail: state.user?.latitude != null && state.user?.longitude != null ? 'Coordinates are available for smarter routing.' : 'Add coordinates or Odisha location for better AI recommendations.',
      tone: 'from-emerald-500 to-primary-500',
    },
    {
      label: 'Account Role',
      value: state.user?.role || 'User',
      detail: 'Role-specific features and dashboards are active for this profile.',
      tone: 'from-violet-500 to-fuchsia-500',
    },
  ]), [profileCompleteness, state.user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setMessage(null);
    setError(null);
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setMessage(null);
    setError(null);

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be up to 5MB.');
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setSelectedImageFile(file);
    setProfileImagePreview(localPreviewUrl);
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setMessage(null);
    setError(null);

    try {
      const submissionData = {
        ...formData,
        address: formData.odisha_pincode
          ? `${stripPinFromAddress(formData.address)}, PIN: ${formData.odisha_pincode}`
          : stripPinFromAddress(formData.address),
        latitude: formData.latitude ? Number(formData.latitude) : null,
        longitude: formData.longitude ? Number(formData.longitude) : null,
      };

      const response = await authAPI.updateProfile(submissionData);
      updateUser(response.data);
      setIsEditing(false);
      setMessage('Profile updated successfully.');
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Failed to update profile.'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleOdishaLocationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const key = event.target.value;
    setSelectedOdishaLocationKey(key);
    setMessage(null);
    setError(null);

    const selectedLocation = ODISHA_LOCATIONS.find((location) => location.key === key);
    if (!selectedLocation) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      address: `${selectedLocation.area}, ${selectedLocation.district}, Odisha`,
      latitude: String(selectedLocation.latitude),
      longitude: String(selectedLocation.longitude),
    }));
  };

  const handleImageUpload = async () => {
    if (!selectedImageFile) return;

    setIsUploadingImage(true);
    setMessage(null);
    setError(null);
    try {
      const uploadData = new FormData();
      uploadData.append('profile_image', selectedImageFile);

      const uploadResponse = await authAPI.uploadProfileImage(uploadData);
      updateUser({ profile_image: uploadResponse.data.profile_image });
      setSelectedImageFile(null);
      setProfileImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage('Profile photo uploaded successfully.');
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Failed to upload profile photo.'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemovePhoto = async () => {
    setShowRemoveConfirm(false);
    setIsUploadingImage(true);
    setMessage(null);
    setError(null);

    try {
      const response = await authAPI.removeProfileImage();
      const profileImage = typeof response.data?.profile_image === 'string' ? response.data.profile_image : undefined;
      updateUser({ profile_image: profileImage });
      setSelectedImageFile(null);
      setProfileImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessage(response.data?.message || 'Profile photo removed successfully.');
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Failed to remove profile photo.'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 shadow-[0_30px_85px_-44px_rgba(15,23,42,0.82)] md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.24),_transparent_36%),radial-gradient(circle_at_82%_16%,_rgba(249,115,22,0.2),_transparent_28%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(15,118,110,0.88))]" />
        <div className="absolute inset-0 bg-grid-mask opacity-20" />
        <div className="absolute -top-12 -right-12 h-56 w-56 rounded-full bg-white/10 blur-2xl animate-float-slow pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 h-40 w-40 rounded-full bg-black/10 blur-2xl animate-float-medium pointer-events-none" />

        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="flex flex-col sm:flex-row items-center gap-6">
          <div
            className="w-24 h-24 rounded-2xl border-4 border-white/40 overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0 cursor-pointer shadow-xl hover:scale-105 transition-transform duration-300"
            onClick={handleImageClick}
            title="Click to change photo"
          >
            {profileImagePreview ? (
              <img src={profileImagePreview} alt="Preview" className="w-full h-full object-cover" />
            ) : profileImageUrl ? (
              <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-extrabold text-white">{userInitials}</span>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />

          <div className="text-center sm:text-left flex-1">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              {state.user?.full_name || 'FoodSave User'}
            </h1>
            <p className="text-primary-100/80 text-sm mt-1">{state.user?.email}</p>
            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 border border-white/30 text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                {state.user?.role}
              </span>
              {selectedImageFile && (
                <button
                  onClick={handleImageUpload}
                  disabled={isUploadingImage}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white text-primary-700 hover:bg-primary-50 transition disabled:opacity-60"
                >
                  {isUploadingImage ? 'Uploading…' : '📤 Upload Photo'}
                </button>
              )}
              {!selectedImageFile && (
                <button
                  onClick={handleImageClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 border border-white/30 text-white hover:bg-white/30 transition"
                >
                  📷 Change Photo
                </button>
              )}
            </div>
          </div>
        </div>

          <div className="rounded-[1.8rem] border border-white/12 bg-white/10 p-5 text-white backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">Profile signal</p>
            <h2 className="mt-2 text-2xl font-bold">Completion score</h2>
            <div className="mt-5 h-3 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-primary-300 via-secondary-300 to-emerald-300" style={{ width: `${profileCompleteness}%` }} />
            </div>
            <p className="mt-3 text-3xl font-black">{profileCompleteness}%</p>
            <p className="mt-2 text-sm leading-6 text-white/70">A stronger profile improves matching quality, routing precision and visibility across the FoodSave network.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {profileHighlights.map((item) => (
          <div key={item.label} className="rounded-[1.6rem] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.22)]">
            <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${item.tone}`} />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
            <p className="mt-3 text-2xl font-black text-slate-900">{item.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

      {(message || error) && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border text-sm ${
          error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-primary-50 border-primary-200 text-primary-700'
        }`}>
          <span>{error ? '⚠️' : '✅'}</span>
          <span>{error || message}</span>
        </div>
      )}

      <div className="bg-white rounded-[1.8rem] border border-slate-200 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.24)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-transparent" />
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-[0.28em]">Profile Details</h2>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-300 hover:-translate-y-0.5 ${
              isEditing
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'bg-primary-600 hover:bg-primary-700 text-white shadow'
            }`}
          >
            {isEditing ? '✕ Cancel' : '✏️ Edit Profile'}
          </button>
        </div>

        <div className="p-6 md:p-8">
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.22em]">Profile Photo</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleImageClick}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition"
                  >
                    📷 Change Photo
                  </button>
                  <button
                    type="button"
                    onClick={handleImageUpload}
                    disabled={isUploadingImage || !selectedImageFile}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                  >
                    {isUploadingImage ? 'Working…' : '📤 Upload New Photo'}
                  </button>
                  {showRemoveConfirm ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-xs font-semibold text-rose-700">Remove photo?</span>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={isUploadingImage}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-500 bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
                      >
                        {isUploadingImage ? 'Removing…' : 'Yes, Remove'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRemoveConfirm(false)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowRemoveConfirm(true)}
                      disabled={isUploadingImage || (!state.user?.profile_image && !profileImagePreview)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                    >
                      🗑 Remove Photo
                    </button>
                  )}
                  {selectedImageFile ? (
                    <span className="text-xs text-slate-500">Selected: {selectedImageFile.name}</span>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="first_name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">First Name</label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Last Name</label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="organization_name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Organization Name</label>
                <input
                  type="text"
                  id="organization_name"
                  name="organization_name"
                  value={formData.organization_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
                />
              </div>
              <div>
                <label htmlFor="phone_number" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  id="phone_number"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
                />
              </div>
              <div>
                <label htmlFor="address" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Address</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm resize-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="odisha_location" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Odisha Location</label>
                  <select
                    id="odisha_location"
                    value={selectedOdishaLocationKey}
                    onChange={handleOdishaLocationChange}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
                  >
                    <option value="">Select district / area</option>
                    {ODISHA_LOCATIONS.map((location) => (
                      <option key={location.key} value={location.key}>
                        {location.district} - {location.area}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="odisha_pin" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Pincode</label>
                  <input
                    type="text"
                    id="odisha_pin"
                    name="odisha_pincode"
                    value={formData.odisha_pincode}
                    onChange={handleInputChange}
                    placeholder="Enter your pincode"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="latitude" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Latitude</label>
                  <input
                    type="number"
                    id="latitude"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleInputChange}
                    step="any"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="longitude" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Longitude</label>
                  <input
                    type="number"
                    id="longitude"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleInputChange}
                    step="any"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold py-2.5 px-6 rounded-xl shadow transition-all duration-300 hover:-translate-y-0.5 text-sm"
                >
                  {isSavingProfile ? 'Saving…' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: 'Full Name', value: state.user?.full_name },
                { label: 'Email Address', value: state.user?.email },
                { label: 'Role', value: state.user?.role },
                { label: 'Organization', value: state.user?.organization_name },
                { label: 'Phone Number', value: state.user?.phone_number },
                { label: 'Address', value: state.user?.address },
                {
                  label: 'Coordinates',
                  value:
                    state.user?.latitude != null && state.user?.longitude != null
                      ? `${state.user.latitude}, ${state.user.longitude}`
                      : '',
                },
              ].map((field) => (
                <div key={field.label} className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-[0.22em]">{field.label}</span>
                  <p className="text-sm font-medium text-slate-900 mt-2 rounded-xl bg-white px-3 py-3 border border-slate-100 group-hover:border-primary-200 transition-colors duration-200">
                    {field.value || <span className="text-gray-400 italic">Not set</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
