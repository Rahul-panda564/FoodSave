import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

type PrimitiveParam = string | number | boolean;
type QueryParams = Record<string, PrimitiveParam | null | undefined>;
type ApiPayload = Record<string, unknown>;

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const setAuthorizationHeader = (
  headers: InternalAxiosRequestConfig['headers'],
  token: string,
) => {
  if (!headers) return;

  if (headers instanceof AxiosHeaders) {
    headers.set('Authorization', `Bearer ${token}`);
    return;
  }

  (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      setAuthorizationHeader(config.headers, token);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const axiosError = error as AxiosError;
    const originalRequest = axiosError.config as RetryableRequestConfig | undefined;

    if (axiosError.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);

          // Retry the original request with new token
          setAuthorizationHeader(originalRequest.headers, access);
          return api(originalRequest);
        }
      } catch (refreshError: unknown) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/home';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData: ApiPayload) => api.post('/auth/register/', userData),
  login: (credentials: ApiPayload) => api.post('/auth/login/', credentials),
  googleAuth: (payload: ApiPayload) => api.post('/auth/google/auth/', payload),
  sendPhoneOtp: (phone_number: string, purpose: 'LOGIN' | 'REGISTER' = 'REGISTER') => api.post('/auth/phone/send-otp/', { phone_number, purpose }),
  verifyPhoneOtp: (phone_number: string, otp: string) => api.post('/auth/phone/verify-otp/', { phone_number, otp }),
  registerWithPhone: (payload: ApiPayload) => api.post('/auth/phone/register/', payload),
  loginWithPhone: (phone_number: string, otp: string) => api.post('/auth/phone/login/', { phone_number, otp }),
  // Compatibility aliases mapped to existing backend endpoints
  firebaseLogin: (payload: ApiPayload) => api.post('/auth/login/', payload),
  firebaseRegister: (userData: ApiPayload) => api.post('/auth/register/', userData),
  firebaseLoginGoogle: (payload: ApiPayload) => api.post('/auth/google/auth/', payload),
  firebaseRegisterGoogle: (userData: ApiPayload) => api.post('/auth/google/auth/', userData),
  firebaseLoginPhone: (payload: ApiPayload) => api.post('/auth/phone/login/', payload),
  firebaseRegisterPhone: (userData: ApiPayload) => api.post('/auth/phone/register/', userData),
  logout: (refreshToken: string) => api.post('/auth/logout/', { refresh: refreshToken }),
  getProfile: () => api.get('/auth/profile/'),
  updateProfile: (userData: ApiPayload) => api.put('/auth/profile/', userData),
  uploadProfileImage: (formData: FormData) => api.post('/auth/upload-profile-image/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  removeProfileImage: () => api.delete('/auth/upload-profile-image/'),
  changePassword: (passwordData: ApiPayload) => api.post('/auth/change-password/', passwordData),
  getUserStats: () => api.get('/auth/stats/'),
  getLeaderboard: () => api.get('/auth/leaderboard/'),
  awardTopLeaderboard: (award_date?: string) => api.post('/auth/leaderboard/award-top/', award_date ? { award_date } : {}),
  getPrizes: () => api.get('/auth/prizes/'),
  redeemPrize: (prize_id: number) => api.post('/auth/prizes/redeem/', { prize_id }),
};

// Donations API
export const donationsAPI = {
  getCategories: () => api.get('/donations/categories/'),
  getDonations: (params?: QueryParams) => api.get('/donations/', { params }),
  getDonation: (id: number) => api.get(`/donations/${id}/`),
  createDonation: (donationData: ApiPayload) => api.post('/donations/', donationData),
  updateDonation: (id: number, donationData: ApiPayload) => api.put(`/donations/${id}/`, donationData),
  deleteDonation: (id: number) => api.delete(`/donations/${id}/`),
  getMyDonations: () => api.get('/donations/my-donations/'),
  getNearbyDonations: (params: QueryParams) => api.get('/donations/nearby/', { params }),
  uploadDonationImage: (formData: FormData) => api.post('/donations/upload-image/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
};

// Pickup Requests API
export const pickupAPI = {
  getPickups: (params?: QueryParams) => api.get('/donations/pickups/', { params }),
  getPickup: (id: number) => api.get(`/donations/pickups/${id}/`),
  createPickup: (pickupData: ApiPayload) => api.post('/donations/pickups/', pickupData),
  updatePickup: (id: number, pickupData: ApiPayload) => api.put(`/donations/pickups/${id}/`, pickupData),
  decidePickup: (id: number, decision: 'ACCEPT' | 'DECLINE') => api.post(`/donations/pickups/${id}/decision/`, { decision }),
  getVolunteerPickups: (params: QueryParams) => api.get('/donations/pickups/volunteer/', { params }),
};

// Analytics API
export const analyticsAPI = {
  getDashboardStats: () => api.get('/analytics/dashboard/'),
  getDailyAnalytics: (params?: QueryParams) => api.get('/analytics/daily/', { params }),
  getDonationChartData: (params?: QueryParams) => api.get('/analytics/charts/donations/', { params }),
  getTopDonors: (params?: QueryParams) => api.get('/analytics/top-donors/', { params }),
  getTopNGOs: (params?: QueryParams) => api.get('/analytics/top-ngos/', { params }),
  getFoodWasteImpact: () => api.get('/analytics/food-waste-impact/'),
  getUserActivities: (params?: QueryParams) => api.get('/analytics/activities/', { params }),
  calculateAnalytics: (date?: string) => api.post('/analytics/calculate/', { date }),
  predictFoodSafety: (payload: ApiPayload) => api.post('/analytics/algorithms/food-safety/', payload),
  nearestNgoMatch: (payload: ApiPayload) => api.post('/analytics/algorithms/nearest-ngo/', payload),
  donationPriorityQueue: (params?: QueryParams) => api.get('/analytics/algorithms/priority-donations/', { params }),
  recommendNgos: (payload: ApiPayload) => api.post('/analytics/algorithms/recommend-ngos/', payload),
  triggerDonationNotifications: (payload: ApiPayload) => api.post('/analytics/algorithms/trigger-notifications/', payload),
  submitFeedback: (payload: ApiPayload) => api.post('/analytics/feedback/', payload),
  getFeedbackList: (params?: QueryParams) => api.get('/analytics/feedback/list/', { params }),
};

export default api;
