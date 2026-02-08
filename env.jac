import os;
import from dotenv { load_dotenv }

glob _dotenv_loaded: bool = load_dotenv() or True;

glob DATABASE_URL: str = os.getenv("DATABASE_URL", "");
glob LOCAL_DATABASE_URL: str = os.getenv("LOCAL_DATABASE_URL", "");
glob PUBLIC_DATABASE_URL: str = os.getenv("PUBLIC_DATABASE_URL", "");

glob GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "");
glob GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "");
glob JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-me-in-production");
glob FLASK_SECRET_KEY: str = os.getenv("FLASK_SECRET_KEY", "flask-secret");

glob OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "");
glob FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5555");
glob API_PORT: int = int(os.getenv("API_PORT", "5000"));

glob GITHUB_AUTHORIZE_URL: str = "https://github.com/login/oauth/authorize";
glob GITHUB_TOKEN_URL: str = "https://github.com/login/oauth/access_token";
glob GITHUB_API_URL: str = "https://api.github.com";

glob VERBOSITY: int = int(os.getenv("VERBOSITY", "1"));
glob DEFAULT_TEMPERATURE: float = float(os.getenv("DEFAULT_TEMPERATURE", "0.1"));
