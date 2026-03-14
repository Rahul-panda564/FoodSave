from django.urls import path
from .views import (
    DashboardStatsView, DailyAnalyticsListView, UserActivityListView, FeedbackCreateView, FeedbackListView,
    donation_chart_data, top_donors, top_ngos, food_waste_impact,
    calculate_analytics, food_safety_prediction, nearest_ngo_match,
    donation_priority_queue, ngo_recommendations, trigger_donation_notifications
)

urlpatterns = [
    # Dashboard and Stats
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('daily/', DailyAnalyticsListView.as_view(), name='daily-analytics'),
    path('activities/', UserActivityListView.as_view(), name='user-activities'),
    path('feedback/', FeedbackCreateView.as_view(), name='feedback-create'),
    path('feedback/list/', FeedbackListView.as_view(), name='feedback-list'),
    
    # Chart Data
    path('charts/donations/', donation_chart_data, name='donation-chart-data'),
    
    # Rankings and Impact
    path('top-donors/', top_donors, name='top-donors'),
    path('top-ngos/', top_ngos, name='top-ngos'),
    path('food-waste-impact/', food_waste_impact, name='food-waste-impact'),

    # Algorithm APIs
    path('algorithms/food-safety/', food_safety_prediction, name='food-safety-prediction'),
    path('algorithms/nearest-ngo/', nearest_ngo_match, name='nearest-ngo-match'),
    path('algorithms/priority-donations/', donation_priority_queue, name='donation-priority-queue'),
    path('algorithms/recommend-ngos/', ngo_recommendations, name='ngo-recommendations'),
    path('algorithms/trigger-notifications/', trigger_donation_notifications, name='trigger-donation-notifications'),
    
    # Admin Functions
    path('calculate/', calculate_analytics, name='calculate-analytics'),
]
