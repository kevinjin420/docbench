import { useState, useEffect, useRef } from "react";
import type { User } from "@/utils/types";

interface UserMenuProps {
	user: User;
	onLogout: () => void;
}

export default function UserMenu({ user, onLogout }: UserMenuProps) {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
			>
				<img
					src={user.avatar_url}
					alt={user.name || "User"}
					className="w-8 h-8 rounded-full"
				/>
				<span className="text-sm text-gray-300 max-w-[120px] truncate">
					{user.name || user.email}
				</span>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className={`transition-transform text-gray-500 ${isOpen ? "rotate-180" : ""}`}
				>
					<polyline points="6 9 12 15 18 9"></polyline>
				</svg>
			</button>

			{isOpen && (
				<div className="absolute right-0 top-full mt-2 w-56 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50 overflow-hidden">
					<div className="p-3 border-b border-terminal-border">
						<div className="flex items-center gap-3">
							<img
								src={user.avatar_url}
								alt={user.name || "User"}
								className="w-10 h-10 rounded-full"
							/>
							<div className="overflow-hidden">
								<p className="text-sm font-medium text-gray-200 truncate">
									{user.name || "User"}
								</p>
								<p className="text-xs text-gray-500 truncate">{user.email}</p>
							</div>
						</div>
					</div>
					<div className="py-1">
						<button
							onClick={() => {
								setIsOpen(false);
								onLogout();
							}}
							className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-950 transition-colors"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
								<polyline points="16 17 21 12 16 7"></polyline>
								<line x1="21" y1="12" x2="9" y2="12"></line>
							</svg>
							Sign Out
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
