import { Link } from "react-router-dom";

export default function HomeView() {
	return (
		<div className="max-w-3xl mx-auto py-12">
			<div className="text-center mb-12">
				<h1 className="text-4xl font-bold text-text-primary mb-4">
					Jaseci <span className="text-terminal-accent">DocBench</span>
				</h1>
				<p className="text-text-secondary text-lg leading-relaxed max-w-2xl mx-auto">
					A benchmark suite for evaluating LLM performance on Jac language documentation.
					Test how well language models understand and generate code from your documentation.
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
				<Link
					to="/leaderboard"
					className="group bg-terminal-surface border border-terminal-border rounded-lg p-6 hover:border-terminal-accent transition-all"
				>
					<div className="flex items-center gap-3 mb-3">
						<div className="w-10 h-10 rounded bg-terminal-accent/10 flex items-center justify-center text-terminal-accent">
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
								<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
								<path d="M4 22h16"></path>
								<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
								<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
								<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
							</svg>
						</div>
						<h2 className="text-xl font-semibold text-text-primary group-hover:text-terminal-accent transition-colors">
							Leaderboard
						</h2>
					</div>
					<p className="text-text-muted text-sm">
						View ranked documentation submissions and see how different docs perform on the benchmark.
					</p>
				</Link>

				<Link
					to="/submit"
					className="group bg-terminal-surface border border-terminal-border rounded-lg p-6 hover:border-terminal-accent transition-all"
				>
					<div className="flex items-center gap-3 mb-3">
						<div className="w-10 h-10 rounded bg-terminal-accent/10 flex items-center justify-center text-terminal-accent">
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M12 20V10"></path>
								<path d="M18 20V4"></path>
								<path d="M6 20v-4"></path>
							</svg>
						</div>
						<h2 className="text-xl font-semibold text-text-primary group-hover:text-terminal-accent transition-colors">
							Submit
						</h2>
					</div>
					<p className="text-text-muted text-sm">
						Run the benchmark on your documentation using your own API key and submit results to the leaderboard.
					</p>
				</Link>
			</div>

			<div className="bg-terminal-surface border border-terminal-border rounded-lg p-6">
				<h3 className="text-lg font-semibold text-text-primary mb-4">How It Works</h3>
				<ol className="space-y-3 text-text-secondary text-sm">
					<li className="flex gap-3">
						<span className="w-6 h-6 rounded bg-terminal-accent text-black flex items-center justify-center text-xs font-bold shrink-0">1</span>
						<span>Provide your OpenRouter API key and documentation URL</span>
					</li>
					<li className="flex gap-3">
						<span className="w-6 h-6 rounded bg-terminal-accent text-black flex items-center justify-center text-xs font-bold shrink-0">2</span>
						<span>The benchmark runs a series of Jac language tests against an LLM using your documentation as context</span>
					</li>
					<li className="flex gap-3">
						<span className="w-6 h-6 rounded bg-terminal-accent text-black flex items-center justify-center text-xs font-bold shrink-0">3</span>
						<span>Results are evaluated and scored based on correctness and completeness</span>
					</li>
					<li className="flex gap-3">
						<span className="w-6 h-6 rounded bg-terminal-accent text-black flex items-center justify-center text-xs font-bold shrink-0">4</span>
						<span>Submit your score to the public leaderboard to compare with others</span>
					</li>
				</ol>
			</div>
		</div>
	);
}
