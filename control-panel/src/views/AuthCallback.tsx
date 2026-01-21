import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setStoredToken, getReturnUrl } from "@/utils/auth";
import type { User } from "@/utils/types";
import { API_BASE } from "@/utils/types";

interface AuthCallbackProps {
	onLogin: (user: User, token: string) => void;
}

export default function AuthCallback({ onLogin }: AuthCallbackProps) {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const [error, setError] = useState<string | null>(null);
	const returnUrlRef = useRef<string | null>(null);
	const hasStartedAuth = useRef(false);

	useEffect(() => {
		if (hasStartedAuth.current) return;
		hasStartedAuth.current = true;

		if (returnUrlRef.current === null) {
			returnUrlRef.current = getReturnUrl();
		}

		const token = searchParams.get("token");
		const errorParam = searchParams.get("error");

		if (errorParam) {
			setError(getErrorMessage(errorParam));
			return;
		}

		if (!token) {
			setError("No authentication token received");
			return;
		}

		setStoredToken(token);

		fetch(`${API_BASE}/oauth/me`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		})
			.then((res) => {
				if (!res.ok) throw new Error("Failed to fetch user");
				return res.json();
			})
			.then((data) => {
				if (data.user) {
					onLogin(data.user, token);
					navigate(returnUrlRef.current || "/");
				} else {
					setError("Failed to fetch user information");
				}
			})
			.catch(() => {
				setError("Failed to fetch user information");
			});
	}, [searchParams, navigate, onLogin]);

	function getErrorMessage(code: string): string {
		switch (code) {
			case "no_code":
				return "No authorization code received from GitHub";
			case "auth_failed":
				return "Authentication failed. Please try again.";
			case "access_denied":
				return "Access was denied. Please try again.";
			default:
				return `Authentication error: ${code}`;
		}
	}

	if (error) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="bg-terminal-surface border border-terminal-border rounded-lg p-8 max-w-md text-center">
					<div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="text-red-400"
						>
							<circle cx="12" cy="12" r="10"></circle>
							<line x1="15" y1="9" x2="9" y2="15"></line>
							<line x1="9" y1="9" x2="15" y2="15"></line>
						</svg>
					</div>
					<h2 className="text-xl font-semibold text-text-primary mb-2">
						Authentication Failed
					</h2>
					<p className="text-text-muted mb-6">{error}</p>
					<button
						onClick={() => navigate("/")}
						className="btn btn-primary"
					>
						Return to Homepage
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center justify-center min-h-[400px]">
			<div className="bg-terminal-surface border border-terminal-border rounded-lg p-8 max-w-md text-center">
				<div className="w-12 h-12 mx-auto mb-4 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin"></div>
				<h2 className="text-xl font-semibold text-text-primary mb-2">
					Completing Sign In
				</h2>
				<p className="text-text-muted">
					Please wait while we complete your authentication...
				</p>
			</div>
		</div>
	);
}
