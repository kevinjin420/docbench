walker BenchmarkProgress {
    has run_id: str = "";

    obj __specs__ {
        static has methods: list = ["websocket"];
    }
    can subscribe with `root entry {
        report {"subscribed": True, "channel": "benchmark", "run_id": self.run_id};
    }
}

walker PublicBenchmarkProgress {
    has run_id: str = "";

    obj __specs__ {
        static has methods: list = ["websocket"];
    }
    can subscribe with `root entry {
        report {"subscribed": True, "channel": "public_benchmark", "run_id": self.run_id};
    }
}
