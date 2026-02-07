import time;
import json;
import:jac from models.nodes, TestDefNode, PublicTestConfigNode, BenchmarkModelNode, LeaderboardNode, UserNode, AdminEmailNode, ResultNode, RunNode, CollectionNode;
import:jac from models.edges, HasTest, HasPublicConfig, HasBenchmarkModel, HasEntry, HasUser, HasAdminEmail, HasResult, HasRun, HasCollection;
import:jac from services.evaluator, get_test_stats;

walker AdminGetPublicTests {
    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = True;
    }
    can gather with `root entry {
        public_configs: list = [];
        for pc in [->:HasPublicConfig:->(`?PublicTestConfigNode)] {
            public_configs.append({
                "test_id": pc.test_id,
                "is_public": pc.is_public,
                "added_at": pc.added_at
            });
        }

        test_details: list = [];
        public_ids: set = {pc["test_id"] for pc in public_configs if pc["is_public"]};
        total_points: int = 0;

        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.test_id in public_ids and tnode.is_active {
                test_details.append({
                    "id": tnode.test_id,
                    "level": tnode.level,
                    "category": tnode.category,
                    "points": tnode.points
                });
                total_points += tnode.points;
            }
        }

        report {
            "tests": test_details,
            "count": len(test_details),
            "total_points": total_points,
            "configs": public_configs
        };
    }
}

walker AdminSetPublicTests {
    has test_ids: list = [];

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = True;
    }
    can set_tests with `root entry {
        for pc in [->:HasPublicConfig:->(`?PublicTestConfigNode)] {
            here del--> pc;
            del pc;
        }
        for tid in self.test_ids {
            here +>:HasPublicConfig:+> PublicTestConfigNode(
                test_id=tid, is_public=True, added_at=time.time()
            );
        }
        report {"status": "success", "count": len(self.test_ids)};
    }
}

walker AdminAddPublicTest {
    has test_id: str;

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = True;
    }
    can add with `root entry {
        for pc in [->:HasPublicConfig:->(`?PublicTestConfigNode)] {
            if pc.test_id == self.test_id {
                report {"error": "Test already in public suite"};
                disengage;
            }
        }
        here +>:HasPublicConfig:+> PublicTestConfigNode(
            test_id=self.test_id, is_public=True, added_at=time.time()
        );
        report {"status": "success", "test_id": self.test_id};
    }
}

walker AdminRemovePublicTest {
    has test_id: str;

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = True;
    }
    can remove with `root entry {
        for pc in [->:HasPublicConfig:->(`?PublicTestConfigNode)] {
            if pc.test_id == self.test_id {
                here del--> pc;
                del pc;
                report {"status": "success"};
                disengage;
            }
        }
        report {"error": "Test not found in public suite"};
    }
}

walker AdminHideEntry {
    has entry_id: str;

    obj __specs__ {
        static has methods: list = ["DELETE"];
        static has auth: bool = True;
    }
    can hide with `root entry {
        for enode in [->:HasEntry:->(`?LeaderboardNode)] {
            if str(enode) == self.entry_id {
                enode.is_visible = False;
                report {"status": "success"};
                disengage;
            }
        }
        report {"error": "Entry not found"};
    }
}

walker AdminUnhideEntry {
    has entry_id: str;

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = True;
    }
    can unhide with `root entry {
        for enode in [->:HasEntry:->(`?LeaderboardNode)] {
            if str(enode) == self.entry_id {
                enode.is_visible = True;
                report {"status": "success"};
                disengage;
            }
        }
        report {"error": "Entry not found"};
    }
}

