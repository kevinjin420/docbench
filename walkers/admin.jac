import os;
import from services.evaluator { EvaluatorService }
import from database {
    PublicTestConfigService, PublicBenchmarkModelService,
    LeaderboardService, BenchmarkResultService,
    UserService, AdminEmailService, TestDefinitionService
}
import from utils.auth { require_admin_check }


walker :pub AdminGetPublicTests {
    has auth_token: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can get_config with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        config = PublicTestConfigService.get_config();
        public_ids = set(PublicTestConfigService.get_public_test_ids());
        evaluator = EvaluatorService();
        all_tests = [
            {
                "id": t["id"],
                "level": t.get("level", 1),
                "category": t.get("category", "Unknown"),
                "task": t.get("task", ""),
                "points": t.get("points", 0),
                "is_public": t["id"] in public_ids
            }
            for t in evaluator.tests
        ];
        report {
            "config": config,
            "public_test_ids": list(public_ids),
            "public_count": len(public_ids),
            "total_available": len(all_tests),
            "total_points": sum(t["points"] for t in all_tests),
            "public_points": sum(t["points"] for t in all_tests if t["is_public"]),
            "tests": all_tests
        };
    }
}


walker :pub AdminSetPublicTests {
    has auth_token: str = "";
    has test_ids: list = [];
    obj __specs__ { static has methods: list = ["post"]; }
    can set_tests with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        if not isinstance(self.test_ids, list) {
            report {"error": "test_ids must be an array"};
            disengage;
        }
        evaluator = EvaluatorService();
        valid_ids = {t["id"] for t in evaluator.tests};
        invalid_ids = [tid for tid in self.test_ids if tid not in valid_ids];
        if invalid_ids {
            report {"error": f"Invalid test IDs: {invalid_ids}", "valid_ids": list(valid_ids)};
            disengage;
        }
        user_id = user.get("id") if user else None;
        PublicTestConfigService.set_public_tests(self.test_ids, added_by=user_id);
        report {"success": True, "public_test_count": len(self.test_ids), "test_ids": self.test_ids};
    }
}


walker :pub AdminAddPublicTest {
    has auth_token: str = "";
    has test_id: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can add_test with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        if not self.test_id {
            report {"error": "test_id is required"};
            disengage;
        }
        evaluator = EvaluatorService();
        valid_ids = {t["id"] for t in evaluator.tests};
        if self.test_id not in valid_ids {
            report {"error": f"Invalid test ID: {self.test_id}"};
            disengage;
        }
        user_id = user.get("id") if user else None;
        PublicTestConfigService.add_public_test(self.test_id, added_by=user_id);
        report {"success": True, "test_id": self.test_id};
    }
}


walker :pub AdminRemovePublicTest {
    has auth_token: str = "";
    has test_id: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can remove_test with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        if not self.test_id {
            report {"error": "test_id is required"};
            disengage;
        }
        success = PublicTestConfigService.remove_public_test(self.test_id);
        report {"success": success, "test_id": self.test_id};
    }
}


walker :pub AdminHideLeaderboardEntry {
    has auth_token: str = "";
    has entry_id: int = 0;
    obj __specs__ { static has methods: list = ["post"]; }
    can hide with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        success = LeaderboardService.hide_entry(self.entry_id);
        if success {
            report {"success": True, "message": "Entry hidden"};
        } else {
            report {"error": "Entry not found"};
        }
    }
}


walker :pub AdminUnhideLeaderboardEntry {
    has auth_token: str = "";
    has entry_id: int = 0;
    obj __specs__ { static has methods: list = ["post"]; }
    can unhide with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        success = LeaderboardService.unhide_entry(self.entry_id);
        if success {
            report {"success": True, "message": "Entry unhidden"};
        } else {
            report {"error": "Entry not found"};
        }
    }
}


walker :pub AdminGetStats {
    has auth_token: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can get_stats with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        benchmark_stats = BenchmarkResultService.get_stats();
        leaderboard_count = LeaderboardService.get_total_count();
        public_test_count = len(PublicTestConfigService.get_public_test_ids());
        report {
            "benchmarks": benchmark_stats,
            "leaderboard_entries": leaderboard_count,
            "public_tests_configured": public_test_count
        };
    }
}


walker :pub AdminListUsers {
    has auth_token: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can list_users with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        users = UserService.list_all(limit=500);
        admin_emails = os.getenv("ADMIN_EMAILS", "");
        admin_email_list = [e.strip().lower() for e in admin_emails.split(",") if e.strip()];
        report {"users": users, "admin_emails_env": admin_email_list};
    }
}


walker :pub AdminSetUserAdmin {
    has auth_token: str = "";
    has user_id: int = 0;
    has is_admin: bool = False;
    obj __specs__ { static has methods: list = ["post"]; }
    can set_admin with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        success = UserService.set_admin(self.user_id, self.is_admin);
        if success {
            report {"success": True, "user_id": self.user_id, "is_admin": self.is_admin};
        } else {
            report {"error": "User not found"};
        }
    }
}


