node CollectionNode {
    has name: str;
    has description: str = "";
    has created_at: float = 0.0;
}

node ResultNode {
    has run_id: str;
    has model: str;
    has model_id: str;
    has variant: str;
    has temperature: float = 0.1;
    has max_tokens: int = 16000;
    has total_tests: int = 0;
    has batch_size: int = 45;
    has num_batches: int = 1;
    has responses: dict = {};
    has run_metadata: dict = {};
    has evaluation_results: dict = {};
    has total_score: float = 0.0;
    has max_score: float = 0.0;
    has percentage: float = 0.0;
    has created_at: float = 0.0;
    has evaluated_at: float = 0.0;
    has status: str = "completed";
    has evaluation_status: str = "pending";
}

node RunNode {
    has run_id: str;
    has model: str;
    has variant: str;
    has status: str = "running";
    has progress: str = "";
    has result_id: int = 0;
    has started_at: float = 0.0;
    has completed_at: float = 0.0;
    has error_message: str = "";
}

node VariantNode {
    has variant_name: str;
    has url: str;
}

node UserNode {
    has email: str;
    has name: str = "";
    has github_id: str;
    has is_admin: bool = False;
    has created_at: float = 0.0;
    has last_login_at: float = 0.0;
}

node TokenNode {
    has token_hash: str;
    has name: str;
    has is_admin: bool = False;
    has is_active: bool = True;
    has created_at: float = 0.0;
    has expires_at: float = 0.0;
    has last_used_at: float = 0.0;
}

node AdminEmailNode {
    has email: str;
    has added_at: float = 0.0;
    has added_by: int = 0;
}

node PublicTestConfigNode {
    has test_id: str;
    has is_public: bool = True;
    has added_at: float = 0.0;
    has added_by: int = 0;
}

node BenchmarkModelNode {
    has model_id: str;
    has display_name: str = "";
    has is_active: bool = True;
    has priority: int = 0;
    has added_at: float = 0.0;
    has added_by: int = 0;
}

node LeaderboardNode {
    has documentation_name: str;
    has documentation_url: str;
    has submitter_email: str = "";
    has total_score: float = 0.0;
    has max_score: float = 0.0;
    has percentage: float = 0.0;
    has benchmark_result_id: int = 0;
    has evaluation_snapshot: dict = {};
    has model_used: str = "";
    has submitted_at: float = 0.0;
    has is_visible: bool = True;
    has user_id: int = 0;
}

node TestDefNode {
    has test_id: str;
    has level: int;
    has category: str;
    has task: str;
    has points: int = 10;
    has test_type: str = "generate";
    has required_elements: list = [];
    has forbidden_elements: list = [];
    has broken_code: str = "";
    has partial_code: str = "";
    has python_code: str = "";
    has test_harness: str = "";
    has error_hint: str = "";
    has completion_hint: str = "";
    has is_active: bool = True;
    has created_at: float = 0.0;
    has updated_at: float = 0.0;
    has created_by: int = 0;
}
