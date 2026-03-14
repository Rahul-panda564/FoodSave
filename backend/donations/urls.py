from django.urls import path
from .views import (
    FoodCategoryListView, DonationListView, DonationDetailView,
    MyDonationsView, nearby_donations, PickupRequestListView,
    PickupRequestDetailView, volunteer_pickups, DonationImageUploadView,
    PickupVolunteerDecisionView
)

urlpatterns = [
    # Food Categories
    path('categories/', FoodCategoryListView.as_view(), name='food-categories'),
    
    # Donations
    path('', DonationListView.as_view(), name='donation-list'),
    path('upload-image/', DonationImageUploadView.as_view(), name='donation-upload-image'),
    path('<int:pk>/', DonationDetailView.as_view(), name='donation-detail'),
    path('my-donations/', MyDonationsView.as_view(), name='my-donations'),
    path('nearby/', nearby_donations, name='nearby-donations'),
    
    # Pickup Requests
    path('pickups/', PickupRequestListView.as_view(), name='pickup-list'),
    path('pickups/<int:pk>/', PickupRequestDetailView.as_view(), name='pickup-detail'),
    path('pickups/<int:pk>/decision/', PickupVolunteerDecisionView.as_view(), name='pickup-volunteer-decision'),
    path('pickups/volunteer/', volunteer_pickups, name='volunteer-pickups'),
]
