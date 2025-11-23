import type { TestFile } from "@/utils/types";

interface Props {
	files: TestFile[];
	selectedFile: string | null;
	onFileClick: (path: string) => void;
	onFileDelete: (path: string, e: React.MouseEvent) => void;
}

export default function TestFileList({ files, selectedFile, onFileClick, onFileDelete }: Props) {
	return (
		<div className="bg-terminal-surface border border-terminal-border rounded flex flex-col">
			<div className="flex justify-between items-center p-4 border-b border-terminal-border">
				<h3 className="text-terminal-accent text-base m-0">Test Results</h3>
				<span className="text-xs text-gray-500 bg-zinc-900 px-2 py-1 rounded">
					{files.length} files
				</span>
			</div>
			<div className="flex-1 overflow-y-auto p-2">
				{files.length === 0 ? (
					<div className="flex items-center justify-center h-full text-gray-600 text-sm">
						<p>No test files yet</p>
					</div>
				) : (
					[...files]
						.sort((a, b) => b.modified - a.modified)
						.map((file) => (
							<div
								key={file.path}
								className={`p-3 mb-2 rounded border cursor-pointer transition-all ${
									selectedFile === file.path
										? "bg-green-950 border-terminal-accent"
										: "bg-zinc-900 border-terminal-border hover:bg-zinc-800 hover:border-gray-600"
								}`}
								onClick={() => onFileClick(file.path)}
							>
								<div className="flex justify-between items-start gap-2">
									<div className="flex-1 min-w-0">
										<div className="text-gray-300 text-sm mb-1 break-all">{file.name}</div>
										<div className="text-gray-500 text-xs">
											{(file.size / 1024).toFixed(1)} KB
										</div>
									</div>
									<button
										onClick={(e) => onFileDelete(file.path, e)}
										className="shrink-0 p-1 text-red-500 hover:text-red-400 hover:bg-red-950 rounded transition-colors"
										title="Delete file"
									>
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</button>
								</div>
							</div>
						))
				)}
			</div>
		</div>
	);
}