walker AdminGetStats {
    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = True;
    }
    can gather with `root entry {
        result_count: int = len([->:HasResult:->(`?ResultNode)]);
        run_count: int = len([->:HasRun:->(`?RunNode)]);
        collection_count: int = len([->:HasCollection:->(`?CollectionNode)]);
        user_count: int = len([->:HasUser:->(`?UserNode)]);
        leaderboard_count: int = len([->:HasEntry:->(`?LeaderboardNode)]);
        test_count: int = len([->:HasTest:->(`?TestDefNode)]);

        report {
            "results": result_count,
            "runs": run_count,
            "collections": collection_count,
            "users": user_count,
            "leaderboard_entries": leaderboard_count,
            "test_definitions": test_count
        };
    }
}

walker AdminListUsers {
    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = True;
    }
    can gather with `root entry {
        users: list = [];
        for unode in [->:HasUser:->(`?UserNode)] {
            users.append({
                "id": str(unode),
                "email": unode.email,
                "name": unode.name,
                "github_id": unode.github_id,
                "is_admin": unode.is_admin,
                "created_at": unode.created_at,
                "last_login_at": unode.last_login_at
            });
        }
        report {"users": users};
    }
}

walker AdminSetAdmin {
    has user_id: str;
    has is_admin: bool;

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = True;
    }
    can set_admin with `root entry {
        for unode in [->:HasUser:->(`?UserNode)] {
            if str(unode) == self.user_id {
                unode.is_admin = self.is_admin;
                report {"status": "success", "user_id": self.user_id, "is_admin": self.is_admin};
                disengage;
            }
        }
        report {"error": "User not found"};
    }
}

walker AdminListEmails {
    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = True;
    }
    can gather with `root entry {
        emails: list = [];
        for ae in [->:HasAdminEmail:->(`?AdminEmailNode)] {
            emails.append({
                "id": str(ae),
                "email": ae.email,
                "added_at": ae.added_at
            });
        }
        report {"emails": emails};
    }
}

walker AdminAddEmail {
    has email: str;

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = True;
    }
    can add with `root entry {
        for ae in [->:HasAdminEmail:->(`?AdminEmailNode)] {
            if ae.email.lower() == self.email.lower() {
                report {"error": "Email already exists"};
                disengage;
            }
        }
        here +>:HasAdminEmail:+> AdminEmailNode(email=self.email, added_at=time.time());
        report {"status": "success", "email": self.email};
    }
}

walker AdminRemoveEmail {
    has email_id: str;

    obj __specs__ {
        static has methods: list = ["DELETE"];
        static has auth: bool = True;
    }
    can remove with `root entry {
        for ae in [->:HasAdminEmail:->(`?AdminEmailNode)] {
            if str(ae) == self.email_id {
                here del--> ae;
                del ae;
                report {"status": "success"};
                disengage;
            }
        }
        report {"error": "Email not found"};
    }
}

walker AdminListModels {
    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = True;
    }
    can gather with `root entry {
        models: list = [];
        for bm in [->:HasBenchmarkModel:->(`?BenchmarkModelNode)] {
            models.append({
                "id": str(bm),
                "model_id": bm.model_id,
                "display_name": bm.display_name,
                "is_active": bm.is_active,
                "priority": bm.priority,
                "added_at": bm.added_at
            });
        }
        models.sort(key=lambda x: -x["priority"]);
        report {"models": models};
    }
}

walker AdminAddModel {
    has model_id: str;
    has display_name: str = "";
    has priority: int = 0;

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = True;
    }
    can add with `root entry {
        for bm in [->:HasBenchmarkModel:->(`?BenchmarkModelNode)] {
            if bm.model_id == self.model_id {
                report {"error": "Model already exists"};
                disengage;
            }
        }
        if not self.display_name {
            self.display_name = self.model_id.split("/")[-1];
        }
        here +>:HasBenchmarkModel:+> BenchmarkModelNode(
            model_id=self.model_id, display_name=self.display_name,
            priority=self.priority, is_active=True, added_at=time.time()
        );
        report {"status": "success", "model_id": self.model_id};
    }
}

walker AdminRemoveModel {
    has model_id: str;

    obj __specs__ {
        static has methods: list = ["DELETE"];
        static has auth: bool = True;
    }
    can remove with `root entry {
        for bm in [->:HasBenchmarkModel:->(`?BenchmarkModelNode)] {
            if bm.model_id == self.model_id {
                here del--> bm;
                del bm;
                report {"status": "success"};
                disengage;
            }
        }
        report {"error": "Model not found"};
    }
}

walker AdminToggleModel {
    has model_id: str;
    has is_active: bool;

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = True;
    }
    can toggle with `root entry {
        for bm in [->:HasBenchmarkModel:->(`?BenchmarkModelNode)] {
            if bm.model_id == self.model_id {
                bm.is_active = self.is_active;
                report {"status": "success", "model_id": self.model_id, "is_active": self.is_active};
                disengage;
            }
        }
        report {"error": "Model not found"};
    }
}

walker AdminGetTests {
    has level: int | None = None;
    has category: str = "";
    has test_type: str = "";
    has search: str = "";
    has include_inactive: bool = False;

    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = True;
    }
    can gather with `root entry {
        tests: list = [];
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if not self.include_inactive and not tnode.is_active {
                continue;
            }
            if self.level is not None and tnode.level != self.level {
                continue;
            }
            if self.category and tnode.category != self.category {
                continue;
            }
            if self.test_type and tnode.test_type != self.test_type {
                continue;
            }
            if self.search and self.search.lower() not in tnode.task.lower() and self.search.lower() not in tnode.test_id.lower() {
                continue;
            }

            tests.append({
                "id": tnode.test_id,
                "level": tnode.level,
                "category": tnode.category,
                "task": tnode.task,
                "points": tnode.points,
                "type": tnode.test_type,
                "required_elements": tnode.required_elements,
                "forbidden_elements": tnode.forbidden_elements,
                "broken_code": tnode.broken_code,
                "partial_code": tnode.partial_code,
                "python_code": tnode.python_code,
                "test_harness": tnode.test_harness,
                "error_hint": tnode.error_hint,
                "completion_hint": tnode.completion_hint,
                "is_active": tnode.is_active,
                "created_at": tnode.created_at,
                "updated_at": tnode.updated_at
            });
        }
        tests.sort(key=lambda x: (x["level"], x["category"], x["id"]));
        report {"tests": tests, "count": len(tests)};
    }
}

walker AdminCreateTest {
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

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = True;
    }
    can create with `root entry {
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.test_id == self.test_id {
                report {"error": f"Test '{self.test_id}' already exists"};
                disengage;
            }
        }

        here +>:HasTest:+> TestDefNode(
            test_id=self.test_id, level=self.level, category=self.category,
            task=self.task, points=self.points, test_type=self.test_type,
            required_elements=self.required_elements,
            forbidden_elements=self.forbidden_elements,
            broken_code=self.broken_code, partial_code=self.partial_code,
            python_code=self.python_code, test_harness=self.test_harness,
            error_hint=self.error_hint, completion_hint=self.completion_hint,
            is_active=True, created_at=time.time()
        );
        report {"status": "success", "test_id": self.test_id};
    }
}

walker AdminGetTest {
    has test_id: str;

    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = True;
    }
    can fetch with `root entry {
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.test_id == self.test_id {
                report {
                    "id": tnode.test_id,
                    "level": tnode.level,
                    "category": tnode.category,
                    "task": tnode.task,
                    "points": tnode.points,
                    "type": tnode.test_type,
                    "required_elements": tnode.required_elements,
                    "forbidden_elements": tnode.forbidden_elements,
                    "broken_code": tnode.broken_code,
                    "partial_code": tnode.partial_code,
                    "python_code": tnode.python_code,
                    "test_harness": tnode.test_harness,
                    "error_hint": tnode.error_hint,
                    "completion_hint": tnode.completion_hint,
                    "is_active": tnode.is_active,
                    "created_at": tnode.created_at,
                    "updated_at": tnode.updated_at
                };
                disengage;
            }
        }
        report {"error": "Test not found"};
    }
}

walker AdminUpdateTest {
    has test_id: str;
    has updates: dict = {};

    obj __specs__ {
        static has methods: list = ["PUT"];
        static has auth: bool = True;
    }
    can update with `root entry {
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.test_id == self.test_id {
                if "level" in self.updates { tnode.level = self.updates["level"]; }
                if "category" in self.updates { tnode.category = self.updates["category"]; }
                if "task" in self.updates { tnode.task = self.updates["task"]; }
                if "points" in self.updates { tnode.points = self.updates["points"]; }
                if "test_type" in self.updates { tnode.test_type = self.updates["test_type"]; }
                if "required_elements" in self.updates { tnode.required_elements = self.updates["required_elements"]; }
                if "forbidden_elements" in self.updates { tnode.forbidden_elements = self.updates["forbidden_elements"]; }
                if "broken_code" in self.updates { tnode.broken_code = self.updates["broken_code"]; }
                if "partial_code" in self.updates { tnode.partial_code = self.updates["partial_code"]; }
                if "python_code" in self.updates { tnode.python_code = self.updates["python_code"]; }
                if "test_harness" in self.updates { tnode.test_harness = self.updates["test_harness"]; }
                if "error_hint" in self.updates { tnode.error_hint = self.updates["error_hint"]; }
                if "completion_hint" in self.updates { tnode.completion_hint = self.updates["completion_hint"]; }
                tnode.updated_at = time.time();
                report {"status": "success", "test_id": self.test_id};
                disengage;
            }
        }
        report {"error": "Test not found"};
    }
}

walker AdminDeleteTest {
    has test_id: str;

    obj __specs__ {
        static has methods: list = ["DELETE"];
        static has auth: bool = True;
    }
    can soft_delete with `root entry {
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.test_id == self.test_id {
                tnode.is_active = False;
                tnode.updated_at = time.time();
                report {"status": "success", "test_id": self.test_id};
                disengage;
            }
        }
        report {"error": "Test not found"};
    }
}

walker AdminRestoreTest {
    has test_id: str;

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = True;
    }
    can restore with `root entry {
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.test_id == self.test_id {
                tnode.is_active = True;
                tnode.updated_at = time.time();
                report {"status": "success", "test_id": self.test_id};
                disengage;
            }
        }
        report {"error": "Test not found"};
    }
}

walker AdminHardDeleteTest {
    has test_id: str;

    obj __specs__ {
        static has methods: list = ["DELETE"];
        static has auth: bool = True;
    }
    can hard_delete with `root entry {
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.test_id == self.test_id {
                here del--> tnode;
                del tnode;
                report {"status": "success", "test_id": self.test_id};
                disengage;
            }
        }
        report {"error": "Test not found"};
    }
}

walker AdminBulkCreate {
    has tests: list = [];

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = True;
    }
    can bulk_create with `root entry {
        existing_ids: set = set();
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            existing_ids.add(tnode.test_id);
        }

        created: int = 0;
        skipped: int = 0;
        for test in self.tests {
            tid: str = test.get("id", "");
            if tid in existing_ids {
                skipped += 1;
                continue;
            }
            here +>:HasTest:+> TestDefNode(
                test_id=tid,
                level=test.get("level", 1),
                category=test.get("category", ""),
                task=test.get("task", ""),
                points=test.get("points", 10),
                test_type=test.get("type", "generate"),
                required_elements=test.get("required_elements", []),
                forbidden_elements=test.get("forbidden_elements", []),
                broken_code=test.get("broken_code", ""),
                partial_code=test.get("partial_code", ""),
                python_code=test.get("python_code", ""),
                test_harness=test.get("test_harness", ""),
                error_hint=test.get("error_hint", ""),
                completion_hint=test.get("completion_hint", ""),
                is_active=True,
                created_at=time.time()
            );
            created += 1;
        }
        report {"status": "success", "created": created, "skipped": skipped};
    }
}

walker AdminExportTests {
    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = True;
    }
    can export with `root entry {
        tests: list = [];
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            test_data: dict = {
                "id": tnode.test_id,
                "level": tnode.level,
                "category": tnode.category,
                "task": tnode.task,
                "points": tnode.points,
                "type": tnode.test_type,
                "required_elements": tnode.required_elements
            };
            if tnode.forbidden_elements { test_data["forbidden_elements"] = tnode.forbidden_elements; }
            if tnode.broken_code { test_data["broken_code"] = tnode.broken_code; }
            if tnode.partial_code { test_data["partial_code"] = tnode.partial_code; }
            if tnode.python_code { test_data["python_code"] = tnode.python_code; }
            if tnode.test_harness { test_data["test_harness"] = tnode.test_harness; }
            if tnode.error_hint { test_data["error_hint"] = tnode.error_hint; }
            if tnode.completion_hint { test_data["completion_hint"] = tnode.completion_hint; }
            tests.append(test_data);
        }
        tests.sort(key=lambda x: (x["level"], x["category"], x["id"]));
        report tests;
    }
}

walker AdminImportTests {
    has tests: list = [];

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = True;
    }
    can import_tests with `root entry {
        existing_ids: set = set();
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            existing_ids.add(tnode.test_id);
        }

        imported: int = 0;
        updated: int = 0;
        for test in self.tests {
            tid: str = test.get("id", "");
            if tid in existing_ids {
                for tnode in [->:HasTest:->(`?TestDefNode)] {
                    if tnode.test_id == tid {
                        tnode.level = test.get("level", tnode.level);
                        tnode.category = test.get("category", tnode.category);
                        tnode.task = test.get("task", tnode.task);
                        tnode.points = test.get("points", tnode.points);
                        tnode.test_type = test.get("type", tnode.test_type);
                        tnode.required_elements = test.get("required_elements", tnode.required_elements);
                        tnode.forbidden_elements = test.get("forbidden_elements", tnode.forbidden_elements);
                        tnode.broken_code = test.get("broken_code", tnode.broken_code);
                        tnode.partial_code = test.get("partial_code", tnode.partial_code);
                        tnode.python_code = test.get("python_code", tnode.python_code);
                        tnode.test_harness = test.get("test_harness", tnode.test_harness);
                        tnode.error_hint = test.get("error_hint", tnode.error_hint);
                        tnode.completion_hint = test.get("completion_hint", tnode.completion_hint);
                        tnode.updated_at = time.time();
                        updated += 1;
                        break;
                    }
                }
            } else {
                here +>:HasTest:+> TestDefNode(
                    test_id=tid,
                    level=test.get("level", 1),
                    category=test.get("category", ""),
                    task=test.get("task", ""),
                    points=test.get("points", 10),
                    test_type=test.get("type", "generate"),
                    required_elements=test.get("required_elements", []),
                    forbidden_elements=test.get("forbidden_elements", []),
                    broken_code=test.get("broken_code", ""),
                    partial_code=test.get("partial_code", ""),
                    python_code=test.get("python_code", ""),
                    test_harness=test.get("test_harness", ""),
                    error_hint=test.get("error_hint", ""),
                    completion_hint=test.get("completion_hint", ""),
                    is_active=True,
                    created_at=time.time()
                );
                imported += 1;
            }
        }
        report {"status": "success", "imported": imported, "updated": updated};
    }
}

walker AdminTestStats {
    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = True;
    }
    can gather with `root entry {
        tests: list = [];
        for tnode in [->:HasTest:->(`?TestDefNode)] {
            if tnode.is_active {
                tests.append({
                    "id": tnode.test_id,
                    "level": tnode.level,
                    "category": tnode.category,
                    "points": tnode.points
                });
            }
        }
        stats: dict = get_test_stats(tests);
        report stats;
    }
}
