include env;
include models;
include utils;
include services;
include walkers;

cl {
    import from .ui.app { App }

    def:pub app -> any {
        return <App />;
    }
}

with entry {
    print("Jaseci DocBench started.");
}
