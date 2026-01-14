#!/usr/bin/env python3
"""
Script to create an initial admin token.
Run this after the database is initialized to create the first admin token.

Usage:
    python scripts/create_admin_token.py [--name "Admin Name"]
"""
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from database import AccessTokenService

def main():
    parser = argparse.ArgumentParser(description='Create an admin access token')
    parser.add_argument('--name', default='Initial Admin', help='Name/description for the token')
    parser.add_argument('--expires-days', type=int, default=None, help='Token expiry in days (default: never)')
    args = parser.parse_args()

    print(f"Creating admin token for: {args.name}")
    print("-" * 50)

    plaintext, token_id = AccessTokenService.create(
        name=args.name,
        is_admin=True,
        expires_days=args.expires_days
    )

    print(f"Token ID: {token_id}")
    print(f"Access Token: {plaintext}")
    print("-" * 50)
    print("IMPORTANT: Save this token now. It will not be shown again.")
    print("Use this token in the X-Access-Token header for authenticated requests.")

if __name__ == '__main__':
    main()
