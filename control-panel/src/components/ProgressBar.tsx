import type { BenchmarkStatus } from "@/utils/types";

interface Props {
	status: BenchmarkStatus;
	onBatchClick?: (batchKey: string) => void;
	rerunningBatches?: Set<string>;
}

export default function ProgressBar({ status, onBatchClick, rerunningBatches }: Props) {
	const generationDone =
		status.batches_completed_global !== undefined &&
		status.batches_total_global !== undefined &&
		status.batches_completed_global === status.batches_total_global &&
		status.batches_total_global > 0;

	const evaluationDone =
		status.completed_evaluations !== undefined &&
		status.total_evaluations !== undefined &&
		status.completed_evaluations === status.total_evaluations;

	return (
		<div className="mt-3 flex flex-col gap-3">
			{/* Generation Progress Bar */}
			<div
				className={`px-4 py-3 rounded-lg ${
					generationDone
						? "bg-green-950/50 border border-green-600/50"
						: status.status === "running" || status.status === "evaluating"
						? "bg-blue-950/50 border border-blue-600/50"
						: status.status === "failed"
						? "bg-red-950/50 border border-red-600/50"
						: "bg-terminal-surface border border-terminal-border"
				}`}
			>
				<div className="flex items-center gap-4">
					<span className="text-xs text-text-muted w-20">Generation</span>
					<div className="flex-1 bg-terminal-bg rounded-full h-2.5 overflow-hidden">
						<div
							className={`h-full transition-all duration-300 ${
								generationDone ? "bg-green-500" : "bg-blue-500"
							}`}
							style={{
								width:
									status.status === "idle"
										? "100%"
										: status.batches_completed_global !== undefined &&
										  status.batches_total_global
										? `${(status.batches_completed_global / status.batches_total_global) * 100}%`
										: "0%",
							}}
						/>
					</div>
					<span
						className={`text-xs font-medium shrink-0 ${
							generationDone
								? "text-green-400"
								: status.status === "running"
								? "text-blue-400"
								: status.status === "failed"
								? "text-red-400"
								: "text-text-muted"
						}`}
					>
						{generationDone ? "Complete" : status.status === "running" ? "In Progress" : "Idle"}
					</span>
					<span className="text-xs text-text-muted shrink-0 font-mono">
						{status.batches_completed_global ?? 0}/{status.batches_total_global || "?"}
					</span>
				</div>

				{/* Batch Status Boxes */}
				{status.batch_statuses && Object.keys(status.batch_statuses).length > 0 && (
					<div className="flex gap-1.5 mt-3 flex-wrap">
						{Object.entries(status.batch_statuses)
							.sort(([a], [b]) => {
								const parseKey = (k: string) => {
									const parts = k.split('.');
									return parts.length === 2
										? parseInt(parts[0]) * 1000 + parseInt(parts[1])
										: parseInt(k);
								};
								return parseKey(a) - parseKey(b);
							})
							.map(([batchNum, bs]) => {
								const isRerunning = rerunningBatches?.has(batchNum);
								const canClick = onBatchClick && bs.status !== "pending" && !isRerunning;
								const getTitle = () => {
									if (isRerunning) return "Rerunning...";
									if (!canClick) return `Batch ${batchNum}: ${bs.status}`;
									if (bs.status === "running") return `Click to restart stuck batch ${batchNum}`;
									return `Click to rerun batch ${batchNum}`;
								};
								return (
									<button
										key={batchNum}
										onClick={() => canClick && onBatchClick(batchNum)}
										disabled={!canClick}
										className={`w-7 h-7 rounded text-xs font-mono transition-all flex items-center justify-center ${
											isRerunning
												? "bg-violet-600 text-white animate-pulse"
												: bs.status === "completed"
												? "bg-green-600 text-white"
												: bs.status === "failed"
												? "bg-red-600 text-white"
												: bs.status === "running" && bs.retry > 0
												? "bg-amber-600 text-white"
												: bs.status === "running"
												? "bg-blue-600 text-white"
												: "bg-terminal-elevated text-text-muted"
										} ${canClick ? "cursor-pointer hover:ring-2 hover:ring-white/40 hover:scale-105" : ""}`}
										title={getTitle()}
									>
										{isRerunning
											? "..."
											: bs.status === "running" && bs.retry > 0
											? bs.retry
											: batchNum.includes('.') ? batchNum.split('.')[1] : batchNum}
									</button>
								);
							})}
					</div>
				)}
			</div>

			{/* Evaluation Progress Bar */}
			{(status.status === "running" || status.status === "evaluating" || status.status === "completed") && status.total_evaluations !== undefined && (
				<div className={`px-4 py-3 rounded-lg ${
					evaluationDone
						? "bg-green-950/50 border border-green-600/50"
						: "bg-violet-950/50 border border-violet-600/50"
				}`}>
					<div className="flex items-center gap-4">
						<span className="text-xs text-text-muted w-20">Evaluation</span>
						<div className="flex-1 bg-terminal-bg rounded-full h-2.5 overflow-hidden">
							<div
								className={`h-full transition-all duration-300 ${
									evaluationDone ? "bg-green-500" : "bg-violet-500"
								}`}
								style={{
									width: `${((status.completed_evaluations || 0) / status.total_evaluations) * 100}%`,
								}}
							/>
						</div>
						<span className={`text-xs font-medium shrink-0 ${
							evaluationDone ? "text-green-400" : "text-violet-400"
						}`}>
							{evaluationDone ? "Complete" : "In Progress"}
						</span>
						<span className="text-xs text-text-muted shrink-0 font-mono">
							{status.completed_evaluations || 0}/{status.total_evaluations}
						</span>
					</div>

					{/* Evaluation Status Boxes */}
					{status.evaluation_statuses && !evaluationDone && (
						<div className="flex gap-1.5 mt-3 flex-wrap">
							{Array.from({ length: status.total_evaluations }).map((_, i) => {
								const index = (i + 1).toString();
								const evalStatus = status.evaluation_statuses![index] || "pending";
								return (
									<div
										key={index}
										className={`w-7 h-7 rounded text-xs font-mono transition-all flex items-center justify-center ${
											evalStatus === "running"
												? "bg-violet-600 text-white animate-pulse"
												: evalStatus === "completed"
												? "bg-green-600 text-white"
												: evalStatus === "failed"
												? "bg-red-600 text-white"
												: "bg-terminal-elevated text-text-muted"
										}`}
										title={`Run ${index}: ${evalStatus}`}
									>
										{index}
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}

			{/* Legend */}
			{(status.batch_statuses && Object.keys(status.batch_statuses).length > 0) && (
				<div className="flex gap-4 text-xs text-text-muted">
					<div className="flex items-center gap-1.5">
						<div className="w-3 h-3 rounded bg-green-600"></div>
						<span>Complete</span>
					</div>
					<div className="flex items-center gap-1.5">
						<div className="w-3 h-3 rounded bg-blue-600"></div>
						<span>Running</span>
					</div>
					<div className="flex items-center gap-1.5">
						<div className="w-3 h-3 rounded bg-amber-600"></div>
						<span>Retrying</span>
					</div>
					<div className="flex items-center gap-1.5">
						<div className="w-3 h-3 rounded bg-red-600"></div>
						<span>Failed</span>
					</div>
				</div>
			)}
		</div>
	);
}
