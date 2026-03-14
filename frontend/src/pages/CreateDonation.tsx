import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { donationsAPI } from '../services/api';
import { ODISHA_LOCATIONS } from '../data/odishaLocations';

interface FoodCategory {
  id: number;
  name: string;
  description: string;
}

interface DonationFormData {
  food_name: string;
  category: string;
  quantity: string;
  unit: string;
  description: string;
  cooked_time: string;
  expiry_time: string;
  storage_condition: string;
  pickup_address: string;
  pickup_pincode: string;
  pickup_latitude: string;
  pickup_longitude: string;
  image: string;
}

type ApiError = {
  response?: {
    data?: {
      detail?: string;
    };
  };
};

const getErrorDetail = (error: unknown, fallback: string): string => {
  const detail = (error as ApiError)?.response?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail : fallback;
};

const CreateDonation: React.FC = () => {
  const { state } = useAuth();
  const navigate = useNavigate();
  const userRole = (state.user?.role || '').toUpperCase();
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedOdishaLocationKey, setSelectedOdishaLocationKey] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  const [formData, setFormData] = useState<DonationFormData>({
    food_name: '',
    category: '',
    quantity: '',
    unit: 'kg',
    description: '',
    cooked_time: '',
    expiry_time: '',
    storage_condition: 'AMBIENT',
    pickup_address: '',
    pickup_pincode: '',
    pickup_latitude: '',
    pickup_longitude: '',
    image: '',
  });

  useEffect(() => {
    if (state.user && userRole !== 'DONOR') {
      navigate('/dashboard');
      return;
    }
    fetchCategories();
  }, [navigate, state.user, userRole]);

  const fetchCategories = async () => {
    try {
      const response = await donationsAPI.getCategories();
      setCategories(response.data);
      if (response.data.length > 0) {
        setFormData(prev => ({ ...prev, category: response.data[0].id.toString() }));
      }
    } catch (error: unknown) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleOdishaLocationChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const key = event.target.value;
    setSelectedOdishaLocationKey(key);

    const selectedLocation = ODISHA_LOCATIONS.find((location) => location.key === key);
    if (!selectedLocation) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      pickup_latitude: String(selectedLocation.latitude),
      pickup_longitude: String(selectedLocation.longitude),
      pickup_address: `${selectedLocation.area}, ${selectedLocation.district}, Odisha`,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      let imageUrl = formData.image;
      if (selectedImageFile) {
        setIsUploadingImage(true);
        const imageFormData = new FormData();
        imageFormData.append('image', selectedImageFile);
        const uploadResponse = await donationsAPI.uploadDonationImage(imageFormData);
        imageUrl = uploadResponse.data?.image_url || uploadResponse.data?.image || '';
      }

      const submissionData = {
        ...formData,
        quantity: parseFloat(formData.quantity),
        category: parseInt(formData.category),
        image: imageUrl || null,
        pickup_address: formData.pickup_pincode
          ? `${formData.pickup_address}, PIN: ${formData.pickup_pincode}`
          : formData.pickup_address,
        cooked_time: formData.cooked_time ? new Date(formData.cooked_time).toISOString() : null,
        expiry_time: new Date(formData.expiry_time).toISOString(),
        pickup_latitude: formData.pickup_latitude ? parseFloat(formData.pickup_latitude) : null,
        pickup_longitude: formData.pickup_longitude ? parseFloat(formData.pickup_longitude) : null,
      };

      await donationsAPI.createDonation(submissionData);
      setSuccess('Donation created successfully!');
      
      setTimeout(() => {
        navigate('/my-donations');
      }, 2000);
      
    } catch (error: unknown) {
      setError(getErrorDetail(error, 'Failed to create donation. Please try again.'));
    } finally {
      setIsUploadingImage(false);
      setIsLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedImageFile(file);
    if (!file) {
      setImagePreviewUrl('');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setImagePreviewUrl(objectUrl);
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const inputCls = 'ui-input mt-1';
  const sectionCardCls = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6';

  return (
    <div className="max-w-4xl mx-auto space-y-7 pb-10">
      <div className="relative overflow-hidden rounded-3xl shadow-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-secondary-500 p-7 md:p-10">
        <div className="absolute inset-0 bg-grid-mask opacity-15" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl animate-float-slow" />
        <div className="absolute bottom-0 left-1/4 w-36 h-36 bg-black/10 rounded-full blur-2xl animate-float-medium" />
        <div className="relative text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-white/20 text-white border-white/30 backdrop-blur-sm">
            🍲 Donor Zone
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-3">Create New Donation</h1>
          <p className="text-primary-100/85 mt-2 max-w-xl mx-auto">Share surplus food with nearby communities using complete details for faster pickup and safer distribution.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 mt-0">
          <div className={`${sectionCardCls} space-y-3 pt-4 sm:pt-5`}>
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-0">Basic Information</h3>

            <div>
              <label htmlFor="food_image" className="block text-sm font-medium text-gray-700">
                Food Photo
              </label>
              <input
                type="file"
                id="food_image"
                accept="image/*"
                onChange={handleImageChange}
                className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:px-3 file:py-2 file:font-medium hover:file:bg-primary-100"
              />
              {imagePreviewUrl && (
                <div className="mt-3">
                  <img src={imagePreviewUrl} alt="Food preview" className="h-40 w-full object-cover rounded-xl border border-gray-200" />
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">AI uses this photo and timing data to estimate food safety.</p>
            </div>
            
            <div>
              <label htmlFor="food_name" className="block text-sm font-medium text-gray-700">
                Food Name *
              </label>
              <input
                type="text"
                id="food_name"
                name="food_name"
                required
                className={inputCls}
                placeholder="e.g., Fresh Vegetables, Cooked Rice"
                value={formData.food_name}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                  Food Category *
                </label>
                <select
                  id="category"
                  name="category"
                  required
                  className={inputCls}
                  value={formData.category}
                  onChange={handleChange}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="unit" className="block text-sm font-medium text-gray-700">
                  Unit *
                </label>
                <select
                  id="unit"
                  name="unit"
                  required
                  className={inputCls}
                  value={formData.unit}
                  onChange={handleChange}
                >
                  <option value="kg">Kilograms (kg)</option>
                  <option value="liters">Liters (L)</option>
                  <option value="pieces">Pieces</option>
                  <option value="boxes">Boxes</option>
                  <option value="bags">Bags</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
                Quantity *
              </label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                required
                step="0.01"
                min="0.01"
                className={inputCls}
                placeholder="e.g., 5.5"
                value={formData.quantity}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className={inputCls}
                placeholder="Additional details about food (condition, packaging, etc.)"
                value={formData.description}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className={`${sectionCardCls} space-y-4`}>
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Time Information</h3>
            
            <div>
              <label htmlFor="cooked_time" className="block text-sm font-medium text-gray-700">
                Cooked/Prepared Time
              </label>
              <input
                type="datetime-local"
                id="cooked_time"
                name="cooked_time"
                className={inputCls}
                max={getCurrentDateTime()}
                value={formData.cooked_time}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="expiry_time" className="block text-sm font-medium text-gray-700">
                Expiry Time *
              </label>
              <input
                type="datetime-local"
                id="expiry_time"
                name="expiry_time"
                required
                className={inputCls}
                min={getCurrentDateTime()}
                value={formData.expiry_time}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="storage_condition" className="block text-sm font-medium text-gray-700">
                Storage Condition *
              </label>
              <select
                id="storage_condition"
                name="storage_condition"
                required
                className={inputCls}
                value={formData.storage_condition}
                onChange={handleChange}
              >
                <option value="AMBIENT">Ambient (Room Temperature)</option>
                <option value="REFRIGERATED">Refrigerated</option>
                <option value="FROZEN">Frozen</option>
                <option value="HOT">Hot</option>
              </select>
            </div>
          </div>

          <div className={`${sectionCardCls} space-y-4`}>
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Pickup Location</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="odisha_location" className="block text-sm font-medium text-gray-700">
                  Odisha Location *
                </label>
                <select
                  id="odisha_location"
                  value={selectedOdishaLocationKey}
                  onChange={handleOdishaLocationChange}
                  className={inputCls}
                  required
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
                <label htmlFor="pickup_pincode" className="block text-sm font-medium text-gray-700">
                  Pincode *
                </label>
                <input
                  type="text"
                  id="pickup_pincode"
                  name="pickup_pincode"
                  required
                  value={formData.pickup_pincode}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="Enter your exact pincode"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="pickup_address" className="block text-sm font-medium text-gray-700">
                Pickup Address *
              </label>
              <textarea
                id="pickup_address"
                name="pickup_address"
                required
                rows={2}
                className={inputCls}
                placeholder="Full address where food can be picked up"
                value={formData.pickup_address}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="pickup_latitude" className="block text-sm font-medium text-gray-700">
                  Latitude (Optional)
                </label>
                <input
                  type="number"
                  id="pickup_latitude"
                  name="pickup_latitude"
                  step="any"
                  className={inputCls}
                  placeholder="e.g., 40.7128"
                  value={formData.pickup_latitude}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="pickup_longitude" className="block text-sm font-medium text-gray-700">
                  Longitude (Optional)
                </label>
                <input
                  type="number"
                  id="pickup_longitude"
                  name="pickup_longitude"
                  step="any"
                  className={inputCls}
                  placeholder="e.g., -74.0060"
                  value={formData.pickup_longitude}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => navigate('/my-donations')}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                isUploadingImage ? 'Uploading photo...' : 'Create Donation'
              )}
            </button>
          </div>
      </form>
    </div>
  );
};

export default CreateDonation;
