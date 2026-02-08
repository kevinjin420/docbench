def:pub HomeView() -> any {
    return <div className="max-w-4xl mx-auto py-16">
        <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-text-primary mb-4">
                Jaseci <span className="text-terminal-accent">DocBench</span>
            </h1>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto">
                Benchmark LLM models on Jac programming language code generation.
                Submit your documentation and see how well AI understands it.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            <a href="/leaderboard" className="bg-terminal-surface border border-terminal-border rounded-lg p-8 card-hover block">
                <h3 className="text-xl font-semibold text-text-primary mb-2">Leaderboard</h3>
                <p className="text-text-secondary">
                    See how different documentation variants rank across multiple LLM models.
                </p>
            </a>
            <a href="/submit" className="bg-terminal-surface border border-terminal-border rounded-lg p-8 card-hover block">
                <h3 className="text-xl font-semibold text-text-primary mb-2">Submit Documentation</h3>
                <p className="text-text-secondary">
                    Submit your Jac documentation for benchmarking against the public test suite.
                </p>
            </a>
        </div>

        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-8">
            <h2 className="text-2xl font-semibold text-text-primary mb-8 text-center">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-terminal-accent-muted flex items-center justify-center mx-auto mb-4">
                        <span className="text-terminal-accent font-bold text-lg">1</span>
                    </div>
                    <h4 className="text-text-primary font-medium mb-2">Provide Documentation</h4>
                    <p className="text-text-muted text-sm">Submit a URL to your Jac language documentation</p>
                </div>
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-terminal-accent-muted flex items-center justify-center mx-auto mb-4">
                        <span className="text-terminal-accent font-bold text-lg">2</span>
                    </div>
                    <h4 className="text-text-primary font-medium mb-2">Run Benchmark</h4>
                    <p className="text-text-muted text-sm">LLMs generate Jac code based on your docs</p>
                </div>
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-terminal-accent-muted flex items-center justify-center mx-auto mb-4">
                        <span className="text-terminal-accent font-bold text-lg">3</span>
                    </div>
                    <h4 className="text-text-primary font-medium mb-2">Evaluate</h4>
                    <p className="text-text-muted text-sm">Code is checked for syntax, elements, and correctness</p>
                </div>
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-terminal-accent-muted flex items-center justify-center mx-auto mb-4">
                        <span className="text-terminal-accent font-bold text-lg">4</span>
                    </div>
                    <h4 className="text-text-primary font-medium mb-2">Compete</h4>
                    <p className="text-text-muted text-sm">Submit to the leaderboard and compare results</p>
                </div>
            </div>
        </div>
    </div>;
}
