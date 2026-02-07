import json;

include:jac from models.nodes, TestDefNode, AdminEmailNode, BenchmarkModelNode, PublicTestConfigNode;
include:jac from models.edges, HasTest, HasAdminEmail, HasBenchmarkModel, HasPublicConfig;

walker SeedTests {
    """Load test definitions from tests.json into graph nodes."""
    has file_path: str = "tests.json";

    can seed with `root entry {
        f: any = file.open(self.file_path, "r");
        content: str = f.read();
        f.close();
        tests: list = json.loads(content);
        count: int = 0;

        for t in tests {
            node_ref: any = (here +>: HasTest() :+> TestDefNode(
                test_id=t.get("test_id", ""),
                level=t.get("level", "L1"),
                category=t.get("category", ""),
                task=t.get("task", ""),
                prompt=t.get("prompt", ""),
                reference_code=t.get("reference_code", ""),
                required_elements=t.get("required_elements", []),
                forbidden_elements=t.get("forbidden_elements", []),
                test_harness=t.get("test_harness", ""),
                points=t.get("points", 1),
                version=t.get("version", 1),
                deleted=False
            ))[0];
            count += 1;
        }
        report {"seeded": count};
    }
}

walker SeedAdminEmails {
    """Seed default admin emails."""
    has emails: list = [];

    can seed with `root entry {
        for email in self.emails {
            here +>: HasAdminEmail() :+> AdminEmailNode(email=email);
        }
        report {"seeded": len(self.emails)};
    }
}

walker SeedBenchmarkModels {
    """Seed default public benchmark models."""
    has models: list = [
        {"model_id": "anthropic/claude-sonnet-4", "display_name": "Claude Sonnet 4"},
        {"model_id": "openai/gpt-4o", "display_name": "GPT-4o"},
        {"model_id": "google/gemini-2.0-flash-001", "display_name": "Gemini 2.0 Flash"}
    ];

    can seed with `root entry {
        config_nodes: list = here +>: HasPublicConfig() :+> PublicTestConfigNode();
        config: any = config_nodes[0];

        for m in self.models {
            here +>: HasBenchmarkModel() :+> BenchmarkModelNode(
                model_id=m["model_id"],
                display_name=m["display_name"],
                active=True
            );
        }
        report {"seeded": len(self.models)};
    }
}

with entry {
    print("Seeding test definitions...");
    result: any = root spawn SeedTests(file_path="tests.json");
    print(f"Seeded {result.reports[0]['seeded']} tests.");

    print("Seeding benchmark models...");
    result2: any = root spawn SeedBenchmarkModels();
    print(f"Seeded {result2.reports[0]['seeded']} models.");

    print("Seed complete.");
}
