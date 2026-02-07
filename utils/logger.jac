import:jac from env, VERBOSITY;

def log_info(message: str, min_verbosity: int = 1) -> None {
    if VERBOSITY >= min_verbosity {
        print(f"INFO: {message}");
    }
}

def log_debug(message: str, min_verbosity: int = 3) -> None {
    if VERBOSITY >= min_verbosity {
        print(f"DEBUG: {message}");
    }
}

def log_error(message: str) -> None {
    print(f"ERROR: {message}");
}

def log_warning(message: str, min_verbosity: int = 2) -> None {
    if VERBOSITY >= min_verbosity {
        print(f"WARNING: {message}");
    }
}