walker :pub AdminListAdminEmails {
    has auth_token: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can list_emails with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        emails = AdminEmailService.list_all();
        admin_emails_env = os.getenv("ADMIN_EMAILS", "");
        env_list = [e.strip().lower() for e in admin_emails_env.split(",") if e.strip()];
        report {"emails": emails, "env_emails": env_list};
    }
}


walker :pub AdminAddAdminEmail {
    has auth_token: str = "";
    has email: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can add_email with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        if not self.email.strip() {
            report {"error": "email is required"};
            disengage;
        }
        added_by = user.get("id") if user else None;
        result = AdminEmailService.add(self.email.strip(), added_by=added_by);
        if result.get("already_exists") {
            report {"success": True, "email": result, "message": "Email already exists"};
        } else {
            report {"success": True, "email": result};
        }
    }
}


walker :pub AdminRemoveAdminEmail {
    has auth_token: str = "";
    has email_id: int = 0;
    obj __specs__ { static has methods: list = ["post"]; }
    can remove_email with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        success = AdminEmailService.remove_by_id(self.email_id);
        if success {
            report {"success": True, "message": "Email removed"};
        } else {
            report {"error": "Email not found"};
        }
    }
}


walker :pub AdminGetBenchmarkModels {
    has auth_token: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can get_models with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        models = PublicBenchmarkModelService.get_all_models();
        active_models = [m for m in models if m["is_active"]];
        report {"models": models, "active_count": len(active_models)};
    }
}


walker :pub AdminAddBenchmarkModel {
    has auth_token: str = "";
    has model_id: str = "";
    has display_name: str = "";
    has priority: int = 0;
    obj __specs__ { static has methods: list = ["post"]; }
    can add_model with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        if not self.model_id.strip() {
            report {"error": "model_id is required"};
            disengage;
        }
        added_by = user.get("id") if user else None;
        result = PublicBenchmarkModelService.add_model(
            model_id=self.model_id.strip(),
            display_name=(self.display_name.strip()) if self.display_name.strip() else (None),
            priority=self.priority,
            added_by=added_by
        );
        report {"success": True, "model": result};
    }
}


walker :pub AdminRemoveBenchmarkModel {
    has auth_token: str = "";
    has model_id: int = 0;
    obj __specs__ { static has methods: list = ["post"]; }
    can remove_model with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        success = PublicBenchmarkModelService.remove_model(self.model_id);
        if success {
            report {"success": True, "message": "Model removed"};
        } else {
            report {"error": "Model not found"};
        }
    }
}


walker :pub AdminSetBenchmarkModelActive {
    has auth_token: str = "";
    has model_id: int = 0;
    has is_active: bool = True;
    obj __specs__ { static has methods: list = ["post"]; }
    can set_active with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        success = PublicBenchmarkModelService.set_active(self.model_id, self.is_active);
        if success {
            report {"success": True, "is_active": self.is_active};
        } else {
            report {"error": "Model not found"};
        }
    }
}


walker :pub AdminGetTestDefinitions {
    has auth_token: str = "";
    has level: int = -1;
    has category: str = "";
    has test_type: str = "";
    has search: str = "";
    has include_inactive: bool = False;
    obj __specs__ { static has methods: list = ["post"]; }
    can get_tests with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        if self.search {
            tests = TestDefinitionService.search(self.search, include_inactive=self.include_inactive);
        } elif self.level >= 0 {
            tests = TestDefinitionService.get_by_level(self.level, include_inactive=self.include_inactive);
        } elif self.category {
            tests = TestDefinitionService.get_by_category(self.category, include_inactive=self.include_inactive);
        } else {
            tests = TestDefinitionService.get_all_full(include_inactive=self.include_inactive);
        }
        if self.test_type {
            tests = [t for t in tests if t.get("type", "generate") == self.test_type];
        }
        report {"tests": tests, "total": len(tests)};
    }
}


walker :pub AdminCreateTestDefinition {
    has auth_token: str = "";
    has id: str = "";
    has level: int = 1;
    has category: str = "";
    has task: str = "";
    has required_elements: list = [];
    has points: int = 10;
    has test_type: str = "generate";
    has forbidden_elements: list = [];
    has broken_code: str = "";
    has partial_code: str = "";
    has python_code: str = "";
    has test_harness: str = "";
    has error_hint: str = "";
    has completion_hint: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can create_test with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        if not self.id or not self.category or not self.task or not self.required_elements {
            report {"error": "id, level, category, task, and required_elements are required"};
            disengage;
        }
        user_id = user.get("id") if user else None;
        try {
            test = TestDefinitionService.create(
                test_id=self.id,
                level=self.level,
                category=self.category,
                task=self.task,
                required_elements=self.required_elements,
                points=self.points,
                test_type=self.test_type,
                forbidden_elements=self.forbidden_elements,
                broken_code=self.broken_code,
                partial_code=self.partial_code,
                python_code=self.python_code,
                test_harness=self.test_harness,
                error_hint=self.error_hint,
                completion_hint=self.completion_hint,
                created_by=user_id
            );
            report {"success": True, "test": test};
        } except ValueError as e {
            report {"error": str(e)};
        }
    }
}


