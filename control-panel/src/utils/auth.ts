import type { User } from "./types";
import { API_BASE } from "./types";

const TOKEN_KEY = "userToken";

export function getStoredToken(): string | null {
	return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
	localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
	localStorage.removeItem(TOKEN_KEY);
}

export function getAuthHeaders(): Record<string, string> {
	const token = getStoredToken();
	if (token) {
		return { Authorization: `Bearer ${token}` };
	}
	return {};
}

export function getAdminHeaders(): Record<string, string> {
	return getAuthHeaders();
}

export async function fetchCurrentUser(): Promise<User | null> {
	const token = getStoredToken();
	if (!token) {
		return null;
	}

	try {
		const res = await fetch(`${API_BASE}/oauth/me`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		if (!res.ok) {
			clearStoredToken();
			return null;
		}

		const data = await res.json();
		return data.user;
	} catch {
		return null;
	}
}

export async function verifyToken(token: string): Promise<boolean> {
	try {
		const res = await fetch(`${API_BASE}/oauth/verify`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		return res.ok;
	} catch {
		return false;
	}
}

export function getGitHubLoginUrl(): string {
	return `${API_BASE}/oauth/github/login`;
}

export function logout(): void {
	clearStoredToken();
}
