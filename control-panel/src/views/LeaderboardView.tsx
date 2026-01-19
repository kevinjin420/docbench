import { useState, useEffect } from "react";
import type { LeaderboardEntry } from "@/utils/types";
import { API_BASE } from "@/utils/types";

function Podium({ entries }: { entries: LeaderboardEntry[] }) {
	if (entries.length < 3) return null;

	const [first, second, third] = [entries[0], entries[1], entries[2]];

	const TrophyIcon = ({ className }: { className?: string }) => (
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
			className={className}
		>
			<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
			<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
			<path d="M4 22h16"></path>
			<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
			<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
			<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
		</svg>
	);

	const PodiumEntry = ({
		entry,
		place,
		height,
		bgColor,
		borderColor,
		iconColor,
	}: {
		entry: LeaderboardEntry;
		place: number;
		height: string;
		bgColor: string;
		borderColor: string;
		iconColor: string;
	}) => (
		<div className="flex flex-col items-center">
			<div className="mb-3 text-center">
				<div
					className={`w-14 h-14 rounded-full ${bgColor} flex items-center justify-center mb-2 mx-auto border-2 ${borderColor}`}
				>
					<TrophyIcon className={iconColor} />
				</div>
				<p className="text-text-primary font-medium text-sm truncate max-w-[140px]">
					{entry.documentation_name}
				</p>
				<p className="text-terminal-accent font-mono text-lg font-bold">
					{entry.percentage.toFixed(1)}%
				</p>
			</div>
			<div
				className={`w-32 ${height} ${bgColor} border-t-4 ${borderColor} rounded-t-lg flex flex-col items-center justify-start pt-4`}
			>
				<span className="text-3xl font-bold text-black/80">{place}</span>
			</div>
		</div>
	);

	return (
		<div className="bg-terminal-surface border border-terminal-border rounded-lg p-8 mb-6">
			<div className="flex items-end justify-center gap-2">
				<PodiumEntry
					entry={second}
					place={2}
					height="h-24"
					bgColor="bg-slate-300"
					borderColor="border-slate-400"
					iconColor="text-slate-600"
				/>
				<PodiumEntry
					entry={first}
					place={1}
					height="h-32"
					bgColor="bg-amber-400"
					borderColor="border-amber-500"
					iconColor="text-amber-700"
				/>
				<PodiumEntry
					entry={third}
					place={3}
					height="h-20"
					bgColor="bg-amber-600"
					borderColor="border-amber-700"
					iconColor="text-amber-900"
				/>
			</div>
		</div>
	);
}

