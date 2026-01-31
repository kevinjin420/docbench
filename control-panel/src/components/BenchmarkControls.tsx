import type { Model, Variant } from "@/utils/types";
import ModelSelector from "./ModelSelector";
import DocumentationSelector from "./DocumentationSelector";

interface Props {
	models: Model[];
	variants: Variant[];
	selectedModel: string;
	setSelectedModel: (model: string) => void;
	selectedVariant: string;
	setSelectedVariant: (variant: string) => void;
	queueSize: number;
	setQueueSize: (size: number) => void;
	batchSize: number;
	setBatchSize: (size: number) => void;
	isRunning: boolean;
	onRun: () => void;
	onCancel: () => void;
	canRun?: boolean;
}

export default function BenchmarkControls({
	models,
	variants,
	selectedModel,
	setSelectedModel,
	selectedVariant,
	setSelectedVariant,
	queueSize,
	setQueueSize,
	batchSize,
	setBatchSize,
	isRunning,
	onRun,
	onCancel,
	canRun = true,
}: Props) {
	return (
		<div className="flex gap-4 items-center justify-between">
			<div className="flex gap-4 items-center flex-wrap">
				<div className="flex items-center gap-2">
					<label className="text-text-secondary text-sm font-medium uppercase tracking-wide">Model:</label>
					<div className="min-w-[260px]">
						<ModelSelector
							models={models}
							selectedModel={selectedModel}
							onSelect={setSelectedModel}
							disabled={isRunning}
						/>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<label className="text-text-secondary text-sm font-medium uppercase tracking-wide">Documentation:</label>
					<div className="min-w-[150px]">
						<DocumentationSelector
							variants={variants}
							selectedVariant={selectedVariant}
							onSelect={setSelectedVariant}
							disabled={isRunning}
						/>
					</div>
				</div>

				<span className="text-text-muted text-sm uppercase">Runs:</span>
				<input
					type="number"
					min="1"
					max="20"
					step="1"
					value={queueSize}
					onChange={(e) => setQueueSize(parseInt(e.target.value) || 1)}
					disabled={isRunning}
					className="w-16 px-2 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent disabled:opacity-50 disabled:cursor-not-allowed text-center"
					title="Number of runs to queue"
				/>

				<span className="text-text-muted text-sm uppercase">Batch:</span>
				<input
					type="number"
					min="1"
					max="100"
					step="1"
					value={batchSize || ""}
					onChange={(e) => setBatchSize(e.target.value === "" ? 0 : parseInt(e.target.value))}
					onBlur={(e) => { if (!e.target.value || parseInt(e.target.value) < 1) setBatchSize(45); }}
					disabled={isRunning}
					className="w-16 px-2 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent disabled:opacity-50 disabled:cursor-not-allowed text-center"
					title="Tests per batch"
				/>
			</div>

			<div className="flex gap-3 items-center">
				{!isRunning ? (
					<button
						onClick={onRun}
						disabled={!canRun || !selectedModel || !selectedVariant}
						className="btn btn-primary"
					>
						Run {queueSize > 1 ? `(${queueSize})` : ""}
					</button>
				) : (
					<button
						onClick={onCancel}
						className="btn btn-danger-solid"
					>
						Cancel
					</button>
				)}
			</div>
		</div>
	);
}
