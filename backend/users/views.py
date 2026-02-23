"""User API views."""
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.conf import settings
from .serializers import UserSerializer, UserRegistrationSerializer, UserPreferencesSerializer
import requests
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class GoogleOAuthView(APIView):
    """Handle Google OAuth — accepts an ID token or authorization code from the frontend
    and returns JWT tokens for the authenticated (or newly created) user."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        credential = request.data.get('credential') or request.data.get('id_token')
        code = request.data.get('code')

        if not credential and not code:
            return Response(
                {'detail': 'Google credential or authorization code is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if credential:
                # Verify Google ID token
                google_user = self._verify_id_token(credential)
            else:
                # Exchange authorization code for tokens, then verify
                google_user = self._exchange_code(code)

            if not google_user:
                return Response(
                    {'detail': 'Invalid Google credentials.'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            email = google_user.get('email', '')
            if not email:
                return Response(
                    {'detail': 'Google account must have an email address.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Find or create user
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': self._generate_username(email, google_user),
                    'first_name': google_user.get('given_name', ''),
                    'last_name': google_user.get('family_name', ''),
                    'avatar_url': google_user.get('picture', ''),
                },
            )

            if not created:
                # Update avatar if not set
                if not user.avatar_url and google_user.get('picture'):
                    user.avatar_url = google_user['picture']
                    user.save(update_fields=['avatar_url'])

            refresh = RefreshToken.for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                },
                'created': created,
            })
        except Exception as e:
            logger.error(f'Google OAuth error: {e}')
            return Response(
                {'detail': 'Google authentication failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def _verify_id_token(self, token: str) -> dict | None:
        """Verify a Google ID token via Google's tokeninfo endpoint."""
        try:
            resp = requests.get(
                'https://oauth2.googleapis.com/tokeninfo',
                params={'id_token': token},
                timeout=10,
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            # Verify audience matches our client ID
            client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
            if client_id and data.get('aud') != client_id:
                logger.warning('Google token audience mismatch')
                return None
            return data
        except Exception as e:
            logger.error(f'Google token verification failed: {e}')
            return None

    def _exchange_code(self, code: str) -> dict | None:
        """Exchange an authorization code for tokens, then get user info."""
        try:
            token_resp = requests.post(
                'https://oauth2.googleapis.com/token',
                data={
                    'code': code,
                    'client_id': getattr(settings, 'GOOGLE_CLIENT_ID', ''),
                    'client_secret': getattr(settings, 'GOOGLE_CLIENT_SECRET', ''),
                    'redirect_uri': 'postmessage',
                    'grant_type': 'authorization_code',
                },
                timeout=10,
            )
            if token_resp.status_code != 200:
                return None
            tokens = token_resp.json()
            id_token = tokens.get('id_token')
            if id_token:
                return self._verify_id_token(id_token)
            # Fallback: use access token to get userinfo
            access_token = tokens.get('access_token')
            if access_token:
                info_resp = requests.get(
                    'https://www.googleapis.com/oauth2/v2/userinfo',
                    headers={'Authorization': f'Bearer {access_token}'},
                    timeout=10,
                )
                if info_resp.status_code == 200:
                    return info_resp.json()
            return None
        except Exception as e:
            logger.error(f'Google code exchange failed: {e}')
            return None

    @staticmethod
    def _generate_username(email: str, google_user: dict) -> str:
        """Generate a unique username from the Google profile."""
        base = email.split('@')[0]
        username = base
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f'{base}{counter}'
            counter += 1
        return username


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class PreferencesView(generics.UpdateAPIView):
    serializer_class = UserPreferencesSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data['refresh']
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except Exception:
            return Response(status=status.HTTP_400_BAD_REQUEST)