export default function LeaderboardView() {
	const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
	const [total, setTotal] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [page, setPage] = useState(0);
	const limit = 25;

	const fetchLeaderboard = async () => {
		setIsLoading(true);
		try {
			const res = await fetch(
				`${API_BASE}/public/leaderboard?limit=${limit}&offset=${page * limit}`
			);
			const data = await res.json();
			setEntries(data.entries || []);
			setTotal(data.total || 0);
		} catch (error) {
			console.error("Failed to fetch leaderboard:", error);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchLeaderboard();
	}, [page]);

	const formatDate = (timestamp: number) => {
		return new Date(timestamp * 1000).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const getRankStyle = (rank: number) => {
		if (rank === 1) return { badge: "bg-amber-400 text-black", glow: "shadow-[0_0_12px_rgba(251,191,36,0.4)]" };
		if (rank === 2) return { badge: "bg-slate-300 text-black", glow: "" };
		if (rank === 3) return { badge: "bg-amber-600 text-black", glow: "" };
		return { badge: "bg-terminal-elevated text-text-secondary", glow: "" };
	};

	const totalPages = Math.ceil(total / limit);

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-2xl font-semibold text-text-primary">
						Documentation Leaderboard
					</h2>
					<p className="text-text-muted mt-1">
						Ranked by benchmark score percentage
					</p>
				</div>
				<button
					onClick={fetchLeaderboard}
					className="btn btn-secondary"
				>
					Refresh
				</button>
			</div>

			{isLoading ? (
				<div className="bg-terminal-surface border border-terminal-border rounded-lg p-16 text-center">
					<div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-terminal-accent/20 flex items-center justify-center animate-pulse">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terminal-accent">
							<path d="M12 20V10"></path>
							<path d="M18 20V4"></path>
							<path d="M6 20v-4"></path>
						</svg>
					</div>
					<p className="text-text-secondary">Loading leaderboard...</p>
				</div>
			) : entries.length === 0 ? (
				<div className="bg-terminal-surface border border-terminal-border rounded-lg p-16 text-center">
					<div className="w-16 h-16 mx-auto mb-4 rounded-full bg-terminal-accent/10 flex items-center justify-center">
						<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-terminal-accent">
							<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
							<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
							<path d="M4 22h16"></path>
							<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
							<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
							<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
						</svg>
					</div>
					<h3 className="text-text-primary text-xl font-medium mb-2">No Entries Yet</h3>
					<p className="text-text-muted max-w-md mx-auto">
						Be the first to submit your documentation to the leaderboard and see how it performs!
					</p>
				</div>
			) : (
				<>
					{page === 0 && <Podium entries={entries} />}

					<div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
						<table className="w-full">
							<thead className="bg-terminal-bg">
								<tr>
									<th className="px-4 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-20">
										Rank
									</th>
									<th className="px-4 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
										Documentation
									</th>
									<th className="px-4 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-40">
										Score
									</th>
									<th className="px-4 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-40">
										Model
									</th>
									<th className="px-4 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-32">
										Date
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-terminal-border">
								{entries.map((entry) => {
									const rankStyle = getRankStyle(entry.rank);
									return (
										<tr
											key={entry.id}
											className="hover:bg-terminal-elevated/50 transition-colors"
										>
											<td className="px-4 py-4">
												<span
													className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold ${rankStyle.badge} ${rankStyle.glow}`}
												>
													{entry.rank}
												</span>
											</td>
											<td className="px-4 py-4">
												<div>
													<a
														href={entry.documentation_url}
														target="_blank"
														rel="noopener noreferrer"
														className="text-terminal-accent hover:text-terminal-accent-hover font-medium transition-colors"
													>
														{entry.documentation_name}
													</a>
													<p className="text-text-muted text-sm truncate max-w-md mt-0.5">
														{entry.documentation_url}
													</p>
												</div>
											</td>
											<td className="px-4 py-4">
												<div className="flex items-center gap-3">
													<div className="w-24 bg-terminal-bg rounded-full h-2.5 overflow-hidden">
														<div
															className={`h-full rounded-full transition-all ${
																entry.percentage >= 80
																	? "bg-green-500"
																	: entry.percentage >= 60
																	? "bg-amber-500"
																	: "bg-red-500"
															}`}
															style={{
																width: `${Math.min(entry.percentage, 100)}%`,
															}}
														></div>
													</div>
													<span className={`font-mono text-sm font-medium ${
														entry.percentage >= 80
															? "text-green-400"
															: entry.percentage >= 60
															? "text-amber-400"
															: "text-red-400"
													}`}>
														{entry.percentage.toFixed(1)}%
													</span>
												</div>
											</td>
											<td className="px-4 py-4 text-text-secondary text-sm">
												{entry.model_used.split("/").pop()}
											</td>
											<td className="px-4 py-4 text-text-muted text-sm">
												{formatDate(entry.submitted_at)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{totalPages > 1 && (
						<div className="flex justify-between items-center">
							<p className="text-text-muted text-sm">
								Showing {page * limit + 1} -{" "}
								{Math.min((page + 1) * limit, total)} of {total} entries
							</p>
							<div className="flex gap-2">
								<button
									onClick={() => setPage((p) => Math.max(0, p - 1))}
									disabled={page === 0}
									className="btn btn-secondary"
								>
									Previous
								</button>
								<button
									onClick={() =>
										setPage((p) => Math.min(totalPages - 1, p + 1))
									}
									disabled={page >= totalPages - 1}
									className="btn btn-secondary"
								>
									Next
								</button>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}
