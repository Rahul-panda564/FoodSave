import heapq
from datetime import datetime
from math import radians, cos, sin, asin, sqrt
from typing import List, Dict, Any
from pathlib import Path

from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone
from PIL import Image, ImageStat
import numpy as np

from donations.models import Donation, PickupRequest

User = get_user_model()


def _ensure_aware(value: datetime) -> datetime:
    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())
    return value


def estimate_eta_minutes(distance_km: float, average_speed_kmh: float = 28.0) -> int:
    if distance_km <= 0:
        return 5
    return max(5, round((distance_km / average_speed_kmh) * 60))


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    a = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lon / 2) ** 2
    c = 2 * asin(sqrt(a))
    return 6371 * c


def predict_food_safety(cooked_time: datetime, expiry_time: datetime, storage_condition: str) -> Dict[str, Any]:
    cooked_time = _ensure_aware(cooked_time)
    expiry_time = _ensure_aware(expiry_time)
    now = timezone.now()
    cooked_hours = max((now - cooked_time).total_seconds() / 3600, 0)
    hours_until_expiry = (expiry_time - now).total_seconds() / 3600

    risk_score = 0.0
    risk_factors = []
    if hours_until_expiry <= 0:
        risk_score += 1.0
        risk_factors.append('Expiry time has already passed.')
    elif hours_until_expiry <= 2:
        risk_score += 0.55
        risk_factors.append('Food is within the final 2 hours before expiry.')
    elif hours_until_expiry <= 6:
        risk_score += 0.25
        risk_factors.append('Food is approaching expiry within 6 hours.')

    storage = (storage_condition or "").upper()
    if storage == 'AMBIENT':
        if cooked_hours > 8:
            risk_score += 0.65
            risk_factors.append('Ambient food has been held for more than 8 hours.')
        elif cooked_hours > 4:
            risk_score += 0.35
            risk_factors.append('Ambient food has been held for more than 4 hours.')
    elif storage == 'HOT':
        if cooked_hours > 6:
            risk_score += 0.6
            risk_factors.append('Hot-held food has exceeded the 6 hour safe window.')
        elif cooked_hours > 3:
            risk_score += 0.3
            risk_factors.append('Hot-held food is nearing its recommended serving window.')
    elif storage == 'REFRIGERATED':
        if cooked_hours > 24:
            risk_score += 0.3
            risk_factors.append('Refrigerated food has been stored for more than 24 hours.')
    elif storage == 'FROZEN':
        if cooked_hours > 72:
            risk_score += 0.2
            risk_factors.append('Frozen food has been stored for an extended period.')
    else:
        risk_score += 0.1
        risk_factors.append('Storage condition is unknown, applying a precautionary penalty.')

    storage_profiles = {
        'AMBIENT': {'ideal_hours': 2, 'max_hours': 6},
        'HOT': {'ideal_hours': 3, 'max_hours': 6},
        'REFRIGERATED': {'ideal_hours': 12, 'max_hours': 36},
        'FROZEN': {'ideal_hours': 48, 'max_hours': 168},
    }
    storage_profile = storage_profiles.get(storage)
    if storage_profile:
        if cooked_hours > storage_profile['max_hours']:
            risk_score += 0.15
        freshness_ratio = min(cooked_hours / max(storage_profile['max_hours'], 1), 1)
    else:
        freshness_ratio = min(cooked_hours / 24, 1)

    safety_score = max(0.0, min(1.0, 1.0 - risk_score))
    if safety_score >= 0.7:
        label = 'SAFE'
        risk_level = 'LOW'
        recommended_action = 'Safe to assign for pickup. Prioritize normal dispatch.'
    elif safety_score >= 0.4:
        label = 'EXPIRING_SOON'
        risk_level = 'MEDIUM'
        recommended_action = 'Dispatch quickly and keep the item under controlled storage.'
    else:
        label = 'UNSAFE'
        risk_level = 'HIGH'
        recommended_action = 'Do not dispatch for consumption until manually reviewed.'

    if not risk_factors:
        risk_factors.append('No critical safety risks detected from the supplied timings.')

    return {
        'prediction': label,
        'risk_level': risk_level,
        'safety_score': round(safety_score * 100, 2),
        'freshness_score': round((1 - freshness_ratio) * 100, 2),
        'hours_since_cooked': round(cooked_hours, 2),
        'hours_until_expiry': round(hours_until_expiry, 2),
        'storage_condition': storage,
        'risk_factors': risk_factors,
        'recommended_action': recommended_action,
    }


