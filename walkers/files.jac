import time;
import csv;
import io;
import from models.nodes { ResultNode, CollectionNode }
import from models.edges { HasResult, HasCollection, InCollection }

walker : pub ListTestFiles {
    has limit: int = 100;

    can gather with `root entry {
        files: list = [];
        for rnode in [->:HasResult:->(`?ResultNode)] {
            files.append({
                "run_id": rnode.run_id,
                "model": rnode.model,
                "model_id": rnode.model_id,
                "variant": rnode.variant,
                "total_tests": rnode.total_tests,
                "total_score": rnode.total_score,
                "max_score": rnode.max_score,
                "percentage": rnode.percentage,
                "created_at": rnode.created_at,
                "status": rnode.status,
                "evaluation_status": rnode.evaluation_status
            });
        }
        files.sort(key=lambda x: dict -> float : -x["created_at"]);
        report {"files": files[:self.limit]};
    }
}

walker : pub ListStashes {
    can gather with `root entry {
        stashes: list = [];
        for cnode in [->:HasCollection:->(`?CollectionNode)] {
            result_count: int = len([cnode ->:InCollection:->(`?ResultNode)]);
            stashes.append({
                "name": cnode.name,
                "description": cnode.description,
                "created_at": cnode.created_at,
                "result_count": result_count
            });
        }
        stashes.sort(key=lambda x: dict -> float : -x["created_at"]);
        report {"stashes": stashes};
    }
}

walker : pub GetStashFiles {
    has stash_name: str;

    can gather with `root entry {
        for cnode in [->:HasCollection:->(`?CollectionNode)] {
            if cnode.name == self.stash_name {
                files: list = [];
                for rnode in [cnode ->:InCollection:->(`?ResultNode)] {
                    files.append({
                        "run_id": rnode.run_id,
                        "model": rnode.model,
                        "variant": rnode.variant,
                        "total_score": rnode.total_score,
                        "max_score": rnode.max_score,
                        "percentage": rnode.percentage,
                        "created_at": rnode.created_at,
                        "status": rnode.status,
                        "evaluation_status": rnode.evaluation_status
                    });
                }
                report {"stash": self.stash_name, "files": files};
                disengage;
            }
        }
        report {"error": "Stash not found"};
    }
}

walker : pub CreateStash {
    has name: str = "";
    has description: str = "";

    can create with `root entry {
        uncollected: list = [->:HasResult:->(`?ResultNode)];
        if not uncollected {
            report {"error": "No uncollected results to stash"};
            disengage;
        }

        if not self.name {
            import from datetime { datetime }
            self.name = f"stash_{datetime.now().strftime('%Y%m%d_%H%M%S')}";
        }

        for cnode in [->:HasCollection:->(`?CollectionNode)] {
            if cnode.name == self.name {
                report {"error": f"Stash '{self.name}' already exists"};
                disengage;
            }
        }

        coll: CollectionNode = (here +>:HasCollection:+> CollectionNode(
            name=self.name, description=self.description, created_at=time.time()
        ))[0];

        for rnode in uncollected {
            here del--> rnode;
            coll +>:InCollection:+> rnode;
        }

        report {"status": "success", "stash": self.name, "files_stashed": len(uncollected)};
    }
}

walker : pub StashSelected {
    has run_ids: list = [];
    has name: str = "";

    can create with `root entry {
        if not self.run_ids {
            report {"error": "run_ids required"};
            disengage;
        }

        if not self.name {
            import from datetime { datetime }
            self.name = f"stash_{datetime.now().strftime('%Y%m%d_%H%M%S')}";
        }

        coll: CollectionNode = (here +>:HasCollection:+> CollectionNode(
            name=self.name, created_at=time.time()
        ))[0];

        run_id_set: set = set(self.run_ids);
        stashed: int = 0;
        for rnode in [->:HasResult:->(`?ResultNode)] {
            if rnode.run_id in run_id_set {
                here del--> rnode;
                coll +>:InCollection:+> rnode;
                stashed += 1;
            }
        }

        report {"status": "success", "stash": self.name, "files_stashed": stashed};
    }
}

walker : pub DeleteStash {
    has stash_name: str;

    can remove with `root entry {
        for cnode in [->:HasCollection:->(`?CollectionNode)] {
            if cnode.name == self.stash_name {
                for rnode in [cnode ->:InCollection:->(`?ResultNode)] {
                    cnode del--> rnode;
                    del rnode;
                }
                here del--> cnode;
                del cnode;
                report {"status": "success", "message": f"Stash '{self.stash_name}' deleted"};
                disengage;
            }
        }
        report {"error": "Stash not found"};
    }
}

walker : pub DeleteFile {
    has run_id: str;

    can remove with `root entry {
        for rnode in [->:HasResult:->(`?ResultNode)] {
            if rnode.run_id == self.run_id {
                here del--> rnode;
                del rnode;
                report {"status": "success"};
                disengage;
            }
        }
        report {"error": "File not found"};
    }
}

walker : pub CleanResults {
    can clean with `root entry {
        cleaned: int = 0;
        for rnode in [->:HasResult:->(`?ResultNode)] {
            here del--> rnode;
            del rnode;
            cleaned += 1;
        }
        report {"status": "success", "cleaned": cleaned};
    }
}

walker : pub ExportCSV {
    has collections: list = [];

    can export with `root entry {
        output: any = io.StringIO();
        writer: any = csv.writer(output);
        writer.writerow(["collection", "run_id", "model", "variant", "total_score", "max_score", "percentage", "created_at"]);

        for cnode in [->:HasCollection:->(`?CollectionNode)] {
            if self.collections and cnode.name not in self.collections {
                continue;
            }
            for rnode in [cnode ->:InCollection:->(`?ResultNode)] {
                writer.writerow([
                    cnode.name, rnode.run_id, rnode.model, rnode.variant,
                    rnode.total_score, rnode.max_score, rnode.percentage, rnode.created_at
                ]);
            }
        }

        report {"csv": output.getvalue()};
    }
}
