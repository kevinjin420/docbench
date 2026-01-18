"""OAuth authentication service using Authlib and JWT"""
import os
import time
from typing import Optional, Dict, Any

import jwt
from authlib.integrations.requests_client import OAuth2Session

from database import UserService


JWT_SECRET = os.getenv('JWT_SECRET', 'change-me-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_HOURS = 24 * 7  # 1 week

GITHUB_CLIENT_ID = os.getenv('GITHUB_CLIENT_ID', '')
GITHUB_CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET', '')
GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
GITHUB_API_URL = 'https://api.github.com'


class OAuthService:
    """Service for handling OAuth authentication"""

    @staticmethod
    def get_github_oauth_client(redirect_uri: str) -> OAuth2Session:
        """Create GitHub OAuth2 session"""
        return OAuth2Session(
            client_id=GITHUB_CLIENT_ID,
            client_secret=GITHUB_CLIENT_SECRET,
            redirect_uri=redirect_uri,
            scope='read:user user:email'
        )

    @staticmethod
    def get_github_authorize_url(redirect_uri: str) -> tuple[str, str]:
        """Get GitHub authorization URL and state"""
        client = OAuthService.get_github_oauth_client(redirect_uri)
        url, state = client.create_authorization_url(GITHUB_AUTHORIZE_URL)
        return url, state

    @staticmethod
    def exchange_github_code(code: str, redirect_uri: str, state: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access token and fetch user info"""
        client = OAuthService.get_github_oauth_client(redirect_uri)

        try:
            token = client.fetch_token(
                GITHUB_TOKEN_URL,
                code=code,
                state=state
            )
        except Exception as e:
            print(f"Error fetching GitHub token: {e}")
            return None

        access_token = token.get('access_token')
        if not access_token:
            return None

        user_info = OAuthService._fetch_github_user(access_token)
        if not user_info:
            return None

        return user_info

    @staticmethod
    def _fetch_github_user(access_token: str) -> Optional[Dict[str, Any]]:
        """Fetch user info from GitHub API"""
        import requests

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json'
        }

        try:
            user_resp = requests.get(f'{GITHUB_API_URL}/user', headers=headers, timeout=10)
            user_resp.raise_for_status()
            user_data = user_resp.json()

            email = user_data.get('email')
            if not email:
                email_resp = requests.get(f'{GITHUB_API_URL}/user/emails', headers=headers, timeout=10)
                email_resp.raise_for_status()
                emails = email_resp.json()
                for e in emails:
                    if e.get('primary') and e.get('verified'):
                        email = e.get('email')
                        break
                if not email and emails:
                    email = emails[0].get('email')

            return {
                'github_id': str(user_data.get('id')),
                'name': user_data.get('name') or user_data.get('login'),
                'email': email or f"{user_data.get('id')}@users.noreply.github.com",
                'login': user_data.get('login')
            }

        except Exception as e:
            print(f"Error fetching GitHub user: {e}")
            return None


class JWTService:
    """Service for JWT token creation and verification"""

    @staticmethod
    def create_token(user: Dict[str, Any]) -> str:
        """Create JWT token for user"""
        payload = {
            'sub': str(user['id']),
            'email': user['email'],
            'name': user.get('name'),
            'github_id': user.get('github_id'),
            'is_admin': user.get('is_admin', False),
            'iat': int(time.time()),
            'exp': int(time.time()) + (JWT_EXPIRY_HOURS * 3600)
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    @staticmethod
    def verify_token(token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token and return payload"""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if payload.get('exp', 0) < time.time():
                print(f"JWT expired: exp={payload.get('exp')}, now={time.time()}")
                return None
            return payload
        except Exception as e:
            print(f"JWT decode error: {type(e).__name__}: {e}")
            print(f"Token (first 50 chars): {token[:50] if token else 'None'}...")
            return None

    @staticmethod
    def get_user_from_token(token: str) -> Optional[Dict[str, Any]]:
        """Get full user info from token"""
        payload = JWTService.verify_token(token)
        if not payload:
            return None

        user_id = payload.get('sub')
        if not user_id:
            return None

        return UserService.get_by_id(int(user_id))
