import csv;
import io;
import json;
import from datetime { datetime }
import from pathlib { Path }
import from database { get_db, BenchmarkResult }
import from database { BenchmarkResultService }
import from utils.auth { require_auth_check }


def _format_result(result: dict, collection: str | None = None) -> dict {
    responses_json = json.dumps(result.get("responses", {}));
    return {
        "name": result["run_id"],
        "path": f"db/{result['run_id']}",
        "size": len(responses_json.encode("utf-8")),
        "modified": result["created_at"],
        "metadata": {
            "model": result["model"],
            "model_full": result["model"],
            "variant": result["variant"],
            "total_tests": str(result.get("total_tests", 0)),
            "batch_size": result.get("batch_size"),
            "num_batches": result.get("num_batches")
        },
        "db_id": result["id"],
        "run_id": result["run_id"],
        "score": result.get("total_score"),
        "max_score": result.get("max_score"),
        "percentage": result.get("percentage"),
        "collection": (collection) if collection else (result.get("collection")),
        "evaluation_status": result.get("evaluation_status", "completed")
    };
}


walker :pub GetTestFiles {
    has auth_token: str = "";
    has limit: int = 50;

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can get_files with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        with get_db() as session {
            query = session.query(BenchmarkResult).filter(
                BenchmarkResult.collection_id.is_(None)
            ).order_by(BenchmarkResult.created_at.desc()).limit(self.limit);
            results = [
                {
                    "id": r.id,
                    "run_id": r.run_id,
                    "model": r.model,
                    "variant": r.variant,
                    "total_tests": r.total_tests,
                    "batch_size": r.batch_size,
                    "num_batches": r.num_batches,
                    "total_score": r.total_score,
                    "max_score": r.max_score,
                    "percentage": r.percentage,
                    "created_at": r.created_at,
                    "responses": r.responses,
                    "evaluation_status": r.evaluation_status or "completed"
                }
                for r in query.all()
            ];
        }
        report {"files": [_format_result(r) for r in results]};
    }
}


walker :pub GetStashes {
    has auth_token: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can get_stashes with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        report {"stashes": BenchmarkResultService.get_collections()};
    }
}


walker :pub GetStashFiles {
    has auth_token: str = "";
    has stash_name: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can get_files with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        results = BenchmarkResultService.get_collection_results(self.stash_name);
        report {"files": [_format_result(r, self.stash_name) for r in results]};
    }
}


walker :pub DeleteStash {
    has auth_token: str = "";
    has stash_name: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can delete_stash with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        BenchmarkResultService.delete_collection(self.stash_name);
        report {"status": "success"};
    }
}


walker :pub StashAll {
    has auth_token: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can stash with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        with get_db() as session {
            uncollected = session.query(BenchmarkResult).filter(
                BenchmarkResult.collection_id.is_(None)
            ).all();
            if not uncollected {
                report {"status": "info", "message": "No uncollected results"};
                disengage;
            }
            collection_name = f"collection-{datetime.now().strftime('%Y%m%d_%H%M%S')}";
            run_ids = [r.run_id for r in uncollected];
            BenchmarkResultService.add_to_collection(run_ids, collection_name);
            report {
                "status": "success",
                "collection_name": collection_name,
                "count": len(run_ids)
            };
        }
    }
}


walker :pub StashSelected {
    has auth_token: str = "";
    has run_ids: list = [];

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can stash with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        if not self.run_ids {
            report {"error": "run_ids is required"};
            disengage;
        }
        collection_name = f"collection-{datetime.now().strftime('%Y%m%d_%H%M%S')}";
        BenchmarkResultService.add_to_collection(self.run_ids, collection_name);
        report {
            "status": "success",
            "collection_name": collection_name,
            "count": len(self.run_ids)
        };
    }
}


walker :pub DeleteFile {
    has auth_token: str = "";
    has file_path: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can delete_file with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        if not self.file_path {
            report {"error": "file_path is required"};
            disengage;
        }
        run_id = (self.file_path.replace("db/", "")) if self.file_path.startswith("db/") else (Path(self.file_path).stem);
        deleted = BenchmarkResultService.delete_by_run_id(run_id);
        if deleted {
            report {"status": "success"};
        } else {
            report {"error": "Result not found"};
        }
    }
}


walker :pub CleanUncollected {
    has auth_token: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can clean with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        with get_db() as session {
            deleted = session.query(BenchmarkResult).filter(
                BenchmarkResult.collection_id.is_(None)
            ).delete();
        }
        report {"status": "success", "deleted": deleted};
    }
}


walker :pub ExportCollectionsCsv {
    has auth_token: str = "";
    has collections: list = [];

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can export_csv with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        if not self.collections {
            report {"error": "collections is required"};
            disengage;
        }
        rows = [];
        for collection_name in self.collections {
            results = BenchmarkResultService.get_collection_results(collection_name);
            for result in results {
                rows.append({
                    "collection": collection_name,
                    "run_id": result.get("run_id"),
                    "model": result.get("model"),
                    "variant": result.get("variant"),
                    "batch_size": result.get("batch_size"),
                    "num_batches": result.get("num_batches"),
                    "total_tests": result.get("total_tests"),
                    "total_score": result.get("total_score"),
                    "max_score": result.get("max_score"),
                    "percentage": result.get("percentage"),
                    "temperature": result.get("temperature"),
                    "max_tokens": result.get("max_tokens"),
                    "created_at": result.get("created_at")
                });
            }
        }
        if not rows {
            report {"error": "No results found"};
            disengage;
        }
        output = io.StringIO();
        fieldnames = [
            "collection", "run_id", "model", "variant",
            "batch_size", "num_batches", "total_tests",
            "total_score", "max_score", "percentage",
            "temperature", "max_tokens", "created_at"
        ];
        writer = csv.DictWriter(output, fieldnames=fieldnames);
        writer.writeheader();
        writer.writerows(rows);
        report {"csv_data": output.getvalue(), "filename": "collections-export.csv"};
    }
}
