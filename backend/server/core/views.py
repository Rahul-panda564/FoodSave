from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


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