import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Donations from './pages/Donations';
import DonationDetail from './pages/DonationDetail';
import MyDonations from './pages/MyDonations';
import CreateDonation from './pages/CreateDonation';
import TestDonation from './pages/TestDonation';
import TestLogin from './pages/TestLogin';
import Pickups from './pages/Pickups';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import AITools from './pages/AITools';
import Feedbacks from './pages/Feedbacks';
import AdminDonations from './pages/AdminDonations';
import AdminPickups from './pages/AdminPickups';
import Notifications from './pages/Notifications';
import Leaderboard from './pages/Leaderboard';
import './App.css';

function App() {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <Layout>
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/admin-dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
                      <Route path="/donations" element={<Donations />} />
                      <Route path="/donations/:id" element={<DonationDetail />} />
                      <Route path="/my-donations" element={<MyDonations />} />
                      <Route path="/create-donation" element={<CreateDonation />} />
                      {isDevelopment ? <Route path="/test-donation" element={<TestDonation />} /> : null}
                      {isDevelopment ? <Route path="/test-login" element={<TestLogin />} /> : null}
                      <Route path="/pickups" element={<Pickups />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/leaderboard" element={<Leaderboard />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
                      <Route path="/feedback" element={<AdminRoute><Feedbacks /></AdminRoute>} />
                      <Route path="/admin-donations" element={<AdminRoute><AdminDonations /></AdminRoute>} />
                      <Route path="/admin-pickups" element={<AdminRoute><AdminPickups /></AdminRoute>} />
                      <Route path="/ai-tools" element={<AITools />} />
                    </Routes>
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
