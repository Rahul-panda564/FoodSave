
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from django.core.files.storage import default_storage
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.food_predict import predict_food



@api_view(['POST'])
def login_api(request):
    return Response({"message": "login API working"})



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def protected_api(request):
    return Response({
        "message": "You are authenticated",
        "user": request.user.email if request.user.is_authenticated else "Anonymous"
    })


