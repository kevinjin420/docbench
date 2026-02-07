import:jac from models.nodes, RunNode;
import:jac from models.edges, HasRun;

walker HealthCheck {
    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = False;
    }
    can check with `root entry {
        report {"status": "healthy"};
    }
}

walker GetRunning {
    obj __specs__ {
        static has methods: list = ["GET"];
        static has auth: bool = False;
    }
    can gather with `root entry {
        visit [->:HasRun:->];
    }
    can collect with RunNode entry {
        if here.status == "running" {
            report {
                "run_id": here.run_id,
                "model": here.model,
                "variant": here.variant,
                "status": here.status,
                "progress": here.progress
            };
        }
    }
}

walker ClearDatabase {
    has nuke: bool = False;

    obj __specs__ {
        static has methods: list = ["POST"];
        static has auth: bool = True;
    }
    can clear with `root entry {
        import:jac from models.nodes, ResultNode, CollectionNode;
        import:jac from models.edges, HasResult, HasCollection, HasRun;

        for result_node in [->:HasResult:->] {
            here del--> result_node;
            del result_node;
        }
        for run_node in [->:HasRun:->] {
            here del--> run_node;
            del run_node;
        }
        for coll_node in [->:HasCollection:->] {
            for r in [->:any:->] {
                coll_node del--> r;
                del r;
            }
            here del--> coll_node;
            del coll_node;
        }
        report {"status": "success", "message": "Data cleared"};
    }
}
