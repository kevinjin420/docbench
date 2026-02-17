import from database {
    get_db, local_engine, LocalBase,
    BenchmarkResult, BenchmarkRun, Collection
}
import from database { BenchmarkRunService }
import from utils.auth { require_auth_check }
import from sqlalchemy { text }


glob running_benchmarks: dict = {};


walker :pub HealthCheck {
    obj __specs__ {
        static has methods: list = ["post"];
    }
    can check with Root entry {
        try {
            with get_db() as session {
                session.execute(text("SELECT 1"));
            }
            report {"status": "healthy", "database": "connected"};
        } except Exception as e {
            report {"status": "unhealthy", "error": str(e)};
        }
    }
}


walker :pub GetRunning {
    obj __specs__ {
        static has methods: list = ["post"];
    }
    can get_running with Root entry {
        active = {k: v for (k, v) in running_benchmarks.items() if v.get("status") == "running"};
        report {"runs": active};
    }
}


walker :pub ClearDatabase {
    has auth_token: str = "";
    has nuke: bool = False;

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can clear with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }

        if self.nuke {
            try {
                with local_engine.connect() as conn {
                    result = conn.execute(text(
                        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
                    ));
                    tables = [row[0] for row in result];
                    for table in tables {
                        conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'));
                    }
                    conn.commit();
                }
                LocalBase.metadata.create_all(bind=local_engine);
                report {"status": "success", "message": "Local benchmark tables dropped and recreated"};
            } except Exception as e {
                report {"status": "error", "message": str(e)};
            }
        } else {
            with get_db() as session {
                session.query(BenchmarkResult).delete();
                session.query(BenchmarkRun).delete();
                session.query(Collection).delete();
            }
            report {"status": "success", "message": "Data cleared"};
        }
    }
}
