import from models.nodes { VariantNode }
import from models.edges { HasVariant }
import from services.llm_service { fetch_available_models }

walker : pub ListModels {
    has api_key: str = "";

    can fetch with `root entry {
        if not self.api_key {
            report {"error": "API key required"};
            disengage;
        }
        models: list = fetch_available_models(self.api_key);
        report {"models": models};
    }
}

walker : pub ListVariants {
    can gather with `root entry {
        variants: list = [];
        for vnode in [->:HasVariant:->(`?VariantNode)] {
            variants.append({
                "variant_name": vnode.variant_name,
                "url": vnode.url
            });
        }
        report {"variants": variants};
    }
}

walker : pub CreateVariant {
    has variant_name: str;
    has url: str;

    can create with `root entry {
        if not self.variant_name or not self.url {
            report {"error": "variant_name and url are required"};
            disengage;
        }

        for vnode in [->:HasVariant:->(`?VariantNode)] {
            if vnode.variant_name == self.variant_name {
                report {"error": f"Variant '{self.variant_name}' already exists"};
                disengage;
            }
        }

        here +>:HasVariant:+> VariantNode(variant_name=self.variant_name, url=self.url);
        report {"status": "success", "variant_name": self.variant_name};
    }
}

walker : pub DeleteVariant {
    has variant_name: str;

    can remove with `root entry {
        for vnode in [->:HasVariant:->(`?VariantNode)] {
            if vnode.variant_name == self.variant_name {
                here del--> vnode;
                del vnode;
                report {"status": "success"};
                disengage;
            }
        }
        report {"error": "Variant not found"};
    }
}
