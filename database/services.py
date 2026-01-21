#!/usr/bin/env python3
"""
Service layer for database operations
Replaces file-based storage with database storage
"""


import json
import time
from typing import Optional, Dict, Any, List
from sqlalchemy import desc, func

from .models import (
    get_db,
    get_public_db,
    Collection,
    BenchmarkResult,
    BenchmarkRun,
    DocumentationVariant,
    User,
    AccessToken,
    AdminEmail,
    PublicTestConfig,
    PublicBenchmarkModel,
    LeaderboardEntry
)


class BenchmarkResultService:
    """Service for managing benchmark results"""

    @staticmethod
    def create(
        run_id: str,
        model: str,
        model_id: str,
        variant: str,
        max_tokens: int,
        total_tests: int,
        responses: Dict[str, str],
        batch_size: Optional[int] = None,
        num_batches: Optional[int] = None,
        metadata: Optional[Dict] = None,
        temperature: float = 0.1
    ) -> int:
        """Save benchmark results to database"""
        with get_db() as session:
            result = BenchmarkResult(
                run_id=run_id,
                model=model,
                model_id=model_id,
                variant=variant,
                temperature=temperature,
                max_tokens=max_tokens,
                total_tests=total_tests,
                batch_size=batch_size,
                num_batches=num_batches,
                responses=responses,
                run_metadata=metadata,
                created_at=time.time(),
                status='completed'
            )
            session.add(result)
            session.flush()
            return result.id

    @staticmethod
    def set_evaluation_status(run_id: str, status: str):
        """Set evaluation status (pending, evaluating, completed, failed)"""
        with get_db() as session:
            result = session.query(BenchmarkResult).filter_by(run_id=run_id).first()
            if result:
                result.evaluation_status = status

    @staticmethod
    def update_evaluation(
        run_id: str,
        evaluation_results: Dict[str, Any],
        total_score: float,
        max_score: float,
        percentage: float
    ):
        """Update evaluation results for a benchmark"""
        with get_db() as session:
            result = session.query(BenchmarkResult).filter_by(run_id=run_id).first()
            if result:
                result.evaluation_results = evaluation_results
                result.total_score = total_score
                result.max_score = max_score
                result.percentage = percentage
                result.evaluated_at = time.time()
                result.evaluation_status = 'completed'

    @staticmethod
    def update_responses(run_id: str, responses: Dict[str, str]):
        """Update responses for a benchmark result"""
        with get_db() as session:
            result = session.query(BenchmarkResult).filter_by(run_id=run_id).first()
            if result:
                result.responses = responses
                result.evaluation_results = None
                result.total_score = None
                result.max_score = None
                result.percentage = None
                result.evaluated_at = None

    @staticmethod
    def get_by_run_id(run_id: str) -> Optional[Dict[str, Any]]:
        """Get benchmark result by run_id"""
        with get_db() as session:
            result = session.query(BenchmarkResult).filter_by(run_id=run_id).first()
            if result:
                return {
                    'id': result.id,
                    'run_id': result.run_id,
                    'model': result.model,
                    'model_id': result.model_id,
                    'variant': result.variant,
                    'temperature': result.temperature,
                    'max_tokens': result.max_tokens,
                    'total_tests': result.total_tests,
                    'batch_size': result.batch_size,
                    'num_batches': result.num_batches,
                    'responses': result.responses,
                    'metadata': result.run_metadata,
                    'evaluation_results': result.evaluation_results,
                    'total_score': result.total_score,
                    'max_score': result.max_score,
                    'percentage': result.percentage,
                    'created_at': result.created_at,
                    'evaluated_at': result.evaluated_at,
                    'status': result.status,
                    'evaluation_status': result.evaluation_status
                }
            return None

    @staticmethod
    def get_recent(limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent benchmark results"""
        with get_db() as session:
            results = session.query(BenchmarkResult).order_by(
                desc(BenchmarkResult.created_at)
            ).limit(limit).all()

            return [
                {
                    'id': r.id,
                    'run_id': r.run_id,
                    'model': r.model,
                    'variant': r.variant,
                    'total_tests': r.total_tests,
                    'total_score': r.total_score,
                    'max_score': r.max_score,
                    'percentage': r.percentage,
                    'created_at': r.created_at,
                    'responses': r.responses,
                    'collection': r.collection_obj.name if r.collection_obj else None,
                    'collection_id': r.collection_id
                }
                for r in results
            ]

    @staticmethod
    def get_by_model_variant(model: str, variant: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get results for specific model and variant"""
        with get_db() as session:
            results = session.query(BenchmarkResult).filter_by(
                model=model,
                variant=variant
            ).order_by(desc(BenchmarkResult.created_at)).limit(limit).all()

            return [
                {
                    'id': r.id,
                    'run_id': r.run_id,
                    'total_score': r.total_score,
                    'percentage': r.percentage,
                    'created_at': r.created_at
                }
                for r in results
            ]

    @staticmethod
    def get_stats() -> Dict[str, Any]:
        """Get aggregate statistics"""
        with get_db() as session:
            total = session.query(BenchmarkResult).count()

            avg_score = session.query(
                func.avg(BenchmarkResult.percentage)
            ).scalar() or 0

            top_models = session.query(
                BenchmarkResult.model,
                func.avg(BenchmarkResult.percentage).label('avg_score'),
                func.count(BenchmarkResult.id).label('count')
            ).group_by(BenchmarkResult.model).order_by(
                desc('avg_score')
            ).limit(5).all()

            return {
                'total_results': total,
                'average_score': round(avg_score, 2) if avg_score else 0,
                'top_models': [
                    {'model': m, 'avg_score': round(s, 2) if s else 0, 'count': c}
                    for m, s, c in top_models
                ]
            }

    @staticmethod
    def add_to_collection(run_ids: List[str], collection_name: str):
        """Add benchmark results to a collection"""
        collection_id = CollectionService.get_or_create(collection_name)
        with get_db() as session:
            session.query(BenchmarkResult).filter(
                BenchmarkResult.run_id.in_(run_ids)
            ).update({'collection_id': collection_id}, synchronize_session=False)

    @staticmethod
    def remove_from_collection(run_ids: List[str]):
        """Remove benchmark results from their collection"""
        with get_db() as session:
            session.query(BenchmarkResult).filter(
                BenchmarkResult.run_id.in_(run_ids)
            ).update({'collection_id': None}, synchronize_session=False)

    @staticmethod
    def get_collections() -> List[Dict[str, Any]]:
        """Get all collections with metadata"""
        return CollectionService.get_all()

    @staticmethod
    def get_collection_results(collection_name: str) -> List[Dict[str, Any]]:
        """Get all results in a collection by name"""
        with get_db() as session:
            collection = session.query(Collection).filter_by(name=collection_name).first()
            if not collection:
                return []

            results = session.query(BenchmarkResult).filter_by(
                collection_id=collection.id
            ).order_by(desc(BenchmarkResult.created_at)).all()

            return [
                {
                    'id': r.id,
                    'run_id': r.run_id,
                    'model': r.model,
                    'variant': r.variant,
                    'total_tests': r.total_tests,
                    'batch_size': r.batch_size,
                    'num_batches': r.num_batches,
                    'total_score': r.total_score,
                    'max_score': r.max_score,
                    'percentage': r.percentage,
                    'created_at': r.created_at,
                    'responses': r.responses,
                    'evaluation_results': r.evaluation_results
                }
                for r in results
            ]

    @staticmethod
    def delete_collection(collection_name: str):
        """Remove collection tag from all results (doesn't delete results)"""
        CollectionService.delete_by_name(collection_name)

    @staticmethod
    def delete_by_run_id(run_id: str) -> bool:
        """Delete a benchmark result by run_id"""
        with get_db() as session:
            result = session.query(BenchmarkResult).filter_by(run_id=run_id).first()
            if result:
                session.delete(result)
                return True
            return False


class BenchmarkRunService:
    """Service for managing benchmark runs"""

    @staticmethod
    def create(
        run_id: str,
        model: str,
        model_id: str,
        variant: str,
        max_tokens: int,
        temperature: float = 0.1
    ) -> int:
        """Create new benchmark run"""
        with get_db() as session:
            run = BenchmarkRun(
                run_id=run_id,
                model=model,
                model_id=model_id,
                variant=variant,
                temperature=temperature,
                max_tokens=max_tokens,
                status='running',
                started_at=time.time()
            )
            session.add(run)
            session.flush()
            return run.id

    @staticmethod
    def update_progress(run_id: str, progress: str):
        """Update run progress"""
        with get_db() as session:
            run = session.query(BenchmarkRun).filter_by(run_id=run_id).first()
            if run:
                run.progress = progress

    @staticmethod
    def complete(run_id: str, result_id: Optional[int] = None):
        """Mark run as completed"""
        with get_db() as session:
            run = session.query(BenchmarkRun).filter_by(run_id=run_id).first()
            if run:
                run.status = 'completed'
                run.completed_at = time.time()
                run.result_id = result_id

    @staticmethod
    def fail(run_id: str, error_message: str):
        """Mark run as failed"""
        with get_db() as session:
            run = session.query(BenchmarkRun).filter_by(run_id=run_id).first()
            if run:
                run.status = 'failed'
                run.completed_at = time.time()
                run.error_message = error_message

    @staticmethod
    def get_active_runs() -> List[Dict[str, Any]]:
        """Get all running benchmarks"""
        with get_db() as session:
            runs = session.query(BenchmarkRun).filter_by(status='running').all()

            return [
                {
                    'run_id': r.run_id,
                    'model': r.model,
                    'variant': r.variant,
                    'progress': r.progress,
                    'started_at': r.started_at
                }
                for r in runs
            ]






class DocumentationService:
    """Service for managing documentation variants"""

    @staticmethod
    def create_variant(variant_name: str, url: str):
        """Create or update a documentation variant"""
        with get_db() as session:
            existing = session.query(DocumentationVariant).filter_by(
                variant_name=variant_name
            ).first()

            if existing:
                existing.url = url
            else:
                variant = DocumentationVariant(
                    variant_name=variant_name,
                    url=url
                )
                session.add(variant)

    @staticmethod
    def get_variant(variant_name: str) -> Optional[str]:
        """Get documentation content by fetching from URL"""
        import requests

        with get_db() as session:
            variant = session.query(DocumentationVariant).filter_by(
                variant_name=variant_name
            ).first()

            if not variant:
                return None

            try:
                response = requests.get(variant.url, timeout=30)
                response.raise_for_status()
                return response.text
            except Exception as e:
                print(f"Error fetching variant {variant_name} from {variant.url}: {e}")
                return None

    @staticmethod
    def get_all_variants() -> List[Dict[str, Any]]:
        """Get all documentation variants"""
        with get_db() as session:
            variants = session.query(DocumentationVariant).all()
            return [
                {
                    'name': v.variant_name,
                    'url': v.url
                }
                for v in variants
            ]

    @staticmethod
    def delete_variant(variant_name: str) -> bool:
        """Delete a documentation variant"""
        with get_db() as session:
            variant = session.query(DocumentationVariant).filter_by(
                variant_name=variant_name
            ).first()

            if variant:
                session.delete(variant)
                return True
            return False


class CollectionService:
    """Service for managing collections"""

    @staticmethod
    def get_or_create(name: str, description: Optional[str] = None) -> int:
        """Get existing collection or create new one by name"""
        with get_db() as session:
            collection = session.query(Collection).filter_by(name=name).first()
            if collection:
                return collection.id

            collection = Collection(
                name=name,
                description=description,
                created_at=time.time()
            )
            session.add(collection)
            session.flush()
            return collection.id

    @staticmethod
    def get_all() -> List[Dict[str, Any]]:
        """Get all collections with metadata"""
        with get_db() as session:
            collections = session.query(
                Collection.id,
                Collection.name,
                Collection.description,
                Collection.created_at,
                func.count(BenchmarkResult.id).label('count'),
                func.avg(BenchmarkResult.percentage).label('avg_score')
            ).outerjoin(
                BenchmarkResult, BenchmarkResult.collection_id == Collection.id
            ).group_by(
                Collection.id, Collection.name, Collection.description, Collection.created_at
            ).order_by(
                desc(Collection.created_at)
            ).all()

            result_list = []
            for coll_id, name, description, created, count, avg_score in collections:
                # Get first result to extract metadata
                first_result = session.query(BenchmarkResult).filter_by(
                    collection_id=coll_id
                ).first()

                metadata = None
                if first_result:
                    metadata = {
                        'model': first_result.model,
                        'model_full': first_result.model,
                        'variant': first_result.variant,
                        'total_tests': str(first_result.total_tests),
                        'batch_size': first_result.batch_size
                    }

                result_list.append({
                    'id': coll_id,
                    'name': name,
                    'path': f'collections/{name}',
                    'description': description,
                    'created': created,
                    'file_count': count,
                    'count': count,  # Keep for backward compatibility
                    'avg_score': round(avg_score, 2) if avg_score else 0,
                    'metadata': metadata
                })

            return result_list

    @staticmethod
    def delete(collection_id: int):
        """Delete a collection and unlink all results"""
        with get_db() as session:
            session.query(BenchmarkResult).filter_by(
                collection_id=collection_id
            ).update({'collection_id': None}, synchronize_session=False)

            session.query(Collection).filter_by(id=collection_id).delete()

    @staticmethod
    def delete_by_name(name: str):
        """Delete a collection by name and unlink all results"""
        with get_db() as session:
            collection = session.query(Collection).filter_by(name=name).first()
            if collection:
                session.query(BenchmarkResult).filter_by(
                    collection_id=collection.id
                ).update({'collection_id': None}, synchronize_session=False)

                session.query(Collection).filter_by(name=name).delete()


class UserService:
    """Service for managing OAuth users (uses public database)"""

    @staticmethod
    def _is_admin_email(email: str) -> bool:
        """Check if email is in ADMIN_EMAILS env var or admin_emails table"""
        import os
        email_lower = email.lower()

        admin_emails_env = os.getenv('ADMIN_EMAILS', '')
        if admin_emails_env:
            env_list = [e.strip().lower() for e in admin_emails_env.split(',') if e.strip()]
            if email_lower in env_list:
                return True

        with get_public_db() as session:
            exists = session.query(AdminEmail).filter(
                func.lower(AdminEmail.email) == email_lower
            ).first()
            return exists is not None

    @staticmethod
    def get_or_create(
        email: str,
        github_id: str,
        name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get existing user or create new one. Returns user dict."""
        with get_public_db() as session:
            user = session.query(User).filter_by(github_id=github_id).first()

            should_be_admin = UserService._is_admin_email(email)

            if user:
                user.last_login_at = time.time()
                if name and name != user.name:
                    user.name = name
                if email and email != user.email:
                    user.email = email
                if should_be_admin and not user.is_admin:
                    user.is_admin = True
            else:
                user = User(
                    email=email,
                    name=name,
                    github_id=github_id,
                    is_admin=should_be_admin,
                    created_at=time.time(),
                    last_login_at=time.time()
                )
                session.add(user)
                session.flush()

            return {
                'id': user.id,
                'email': user.email,
                'name': user.name,
                'github_id': user.github_id,
                'is_admin': user.is_admin,
                'created_at': user.created_at,
                'last_login_at': user.last_login_at
            }

    @staticmethod
    def get_by_id(user_id: int) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        with get_public_db() as session:
            user = session.query(User).filter_by(id=user_id).first()
            if not user:
                return None

            return {
                'id': user.id,
                'email': user.email,
                'name': user.name,
                'github_id': user.github_id,
                'is_admin': user.is_admin,
                'created_at': user.created_at,
                'last_login_at': user.last_login_at
            }

    @staticmethod
    def get_by_github_id(github_id: str) -> Optional[Dict[str, Any]]:
        """Get user by GitHub ID"""
        with get_public_db() as session:
            user = session.query(User).filter_by(github_id=github_id).first()
            if not user:
                return None

            return {
                'id': user.id,
                'email': user.email,
                'name': user.name,
                'github_id': user.github_id,
                'is_admin': user.is_admin,
                'created_at': user.created_at,
                'last_login_at': user.last_login_at
            }

    @staticmethod
    def set_admin(user_id: int, is_admin: bool) -> bool:
        """Set user admin status"""
        with get_public_db() as session:
            user = session.query(User).filter_by(id=user_id).first()
            if user:
                user.is_admin = is_admin
                return True
            return False

    @staticmethod
    def list_all(limit: int = 100) -> List[Dict[str, Any]]:
        """List all users"""
        with get_public_db() as session:
            users = session.query(User).order_by(
                desc(User.created_at)
            ).limit(limit).all()

            return [
                {
                    'id': u.id,
                    'email': u.email,
                    'name': u.name,
                    'github_id': u.github_id,
                    'is_admin': u.is_admin,
                    'created_at': u.created_at,
                    'last_login_at': u.last_login_at
                }
                for u in users
            ]


class AdminEmailService:
    """Service for managing admin emails (uses public database)"""

    @staticmethod
    def list_all() -> List[Dict[str, Any]]:
        """List all admin emails from database"""
        with get_public_db() as session:
            emails = session.query(AdminEmail).order_by(
                desc(AdminEmail.added_at)
            ).all()
            return [
                {
                    'id': e.id,
                    'email': e.email,
                    'added_at': e.added_at,
                    'added_by': e.added_by
                }
                for e in emails
            ]

    @staticmethod
    def add(email: str, added_by: Optional[int] = None) -> Dict[str, Any]:
        """Add an admin email"""
        with get_public_db() as session:
            existing = session.query(AdminEmail).filter(
                func.lower(AdminEmail.email) == email.lower()
            ).first()
            if existing:
                return {
                    'id': existing.id,
                    'email': existing.email,
                    'added_at': existing.added_at,
                    'already_exists': True
                }

            admin_email = AdminEmail(
                email=email.lower(),
                added_at=time.time(),
                added_by=added_by
            )
            session.add(admin_email)
            session.flush()
            return {
                'id': admin_email.id,
                'email': admin_email.email,
                'added_at': admin_email.added_at,
                'already_exists': False
            }

    @staticmethod
    def remove(email: str) -> bool:
        """Remove an admin email"""
        with get_public_db() as session:
            admin_email = session.query(AdminEmail).filter(
                func.lower(AdminEmail.email) == email.lower()
            ).first()
            if admin_email:
                session.delete(admin_email)
                return True
            return False

    @staticmethod
    def remove_by_id(email_id: int) -> bool:
        """Remove an admin email by ID"""
        with get_public_db() as session:
            admin_email = session.query(AdminEmail).filter_by(id=email_id).first()
            if admin_email:
                session.delete(admin_email)
                return True
            return False


class AccessTokenService:
    """Service for managing access tokens (uses public database)"""

    @staticmethod
    def hash_token(token: str) -> str:
        """Hash a token using SHA-256"""
        import hashlib
        return hashlib.sha256(token.encode()).hexdigest()

    @staticmethod
    def generate_token() -> tuple[str, int]:
        """Generate a new token. Returns (plaintext_token, token_id)"""
        import secrets
        plaintext = secrets.token_urlsafe(32)
        token_hash = AccessTokenService.hash_token(plaintext)

        with get_public_db() as session:
            token = AccessToken(
                token_hash=token_hash,
                name='generated',
                is_admin=False,
                created_at=time.time(),
                is_active=True
            )
            session.add(token)
            session.flush()
            return plaintext, token.id

    @staticmethod
    def create(name: str, is_admin: bool = False, expires_days: Optional[int] = None) -> tuple[str, int]:
        """Create a new access token with metadata"""
        import secrets
        plaintext = secrets.token_urlsafe(32)
        token_hash = AccessTokenService.hash_token(plaintext)

        expires_at = None
        if expires_days:
            expires_at = time.time() + (expires_days * 86400)

        with get_public_db() as session:
            token = AccessToken(
                token_hash=token_hash,
                name=name,
                is_admin=is_admin,
                created_at=time.time(),
                expires_at=expires_at,
                is_active=True
            )
            session.add(token)
            session.flush()
            return plaintext, token.id

    @staticmethod
    def validate(token: str) -> Optional[Dict[str, Any]]:
        """Validate a token and return token info if valid"""
        token_hash = AccessTokenService.hash_token(token)

        with get_public_db() as session:
            record = session.query(AccessToken).filter_by(
                token_hash=token_hash,
                is_active=True
            ).first()

            if not record:
                return None

            if record.expires_at and time.time() > record.expires_at:
                return None

            record.last_used_at = time.time()

            return {
                'id': record.id,
                'name': record.name,
                'is_admin': record.is_admin,
                'created_at': record.created_at,
                'expires_at': record.expires_at
            }

    @staticmethod
    def revoke(token_id: int) -> bool:
        """Revoke (deactivate) a token"""
        with get_public_db() as session:
            token = session.query(AccessToken).filter_by(id=token_id).first()
            if token:
                token.is_active = False
                return True
            return False

    @staticmethod
    def list_all() -> List[Dict[str, Any]]:
        """List all tokens (without hashes)"""
        with get_public_db() as session:
            tokens = session.query(AccessToken).order_by(
                desc(AccessToken.created_at)
            ).all()

            return [
                {
                    'id': t.id,
                    'name': t.name,
                    'is_admin': t.is_admin,
                    'created_at': t.created_at,
                    'expires_at': t.expires_at,
                    'last_used_at': t.last_used_at,
                    'is_active': t.is_active
                }
                for t in tokens
            ]


class PublicTestConfigService:
    """Service for managing public test configuration (uses public database)"""

    @staticmethod
    def get_public_test_ids() -> List[str]:
        """Get list of test IDs in the public suite"""
        with get_public_db() as session:
            configs = session.query(PublicTestConfig).filter_by(is_public=True).all()
            return [c.test_id for c in configs]

    @staticmethod
    def set_public_tests(test_ids: List[str], added_by: Optional[int] = None):
        """Set which tests are in the public suite"""
        current_time = time.time()

        with get_public_db() as session:
            session.query(PublicTestConfig).update({'is_public': False})

            for test_id in test_ids:
                existing = session.query(PublicTestConfig).filter_by(test_id=test_id).first()
                if existing:
                    existing.is_public = True
                else:
                    config = PublicTestConfig(
                        test_id=test_id,
                        is_public=True,
                        added_at=current_time,
                        added_by=added_by
                    )
                    session.add(config)

    @staticmethod
    def add_public_test(test_id: str, added_by: Optional[int] = None) -> bool:
        """Add a single test to the public suite"""
        with get_public_db() as session:
            existing = session.query(PublicTestConfig).filter_by(test_id=test_id).first()
            if existing:
                existing.is_public = True
                return True

            config = PublicTestConfig(
                test_id=test_id,
                is_public=True,
                added_at=time.time(),
                added_by=added_by
            )
            session.add(config)
            return True

    @staticmethod
    def remove_public_test(test_id: str) -> bool:
        """Remove a test from the public suite"""
        with get_public_db() as session:
            config = session.query(PublicTestConfig).filter_by(test_id=test_id).first()
            if config:
                config.is_public = False
                return True
            return False

    @staticmethod
    def get_config() -> List[Dict[str, Any]]:
        """Get full public test configuration"""
        with get_public_db() as session:
            configs = session.query(PublicTestConfig).all()
            return [
                {
                    'test_id': c.test_id,
                    'is_public': c.is_public,
                    'added_at': c.added_at
                }
                for c in configs
            ]


class PublicBenchmarkModelService:
    """Service for managing models used in public benchmark (uses public database)"""

    @staticmethod
    def get_active_models() -> List[Dict[str, Any]]:
        """Get list of active models ordered by priority"""
        with get_public_db() as session:
            models = session.query(PublicBenchmarkModel).filter_by(
                is_active=True
            ).order_by(desc(PublicBenchmarkModel.priority)).all()
            return [
                {
                    'id': m.id,
                    'model_id': m.model_id,
                    'display_name': m.display_name,
                    'priority': m.priority,
                    'added_at': m.added_at
                }
                for m in models
            ]

    @staticmethod
    def get_all_models() -> List[Dict[str, Any]]:
        """Get all models (active and inactive)"""
        with get_public_db() as session:
            models = session.query(PublicBenchmarkModel).order_by(
                desc(PublicBenchmarkModel.priority)
            ).all()
            return [
                {
                    'id': m.id,
                    'model_id': m.model_id,
                    'display_name': m.display_name,
                    'is_active': m.is_active,
                    'priority': m.priority,
                    'added_at': m.added_at,
                    'added_by': m.added_by
                }
                for m in models
            ]

    @staticmethod
    def add_model(model_id: str, display_name: Optional[str] = None, priority: int = 0, added_by: Optional[int] = None) -> Dict[str, Any]:
        """Add a model to the public benchmark configuration"""
        with get_public_db() as session:
            existing = session.query(PublicBenchmarkModel).filter_by(model_id=model_id).first()
            if existing:
                existing.is_active = True
                if display_name:
                    existing.display_name = display_name
                existing.priority = priority
                return {
                    'id': existing.id,
                    'model_id': existing.model_id,
                    'display_name': existing.display_name,
                    'is_active': existing.is_active,
                    'priority': existing.priority,
                    'already_exists': True
                }

            model = PublicBenchmarkModel(
                model_id=model_id,
                display_name=display_name or model_id.split('/')[-1],
                is_active=True,
                priority=priority,
                added_at=time.time(),
                added_by=added_by
            )
            session.add(model)
            session.flush()
            return {
                'id': model.id,
                'model_id': model.model_id,
                'display_name': model.display_name,
                'is_active': model.is_active,
                'priority': model.priority,
                'already_exists': False
            }

    @staticmethod
    def remove_model(model_id: int) -> bool:
        """Remove a model from the configuration by ID"""
        with get_public_db() as session:
            model = session.query(PublicBenchmarkModel).filter_by(id=model_id).first()
            if model:
                session.delete(model)
                return True
            return False

    @staticmethod
    def set_active(model_id: int, is_active: bool) -> bool:
        """Set whether a model is active"""
        with get_public_db() as session:
            model = session.query(PublicBenchmarkModel).filter_by(id=model_id).first()
            if model:
                model.is_active = is_active
                return True
            return False

    @staticmethod
    def update_priority(model_id: int, priority: int) -> bool:
        """Update model priority"""
        with get_public_db() as session:
            model = session.query(PublicBenchmarkModel).filter_by(id=model_id).first()
            if model:
                model.priority = priority
                return True
            return False


class LeaderboardService:
    """Service for managing the public leaderboard (uses public database)"""

    @staticmethod
    def submit(
        documentation_name: str,
        documentation_url: str,
        total_score: float,
        max_score: float,
        percentage: float,
        model_used: str,
        submitter_email: Optional[str] = None,
        evaluation_snapshot: Optional[Dict] = None,
        user_id: Optional[int] = None
    ) -> int:
        """Submit a new leaderboard entry"""
        with get_public_db() as session:
            entry = LeaderboardEntry(
                documentation_name=documentation_name,
                documentation_url=documentation_url,
                submitter_email=submitter_email,
                total_score=total_score,
                max_score=max_score,
                percentage=percentage,
                evaluation_snapshot=evaluation_snapshot,
                model_used=model_used,
                submitted_at=time.time(),
                is_visible=True,
                user_id=user_id
            )
            session.add(entry)
            session.flush()
            return entry.id

    @staticmethod
    def get_leaderboard(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Get ranked leaderboard entries"""
        with get_public_db() as session:
            entries = session.query(LeaderboardEntry).filter_by(
                is_visible=True
            ).order_by(
                desc(LeaderboardEntry.percentage)
            ).offset(offset).limit(limit).all()

            result = []
            for rank, entry in enumerate(entries, start=offset + 1):
                entry_dict = {
                    'id': entry.id,
                    'rank': rank,
                    'documentation_name': entry.documentation_name,
                    'documentation_url': entry.documentation_url,
                    'percentage': round(entry.percentage, 2),
                    'total_score': round(entry.total_score, 2),
                    'max_score': round(entry.max_score, 2),
                    'model_used': entry.model_used,
                    'submitted_at': entry.submitted_at,
                    'user_id': entry.user_id
                }
                if entry.user:
                    entry_dict['user'] = {
                        'id': entry.user.id,
                        'name': entry.user.name,
                        'github_id': entry.user.github_id
                    }
                result.append(entry_dict)
            return result

    @staticmethod
    def get_entry_by_id(entry_id: int) -> Optional[Dict[str, Any]]:
        """Get a single leaderboard entry with full details"""
        with get_public_db() as session:
            entry = session.query(LeaderboardEntry).filter_by(id=entry_id).first()
            if not entry:
                return None

            rank = session.query(LeaderboardEntry).filter(
                LeaderboardEntry.is_visible == True,
                LeaderboardEntry.percentage > entry.percentage
            ).count() + 1

            entry_dict = {
                'id': entry.id,
                'rank': rank,
                'documentation_name': entry.documentation_name,
                'documentation_url': entry.documentation_url,
                'submitter_email': entry.submitter_email,
                'percentage': round(entry.percentage, 2),
                'total_score': round(entry.total_score, 2),
                'max_score': round(entry.max_score, 2),
                'model_used': entry.model_used,
                'submitted_at': entry.submitted_at,
                'evaluation_snapshot': entry.evaluation_snapshot,
                'is_visible': entry.is_visible,
                'user_id': entry.user_id
            }
            if entry.user:
                entry_dict['user'] = {
                    'id': entry.user.id,
                    'name': entry.user.name,
                    'github_id': entry.user.github_id
                }
            return entry_dict

    @staticmethod
    def hide_entry(entry_id: int) -> bool:
        """Hide a leaderboard entry (admin function)"""
        with get_public_db() as session:
            entry = session.query(LeaderboardEntry).filter_by(id=entry_id).first()
            if entry:
                entry.is_visible = False
                return True
            return False

    @staticmethod
    def unhide_entry(entry_id: int) -> bool:
        """Unhide a leaderboard entry"""
        with get_public_db() as session:
            entry = session.query(LeaderboardEntry).filter_by(id=entry_id).first()
            if entry:
                entry.is_visible = True
                return True
            return False

    @staticmethod
    def get_total_count() -> int:
        """Get total number of visible entries"""
        with get_public_db() as session:
            return session.query(LeaderboardEntry).filter_by(is_visible=True).count()

    @staticmethod
    def get_rank_for_percentage(percentage: float) -> int:
        """Get what rank a given percentage would achieve"""
        with get_public_db() as session:
            better_count = session.query(LeaderboardEntry).filter(
                LeaderboardEntry.is_visible == True,
                LeaderboardEntry.percentage > percentage
            ).count()
            return better_count + 1

