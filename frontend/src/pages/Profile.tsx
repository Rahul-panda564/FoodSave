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
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 sm:p-8 shadow-2xl">
        <div className="absolute inset-0 bg-grid-mask opacity-10 pointer-events-none" />
        <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-teal-400/15 blur-3xl pointer-events-none" />

        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div
              className="w-20 h-20 rounded-2xl border-2 border-white/30 overflow-hidden bg-white/15 flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-105 transition-transform duration-300"
              onClick={handleImageClick}
              title="Click to change photo"
            >
              {profileImagePreview ? (
                <img src={profileImagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : profileImageUrl ? (
                <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-white">{userInitials}</span>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />

            <div className="text-center sm:text-left flex-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {state.user?.full_name || 'FoodSave User'}
              </h1>
              <p className="text-white/50 text-sm mt-1">{state.user?.email}</p>
              <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 border border-white/20 text-white/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {state.user?.role}
                </span>
                {selectedImageFile ? (
                  <button onClick={handleImageUpload} disabled={isUploadingImage} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white text-gray-800 hover:bg-gray-100 transition disabled:opacity-60">
                    {isUploadingImage ? 'Uploading…' : '📤 Upload'}
                  </button>
                ) : (
                  <button onClick={handleImageClick} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/15 text-white/70 hover:bg-white/20 transition">
                    📷 Change Photo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/8 p-5 text-white backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Profile Completion</p>
            <div className="mt-3 h-2 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500" style={{ width: `${profileCompleteness}%` }} />
            </div>
            <p className="mt-2 text-3xl font-bold">{profileCompleteness}%</p>
            <p className="mt-1 text-xs leading-5 text-white/50">Complete your profile for better AI matching and routing precision.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {profileHighlights.map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className={`h-1 w-full rounded-full bg-gradient-to-r ${item.tone} mb-3`} />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{item.label}</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{item.value}</p>
            <p className="mt-1 text-xs leading-5 text-gray-400">{item.detail}</p>
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Profile Details</h2>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all ${
              isEditing
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
            }`}
          >
            {isEditing ? '✕ Cancel' : '✏️ Edit Profile'}
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Profile Photo</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={handleImageClick} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">
                    📷 Change
                  </button>
                  <button type="button" onClick={handleImageUpload} disabled={isUploadingImage || !selectedImageFile} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50">
                    {isUploadingImage ? 'Working…' : '📤 Upload'}
                  </button>
                  {showRemoveConfirm ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-xs text-rose-600">Remove?</span>
                      <button type="button" onClick={handleRemovePhoto} disabled={isUploadingImage} className="rounded-lg border border-rose-400 bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 transition disabled:opacity-50">
                        {isUploadingImage ? 'Removing…' : 'Yes'}
                      </button>
                      <button type="button" onClick={() => setShowRemoveConfirm(false)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition">
                        No
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setShowRemoveConfirm(true)} disabled={isUploadingImage || (!state.user?.profile_image && !profileImagePreview)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition disabled:opacity-50">
                      🗑 Remove
                    </button>
                  )}
                  {selectedImageFile && <span className="text-xs text-gray-400">{selectedImageFile.name}</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">First Name</label>
                  <input type="text" id="first_name" name="first_name" value={formData.first_name} onChange={handleInputChange} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm" />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Last Name</label>
                  <input type="text" id="last_name" name="last_name" value={formData.last_name} onChange={handleInputChange} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm" />
                </div>
              </div>
              <div>
                <label htmlFor="organization_name" className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Organization Name</label>
                <input type="text" id="organization_name" name="organization_name" value={formData.organization_name} onChange={handleInputChange} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm" />
              </div>
              <div>
                <label htmlFor="phone_number" className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Phone Number</label>
                <input type="tel" id="phone_number" name="phone_number" value={formData.phone_number} onChange={handleInputChange} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm" />
              </div>
              <div>
                <label htmlFor="address" className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Address</label>
                <textarea id="address" name="address" value={formData.address} onChange={handleInputChange} rows={3} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="odisha_location" className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Odisha Location</label>
                  <select id="odisha_location" value={selectedOdishaLocationKey} onChange={handleOdishaLocationChange} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm">
                    <option value="">Select district / area</option>
                    {ODISHA_LOCATIONS.map((location) => (
                      <option key={location.key} value={location.key}>{location.district} - {location.area}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="odisha_pin" className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Pincode</label>
                  <input type="text" id="odisha_pin" name="odisha_pincode" value={formData.odisha_pincode} onChange={handleInputChange} placeholder="Enter your pincode" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="latitude" className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Latitude</label>
                  <input type="number" id="latitude" name="latitude" value={formData.latitude} onChange={handleInputChange} step="any" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm" />
                </div>
                <div>
                  <label htmlFor="longitude" className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Longitude</label>
                  <input type="number" id="longitude" name="longitude" value={formData.longitude} onChange={handleInputChange} step="any" className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm" />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={isSavingProfile} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2.5 px-6 rounded-xl shadow-sm transition text-sm">
                  {isSavingProfile ? 'Saving…' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div key={field.label} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5 hover:bg-gray-50 transition-colors">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{field.label}</span>
                  <p className="text-sm font-medium text-gray-800 mt-1.5">
                    {field.value || <span className="text-gray-300 italic">Not set</span>}
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
