import from services.llm_service { LLMService }
import from database { DocumentationService }
import from utils.auth { require_auth_check }


walker :pub GetModels {
    has api_key: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can get_models with Root entry {
        if not self.api_key {
            report {"models": [], "error": "API key required"};
            disengage;
        }
        try {
            llm_service = LLMService(tests=[], api_key=self.api_key);
            models = llm_service.fetch_available_models();
        } except RuntimeError as e {
            report {"models": [], "error": str(e)};
            disengage;
        }
        formatted = [
            {
                "id": m.get("id"),
                "name": m.get("name"),
                "context_length": m.get("context_length"),
                "pricing": m.get("pricing"),
                "architecture": m.get("architecture"),
                "top_provider": m.get("top_provider")
            }
            for m in models
        ];
        report {"models": formatted};
    }
}


walker :pub GetVariants {
    obj __specs__ {
        static has methods: list = ["post"];
    }
    can get_variants with Root entry {
        variants = DocumentationService.get_all_variants();
        report {"variants": variants};
    }
}


walker :pub CreateVariant {
    has auth_token: str = "";
    has variant_name: str = "";
    has url: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can create with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        if not self.variant_name or not self.url {
            report {"error": "variant_name and url are required"};
            disengage;
        }
        try {
            DocumentationService.create_variant(self.variant_name, self.url);
            report {"success": True, "message": "Variant created successfully"};
        } except Exception as e {
            report {"error": str(e)};
        }
    }
}


walker :pub DeleteVariant {
    has auth_token: str = "";
    has variant_name: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can delete_var with Root entry {
        (user, err, code) = require_auth_check(self.auth_token);
        if err {
            report err;
            disengage;
        }
        try {
            DocumentationService.delete_variant(self.variant_name);
            report {"success": True, "message": "Variant deleted successfully"};
        } except Exception as e {
            report {"error": str(e)};
        }
    }
}