def _resolve_local_image_path(image_reference: str) -> Path | None:
    if not image_reference:
        return None

    image_reference = image_reference.strip()
    if image_reference.startswith('http://') or image_reference.startswith('https://'):
        return None

    media_url = getattr(settings, 'MEDIA_URL', '/media/') or '/media/'
    media_root = Path(getattr(settings, 'MEDIA_ROOT', '') or '')
    if not media_root:
        return None

    if image_reference.startswith(media_url):
        relative_path = image_reference[len(media_url):].lstrip('/').replace('\\', '/')
        resolved = media_root / relative_path
        return resolved if resolved.exists() else None

    direct_path = Path(image_reference)
    if direct_path.exists():
        return direct_path

    fallback = media_root / image_reference.lstrip('/').replace('\\', '/')
    return fallback if fallback.exists() else None


def _image_quality_risk(image_reference: str) -> Dict[str, Any]:
    result = {
        'image_quality_score': None,
        'image_risk_penalty': 0.0,
        'image_insights': [],
    }

    image_path = _resolve_local_image_path(image_reference)
    if image_path is None:
        result['image_insights'].append('Image not available for local quality analysis.')
        return result

    try:
        with Image.open(image_path) as img:
            rgb_img = img.convert('RGB')
            grayscale = rgb_img.convert('L')
            brightness = ImageStat.Stat(grayscale).mean[0]
            contrast = ImageStat.Stat(grayscale).stddev[0]

            arr = np.array(grayscale, dtype=np.float32)
            gy, gx = np.gradient(arr)
            sharpness = float(np.var(gx) + np.var(gy))

        quality = 100.0
        penalty = 0.0

        if brightness < 40:
            penalty += 0.08
            quality -= 12
            result['image_insights'].append('Image is very dark; visual quality confidence is reduced.')
        elif brightness > 220:
            penalty += 0.05
            quality -= 8
            result['image_insights'].append('Image is overexposed; quality confidence is reduced.')

        if contrast < 20:
            penalty += 0.06
            quality -= 10
            result['image_insights'].append('Image has very low contrast; details are hard to verify.')

        if sharpness < 120:
            penalty += 0.07
            quality -= 14
            result['image_insights'].append('Image appears blurry; food condition is harder to inspect.')

        result['image_quality_score'] = round(max(0.0, min(100.0, quality)), 2)
        result['image_risk_penalty'] = round(penalty, 4)
        if not result['image_insights']:
            result['image_insights'].append('Image quality is acceptable for visual AI assessment.')
        return result
    except Exception:
        result['image_insights'].append('Image could not be processed for AI quality scoring.')
        return result


def predict_food_safety_with_image(
    cooked_time: datetime,
    expiry_time: datetime,
    storage_condition: str,
    image_reference: str = '',
) -> Dict[str, Any]:
    base_result = predict_food_safety(cooked_time, expiry_time, storage_condition)
    image_metrics = _image_quality_risk(image_reference)

    base_safety = float(base_result['safety_score']) / 100.0
    adjusted_safety = max(0.0, min(1.0, base_safety - image_metrics['image_risk_penalty']))
    adjusted_score = round(adjusted_safety * 100, 2)

    if adjusted_score >= 70:
        prediction = 'GOOD'
        recommended_action = 'Looks good. Proceed with normal pickup priority.'
    elif adjusted_score >= 45:
        prediction = 'CAUTION'
        recommended_action = 'Use quickly and prioritize early pickup.'
    else:
        prediction = 'NOT_GOOD'
        recommended_action = 'Avoid distribution until manual review.'

    return {
        **base_result,
        'safety_score': adjusted_score,
        'prediction': prediction,
        'image_quality_score': image_metrics['image_quality_score'],
        'image_insights': image_metrics['image_insights'],
        'risk_factors': list(base_result.get('risk_factors', [])) + image_metrics['image_insights'],
        'recommended_action': recommended_action,
    }


