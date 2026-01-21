import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import type { PublicTest, PublicBenchmarkStatus } from "@/utils/types";
import { API_BASE, WS_BASE } from "@/utils/types";
import { getAuthHeaders } from "@/utils/auth";

type UrlValidationStatus = "idle" | "validating" | "valid" | "invalid";
type DocSourceType = "url" | "file";

export default function PublicBenchmarkView() {
	const navigate = useNavigate();
	const [publicTests, setPublicTests] = useState<PublicTest[]>([]);
	const [docSourceType, setDocSourceType] = useState<DocSourceType>("url");
	const [documentationUrl, setDocumentationUrl] = useState("");
	const [documentationFile, setDocumentationFile] = useState<File | null>(null);
	const [documentationContent, setDocumentationContent] = useState("");
	const [documentationName, setDocumentationName] = useState("");
	const [status, setStatus] = useState<PublicBenchmarkStatus>({
		status: "idle",
	});
	const [urlValidation, setUrlValidation] = useState<UrlValidationStatus>("idle");
	const [urlError, setUrlError] = useState("");
	const [fileError, setFileError] = useState("");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		fetchPublicTests();
		const socket = io(WS_BASE);

		socket.on("public_benchmark_update", (data) => {
			setStatus(data);
		});

		return () => {
			socket.disconnect();
		};
	}, []);

	useEffect(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		if (!documentationUrl) {
			setUrlValidation("idle");
			setUrlError("");
			return;
		}

		try {
			new URL(documentationUrl);
		} catch {
			setUrlValidation("invalid");
			setUrlError("Invalid URL format");
			return;
		}

		setUrlValidation("validating");
		setUrlError("");

		debounceRef.current = setTimeout(async () => {
			try {
				const res = await fetch(`${API_BASE}/public/validate-url`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ url: documentationUrl }),
				});
				const data = await res.json();

				if (data.valid) {
					setUrlValidation("valid");
					setUrlError("");
				} else {
					setUrlValidation("invalid");
					setUrlError(data.error || "URL is not accessible");
				}
			} catch {
				setUrlValidation("invalid");
				setUrlError("Failed to validate URL");
			}
		}, 800);

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [documentationUrl]);

	const fetchPublicTests = async () => {
		try {
			const res = await fetch(`${API_BASE}/public/tests`);
			const data = await res.json();
			setPublicTests(data.tests || []);
		} catch (error) {
			console.error("Failed to fetch public tests:", error);
		}
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) {
			setDocumentationFile(null);
			setDocumentationContent("");
			setFileError("");
			return;
		}

		const validExtensions = [".md", ".txt", ".rst", ".html"];
		const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
		if (!validExtensions.includes(ext)) {
			setFileError("Please upload a .md, .txt, .rst, or .html file");
			setDocumentationFile(null);
			setDocumentationContent("");
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			setFileError("File size must be less than 5MB");
			setDocumentationFile(null);
			setDocumentationContent("");
			return;
		}

		try {
			const content = await file.text();
			setDocumentationFile(file);
			setDocumentationContent(content);
			setFileError("");
			if (!documentationName) {
				setDocumentationName(file.name.replace(/\.[^/.]+$/, ""));
			}
		} catch {
			setFileError("Failed to read file");
			setDocumentationFile(null);
			setDocumentationContent("");
		}
	};

	const handleSourceTypeChange = (type: DocSourceType) => {
		setDocSourceType(type);
		if (type === "url") {
			setDocumentationFile(null);
			setDocumentationContent("");
			setFileError("");
		} else {
			setDocumentationUrl("");
			setUrlValidation("idle");
			setUrlError("");
		}
	};

	const clearFile = () => {
		setDocumentationFile(null);
		setDocumentationContent("");
		setFileError("");
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const runBenchmark = async () => {
		const apiKey = localStorage.getItem("openRouterApiKey");
		const hasValidDoc =
			(docSourceType === "url" && documentationUrl && urlValidation === "valid") ||
			(docSourceType === "file" && documentationContent);

		if (!apiKey || !hasValidDoc || !documentationName) {
			return;
		}

		setStatus({ status: "running", progress: "Starting benchmark..." });

		try {
			const body: Record<string, string> = {
				documentation_name: documentationName,
			};

			if (docSourceType === "url") {
				body.documentation_url = documentationUrl;
			} else {
				body.documentation_content = documentationContent;
			}

			const res = await fetch(`${API_BASE}/public/benchmark`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-API-Key": apiKey,
				},
				body: JSON.stringify(body),
			});

			const data = await res.json();
			if (data.error) {
				setStatus({ status: "failed", error: data.error });
			}
		} catch (error) {
			setStatus({
				status: "failed",
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	};

	const submitToLeaderboard = async () => {
		if (!status.result?.run_id) return;

		try {
			const res = await fetch(`${API_BASE}/public/leaderboard/submit`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...getAuthHeaders(),
				},
				body: JSON.stringify({
					run_id: status.result.run_id,
					documentation_name: documentationName,
					documentation_url: documentationUrl || `file://${documentationFile?.name || "uploaded"}`,
				}),
			});

			const data = await res.json();
			if (data.success) {
				navigate("/leaderboard");
			} else {
				alert(data.error || "Failed to submit");
			}
		} catch (error) {
			console.error("Failed to submit:", error);
		}
	};

	const hasValidDoc =
		(docSourceType === "url" && documentationUrl && urlValidation === "valid") ||
		(docSourceType === "file" && documentationContent);

	const apiKey = localStorage.getItem("openRouterApiKey");
	const canRun =
		apiKey &&
		hasValidDoc &&
		documentationName &&
		status.status === "idle";

	const getUrlInputClasses = () => {
		const base = "w-full px-3 py-2.5 bg-terminal-bg border rounded-lg text-text-primary placeholder-text-muted focus:outline-none transition-colors";
		if (urlValidation === "invalid") return `${base} border-red-500 focus:border-red-500`;
		if (urlValidation === "valid") return `${base} border-green-500 focus:border-green-500`;
		if (urlValidation === "validating") return `${base} border-amber-500 focus:border-amber-500`;
		return `${base} border-terminal-border focus:border-terminal-accent`;
	};

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-semibold text-text-primary">
					Submit Your Documentation
				</h2>
				<p className="text-text-muted mt-1">
					Test your documentation against our benchmark and compete on the leaderboard
				</p>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="space-y-4">
					<div className="bg-terminal-surface border border-terminal-border rounded-lg p-5">
						<h3 className="text-text-primary font-medium mb-4 flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terminal-accent">
								<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
								<circle cx="12" cy="12" r="3"></circle>
							</svg>
							Configuration
						</h3>

						<div className="space-y-4">
							<div>
								<label className="block text-text-secondary text-sm mb-1.5">
									Documentation Name
								</label>
								<input
									type="text"
									value={documentationName}
									onChange={(e) => setDocumentationName(e.target.value)}
									placeholder="My Documentation v1.0"
									className="w-full px-3 py-2.5 bg-terminal-bg border border-terminal-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-terminal-accent transition-colors"
								/>
							</div>

							<div>
								<label className="block text-text-secondary text-sm mb-1.5">
									Documentation Source
								</label>
								<div className="flex gap-1 p-1 bg-terminal-bg rounded-lg mb-3">
									<button
										type="button"
										onClick={() => handleSourceTypeChange("url")}
										className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
											docSourceType === "url"
												? "bg-terminal-accent text-black font-medium"
												: "text-text-muted hover:text-text-primary"
										}`}
									>
										URL
									</button>
									<button
										type="button"
										onClick={() => handleSourceTypeChange("file")}
										className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
											docSourceType === "file"
												? "bg-terminal-accent text-black font-medium"
												: "text-text-muted hover:text-text-primary"
										}`}
									>
										File Upload
									</button>
								</div>

								{docSourceType === "url" ? (
									<>
										<div className="relative">
											<input
												type="url"
												value={documentationUrl}
												onChange={(e) => setDocumentationUrl(e.target.value)}
												placeholder="https://example.com/docs.txt"
												className={getUrlInputClasses()}
											/>
											{urlValidation === "validating" && (
												<div className="absolute right-3 top-1/2 -translate-y-1/2">
													<div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
												</div>
											)}
											{urlValidation === "valid" && (
												<div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
														<polyline points="20 6 9 17 4 12"></polyline>
													</svg>
												</div>
											)}
											{urlValidation === "invalid" && (
												<div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
														<circle cx="12" cy="12" r="10"></circle>
														<line x1="15" y1="9" x2="9" y2="15"></line>
														<line x1="9" y1="9" x2="15" y2="15"></line>
													</svg>
												</div>
											)}
										</div>
										{urlValidation === "invalid" && urlError && (
											<p className="text-red-400 text-xs mt-1.5">{urlError}</p>
										)}
										{urlValidation === "valid" && (
											<p className="text-green-400 text-xs mt-1.5 flex items-center gap-1">
												<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
													<polyline points="20 6 9 17 4 12"></polyline>
												</svg>
												URL is accessible
											</p>
										)}
										{urlValidation === "validating" && (
											<p className="text-amber-400 text-xs mt-1.5">Validating URL...</p>
										)}
										{urlValidation === "idle" && documentationUrl === "" && (
											<p className="text-text-muted text-xs mt-1.5">
												URL to your documentation must be in plaintext and publicly accessible
											</p>
										)}
									</>
								) : (
									<>
										{!documentationFile ? (
											<label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-terminal-border rounded-lg cursor-pointer hover:border-terminal-accent transition-colors bg-terminal-bg">
												<div className="flex flex-col items-center justify-center pt-5 pb-6">
													<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted mb-2">
														<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
														<polyline points="17 8 12 3 7 8"></polyline>
														<line x1="12" y1="3" x2="12" y2="15"></line>
													</svg>
													<p className="text-sm text-text-muted">
														Click to upload or drag and drop
													</p>
													<p className="text-xs text-text-muted mt-1">
														max 5MB
													</p>
												</div>
												<input
													ref={fileInputRef}
													type="file"
													className="hidden"
													accept=".md,.txt,.rst,.html"
													onChange={handleFileChange}
												/>
											</label>
										) : (
											<div className="flex items-center gap-3 p-3 bg-terminal-bg border border-green-500 rounded-lg">
												<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 flex-shrink-0">
													<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
													<polyline points="14 2 14 8 20 8"></polyline>
												</svg>
												<div className="flex-1 min-w-0">
													<p className="text-text-primary text-sm font-medium truncate">
														{documentationFile.name}
													</p>
													<p className="text-text-muted text-xs">
														{(documentationFile.size / 1024).toFixed(1)} KB
													</p>
												</div>
												<button
													type="button"
													onClick={clearFile}
													className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
												>
													<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
														<line x1="18" y1="6" x2="6" y2="18"></line>
														<line x1="6" y1="6" x2="18" y2="18"></line>
													</svg>
												</button>
											</div>
										)}
										{fileError && (
											<p className="text-red-400 text-xs mt-1.5">{fileError}</p>
										)}
										{documentationFile && !fileError && (
											<p className="text-green-400 text-xs mt-1.5 flex items-center gap-1">
												<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
													<polyline points="20 6 9 17 4 12"></polyline>
												</svg>
												File loaded successfully
											</p>
										)}
									</>
								)}
							</div>

						</div>
					</div>

					<button
						onClick={runBenchmark}
						disabled={!canRun}
						className="btn btn-primary btn-lg btn-block"
					>
						Run Benchmark
					</button>
					{!apiKey && (
						<p className="text-text-muted text-xs text-center mt-2">
							Set your OpenRouter API key using the key icon in the navbar
						</p>
					)}
				</div>

				<div className="space-y-4">
					<div className="bg-terminal-surface border border-terminal-border rounded-lg p-5">
						<h3 className="text-text-primary font-medium mb-3 flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terminal-accent">
								<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
								<polyline points="14 2 14 8 20 8"></polyline>
							</svg>
							Public Test Suite
						</h3>
						<div className="flex items-center gap-4 mb-4">
							<div className="bg-terminal-accent/10 px-3 py-1.5 rounded-lg">
								<span className="text-terminal-accent font-semibold">{publicTests.length}</span>
								<span className="text-text-muted text-sm ml-1">tests</span>
							</div>
							<div className="bg-terminal-elevated px-3 py-1.5 rounded-lg">
								<span className="text-text-primary font-semibold">{new Set(publicTests.map((t) => t.category)).size}</span>
								<span className="text-text-muted text-sm ml-1">categories</span>
							</div>
						</div>

						{publicTests.length === 0 ? (
							<p className="text-text-muted text-sm">
								No public tests configured yet.
							</p>
						) : (
							<div className="max-h-48 overflow-y-auto space-y-1">
								{publicTests.map((test) => (
									<div
										key={test.id}
										className="flex justify-between items-center text-sm py-2 px-2 rounded hover:bg-terminal-elevated/50 transition-colors"
									>
										<span className="text-text-secondary font-mono text-xs">{test.id}</span>
										<span className="text-text-muted text-xs">
											L{test.level} / {test.points}pts
										</span>
									</div>
								))}
							</div>
						)}
					</div>

					{status.status !== "idle" && (
						<div className="bg-terminal-surface border border-terminal-border rounded-lg p-5">
							<h3 className="text-text-primary font-medium mb-4 flex items-center gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-terminal-accent">
									<path d="M12 20V10"></path>
									<path d="M18 20V4"></path>
									<path d="M6 20v-4"></path>
								</svg>
								Status
							</h3>

							{status.status === "running" && (
								<div className="space-y-4">
									<div className="flex items-center gap-3">
										<div className="w-5 h-5 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin"></div>
										<span className="text-text-secondary">
											{status.progress || "Running..."}
										</span>
									</div>
									{status.completed !== undefined && status.total !== undefined && (
										<div>
											<div className="flex justify-between text-sm text-text-muted mb-2">
												<span>Progress</span>
												<span className="font-mono">
													{status.completed}/{status.total}
												</span>
											</div>
											<div className="w-full bg-terminal-bg rounded-full h-3 overflow-hidden">
												<div
													className="bg-blue-500 h-full rounded-full transition-all"
													style={{
														width: `${(status.completed / status.total) * 100}%`,
													}}
												></div>
											</div>
										</div>
									)}
								</div>
							)}

							{status.status === "evaluating" && (
								<div className="flex items-center gap-3">
									<div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
									<span className="text-text-secondary">Evaluating responses...</span>
								</div>
							)}

							{status.status === "completed" && status.result && (
								<div className="space-y-5">
									<div className="text-center py-6 bg-terminal-bg rounded-lg">
										<p className="text-5xl font-bold text-terminal-accent">
											{status.result.percentage.toFixed(1)}%
										</p>
										<p className="text-text-muted mt-2">
											{status.result.total_score.toFixed(1)} /{" "}
											{status.result.max_score.toFixed(1)} points
										</p>
									</div>

									<button
										onClick={submitToLeaderboard}
										className="btn btn-success-solid btn-lg btn-block"
									>
										Submit to Leaderboard
									</button>

									<button
										onClick={() => setStatus({ status: "idle" })}
										className="btn btn-secondary btn-block"
									>
										Run Another Benchmark
									</button>
								</div>
							)}

							{status.status === "failed" && (
								<div className="space-y-4">
									<div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
										<p className="font-medium text-red-400">Benchmark Failed</p>
										<p className="text-red-400/80 text-sm mt-1">{status.error}</p>
									</div>
									<button
										onClick={() => setStatus({ status: "idle" })}
										className="btn btn-secondary btn-block"
									>
										Try Again
									</button>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