walker :pub AdminGetTestDefinition {
    has auth_token: str = "";
    has test_id: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can get_test with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        test = TestDefinitionService.get_by_test_id(self.test_id);
        if test {
            report {"test": test};
        } else {
            report {"error": "Test not found"};
        }
    }
}


walker :pub AdminUpdateTestDefinition {
    has auth_token: str = "";
    has test_id: str = "";
    has level: int = -1;
    has category: str = "__unset__";
    has task: str = "__unset__";
    has required_elements: list = [];
    has points: int = -1;
    has test_type: str = "__unset__";
    has forbidden_elements: list = [];
    has broken_code: str = "__unset__";
    has partial_code: str = "__unset__";
    has python_code: str = "__unset__";
    has test_harness: str = "__unset__";
    has error_hint: str = "__unset__";
    has completion_hint: str = "__unset__";
    has is_active: int = -1;
    obj __specs__ { static has methods: list = ["post"]; }
    can update_test with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        if not self.test_id {
            report {"error": "test_id is required"};
            disengage;
        }
        update_data = {};
        if self.level >= 0 { update_data["level"] = self.level; }
        if self.category != "__unset__" { update_data["category"] = self.category; }
        if self.task != "__unset__" { update_data["task"] = self.task; }
        if self.required_elements { update_data["required_elements"] = self.required_elements; }
        if self.points >= 0 { update_data["points"] = self.points; }
        if self.test_type != "__unset__" { update_data["test_type"] = self.test_type; }
        if self.forbidden_elements { update_data["forbidden_elements"] = self.forbidden_elements; }
        if self.broken_code != "__unset__" { update_data["broken_code"] = self.broken_code; }
        if self.partial_code != "__unset__" { update_data["partial_code"] = self.partial_code; }
        if self.python_code != "__unset__" { update_data["python_code"] = self.python_code; }
        if self.test_harness != "__unset__" { update_data["test_harness"] = self.test_harness; }
        if self.error_hint != "__unset__" { update_data["error_hint"] = self.error_hint; }
        if self.completion_hint != "__unset__" { update_data["completion_hint"] = self.completion_hint; }
        if self.is_active >= 0 { update_data["is_active"] = (True) if self.is_active == 1 else (False); }
        if not update_data {
            report {"error": "No valid fields to update"};
            disengage;
        }
        result = TestDefinitionService.update(self.test_id, **update_data);
        if result {
            report {"success": True, "test": result};
        } else {
            report {"error": "Test not found"};
        }
    }
}


walker :pub AdminDeleteTestDefinition {
    has auth_token: str = "";
    has test_id: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can delete_test with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        success = TestDefinitionService.delete(self.test_id);
        if success {
            report {"success": True, "message": "Test deactivated"};
        } else {
            report {"error": "Test not found"};
        }
    }
}


walker :pub AdminRestoreTestDefinition {
    has auth_token: str = "";
    has test_id: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can restore_test with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        success = TestDefinitionService.restore(self.test_id);
        if success {
            report {"success": True, "message": "Test restored"};
        } else {
            report {"error": "Test not found"};
        }
    }
}


walker :pub AdminHardDeleteTestDefinition {
    has auth_token: str = "";
    has test_id: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can hard_delete with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        success = TestDefinitionService.hard_delete(self.test_id);
        if success {
            report {"success": True, "message": "Test permanently deleted"};
        } else {
            report {"error": "Test not found"};
        }
    }
}


walker :pub AdminBulkCreateTests {
    has auth_token: str = "";
    has tests: list = [];
    obj __specs__ { static has methods: list = ["post"]; }
    can bulk_create with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        if not self.tests {
            report {"error": "No tests provided"};
            disengage;
        }
        user_id = user.get("id") if user else None;
        result = TestDefinitionService.bulk_create(self.tests, created_by=user_id);
        report {
            "success": True,
            "created": result["created"],
            "updated": result["updated"],
            "errors": result["errors"]
        };
    }
}


walker :pub AdminExportTests {
    has auth_token: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can export_tests with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        tests = TestDefinitionService.export_all();
        report tests;
    }
}


walker :pub AdminImportTests {
    has auth_token: str = "";
    has tests: list = [];
    obj __specs__ { static has methods: list = ["post"]; }
    can import_tests with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        if not self.tests {
            report {"error": "No data provided"};
            disengage;
        }
        user_id = user.get("id") if user else None;
        result = TestDefinitionService.bulk_create(self.tests, created_by=user_id);
        report {
            "success": True,
            "created": result["created"],
            "updated": result["updated"],
            "errors": result["errors"]
        };
    }
}


walker :pub AdminGetTestStats {
    has auth_token: str = "";
    obj __specs__ { static has methods: list = ["post"]; }
    can get_stats with Root entry {
        (user, err, code) = require_admin_check(self.auth_token);
        if err { report err; disengage; }
        stats = TestDefinitionService.get_stats();
        report stats;
    }
}