def prioritize_available_donations(limit: int = 20) -> List[Dict[str, Any]]:
    donations = Donation.objects.filter(
        status='AVAILABLE',
        expiry_time__gt=timezone.now()
    ).select_related('donor', 'category')

    min_heap = []
    for donation in donations:
        heapq.heappush(min_heap, (donation.expiry_time, donation.id, donation))

    ordered = []
    while min_heap and len(ordered) < max(limit, 1):
        _, _, donation = heapq.heappop(min_heap)
        hours_until_expiry = round(donation.hours_until_expiry, 2)
        priority_score = max(0, round((24 - min(max(hours_until_expiry, 0), 24)) / 24 * 100))
        if hours_until_expiry <= 2:
            priority_band = 'CRITICAL'
            pickup_recommendation = 'Dispatch immediately.'
        elif hours_until_expiry <= 6:
            priority_band = 'HIGH'
            pickup_recommendation = 'Assign within the next available pickup slot.'
        elif hours_until_expiry <= 12:
            priority_band = 'MEDIUM'
            pickup_recommendation = 'Keep visible in the dispatch queue.'
        else:
            priority_band = 'LOW'
            pickup_recommendation = 'Normal scheduling is acceptable.'

        ordered.append({
            'donation_id': donation.id,
            'food_name': donation.food_name,
            'category': donation.category.name if donation.category else None,
            'expiry_time': donation.expiry_time,
            'hours_until_expiry': hours_until_expiry,
            'pickup_address': donation.pickup_address,
            'status': donation.status,
            'priority_score': priority_score,
            'priority_band': priority_band,
            'pickup_recommendation': pickup_recommendation,
        })

    return ordered


def nearest_ngos(latitude: float, longitude: float, limit: int = 5) -> List[Dict[str, Any]]:
    ngos = User.objects.filter(
        role='NGO',
        latitude__isnull=False,
        longitude__isnull=False,
    )

    scored = []
    for ngo in ngos:
        distance = haversine_distance_km(
            latitude,
            longitude,
            float(ngo.latitude),
            float(ngo.longitude),
        )
        scored.append({
            'ngo_id': ngo.id,
            'name': ngo.full_name,
            'organization_name': ngo.organization_name,
            'email': ngo.email,
            'distance_km': round(distance, 2),
            'eta_minutes': estimate_eta_minutes(distance),
            'match_reason': 'Closest verified NGO to the selected pickup point.',
        })

    scored.sort(key=lambda item: item['distance_km'])
    return scored[:max(limit, 1)]


def recommend_ngos(latitude: float, longitude: float, limit: int = 5) -> List[Dict[str, Any]]:
    ngos = User.objects.filter(
        role='NGO',
        latitude__isnull=False,
        longitude__isnull=False,
    )

    recommendations = []
    for ngo in ngos:
        distance = haversine_distance_km(latitude, longitude, float(ngo.latitude), float(ngo.longitude))
        active_pickups = PickupRequest.objects.filter(
            ngo=ngo,
            status__in=['PENDING', 'ASSIGNED', 'PICKED_UP']
        ).count()

        capacity_score = max(0, 1 - (active_pickups / 20))
        availability_score = 1 if active_pickups < 20 else 0
        distance_score = max(0, 1 - (distance / 25))

        total_score = (
            (distance_score * 0.5)
            + (capacity_score * 0.35)
            + (availability_score * 0.15)
        )

        recommendations.append({
            'ngo_id': ngo.id,
            'name': ngo.full_name,
            'organization_name': ngo.organization_name,
            'email': ngo.email,
            'distance_km': round(distance, 2),
            'eta_minutes': estimate_eta_minutes(distance),
            'active_pickups': active_pickups,
            'available': availability_score == 1,
            'recommendation_score': round(total_score * 100, 2),
            'recommendation_breakdown': {
                'distance_score': round(distance_score * 100, 2),
                'capacity_score': round(capacity_score * 100, 2),
                'availability_score': round(availability_score * 100, 2),
            },
            'reason': 'Balanced for distance, workload, and immediate availability.',
        })

    recommendations.sort(
        key=lambda item: (-item['recommendation_score'], item['distance_km'])
    )
    return recommendations[:max(limit, 1)]
