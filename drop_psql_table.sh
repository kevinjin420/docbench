#!/bin/bash
psql "$PUBLIC_DATABASE_URL" -c "DROP TABLE IF EXISTS leaderboard_entries, users, access_tokens, public_test_config CASCADE;"