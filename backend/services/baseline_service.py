"""Baseline correction service for documentation quality measurement"""

import time
from typing import Optional, Dict, Any, List
from database.models import get_db, BenchmarkResult
from database.services import BenchmarkResultService


class BaselineService:
    """
    Service for establishing and applying baseline corrections.

    Baseline = batch=1 score representing TRUE documentation quality.
    All batched runs are corrected against this baseline to remove
    in-context learning inflation.
    """

    @staticmethod
    def establish_baseline(model: str, doc_variant: str, temperature: float = 0.1) -> Dict[str, Any]:
        """
        Run batch=1 evaluation and store as baseline.

        Args:
            model: Model identifier (e.g., "claude-sonnet-4.5")
            doc_variant: Documentation variant (e.g., "mini_v3")
            temperature: Temperature for generation

        Returns:
            Dict with baseline_id, baseline_percentage, run_id, category_baselines
        """
        from backend.services.llm_service import LLMService
        from backend.services.evaluator import EvaluatorService

        print(f"Establishing baseline for {model} + {doc_variant}...")

        # Run baseline evaluation with batch=1
        llm_service = LLMService()
        result = llm_service.run_benchmark_concurrent(
            model,
            doc_variant,
            temperature=temperature,
            max_tokens=16000,
            batch_size=1,  # KEY: always batch=1 for baseline
            test_limit=None
        )

        run_id = result['run_id']
        print(f"  Baseline run complete: {run_id}")

        # Get and evaluate
        result_data = BenchmarkResultService.get_by_run_id(run_id)
        if not result_data:
            raise ValueError(f"Could not find result for {run_id}")

        evaluator = EvaluatorService()
        eval_result = evaluator.evaluate_responses(result_data['responses'])

        # Update evaluation
        BenchmarkResultService.update_evaluation(
            run_id=run_id,
            evaluation_results={
                'category_breakdown': eval_result['evaluation_results'],
                'level_breakdown': eval_result.get('level_breakdown', {})
            },
            total_score=eval_result['total_score'],
            max_score=eval_result['max_score'],
            percentage=eval_result['percentage']
        )

        print(f"  Evaluation complete: {eval_result['percentage']:.1f}%")

        # Extract category baselines
        category_baselines = {}
        for cat_name, cat_data in eval_result['evaluation_results'].items():
            category_baselines[cat_name] = {
                'baseline': cat_data.get('percentage', 0),
                'max': cat_data.get('max', 0),
                'score': cat_data.get('score', 0)
            }

        # Store baseline (import here to avoid circular dependency)
        from database.models import DocumentationBaseline

        with get_db() as session:
            # Deactivate old baselines for this model+doc
            old_baselines = session.query(DocumentationBaseline).filter_by(
                model=model,
                documentation_variant=doc_variant,
                is_active=True
            ).all()

            for old in old_baselines:
                old.is_active = False
                print(f"  Deactivated old baseline {old.id}")

            # Create new baseline
            baseline = DocumentationBaseline(
                model=model,
                documentation_variant=doc_variant,
                baseline_run_id=run_id,
                baseline_percentage=eval_result['percentage'],
                baseline_total_score=eval_result['total_score'],
                baseline_max_score=eval_result['max_score'],
                category_baselines=category_baselines,
                test_suite='full',
                total_tests=eval_result.get('tests_completed', 120),
                created_at=time.time(),
                is_active=True
            )
            session.add(baseline)
            session.flush()

            baseline_id = baseline.id

            # Mark the baseline run itself
            run = session.query(BenchmarkResult).filter_by(run_id=run_id).first()
            if run:
                run.baseline_id = baseline_id
                run.baseline_corrected_percentage = run.percentage
                run.learning_bonus = 0.0

            session.commit()

        print(f"✓ Baseline {baseline_id} established: {eval_result['percentage']:.1f}%")

        return {
            'baseline_id': baseline_id,
            'baseline_percentage': eval_result['percentage'],
            'baseline_total_score': eval_result['total_score'],
            'category_baselines': category_baselines,
            'run_id': run_id
        }

    @staticmethod
    def get_active_baseline(model: str, doc_variant: str) -> Optional[Dict[str, Any]]:
        """
        Get active baseline for model+doc combination.

        Returns:
            Baseline dict or None if not found
        """
        from database.models import DocumentationBaseline

        with get_db() as session:
            baseline = session.query(DocumentationBaseline).filter_by(
                model=model,
                documentation_variant=doc_variant,
                is_active=True
            ).first()

            if not baseline:
                return None

            return {
                'id': baseline.id,
                'baseline_percentage': baseline.baseline_percentage,
                'baseline_total_score': baseline.baseline_total_score,
                'baseline_max_score': baseline.baseline_max_score,
                'category_baselines': baseline.category_baselines,
                'baseline_run_id': baseline.baseline_run_id,
                'created_at': baseline.created_at
            }

    @staticmethod
    def apply_baseline_correction(run_id: str, model: str, doc_variant: str) -> Optional[Dict[str, Any]]:
        """
        Apply baseline correction to a completed run.

        Sets:
        - baseline_id: reference to baseline used
        - baseline_corrected_percentage: TRUE doc quality (from baseline)
        - learning_bonus: inflation from in-context learning

        Returns:
            Dict with correction info or None if failed
        """
        baseline = BaselineService.get_active_baseline(model, doc_variant)

        if not baseline:
            print(f"⚠ No baseline found for {model} + {doc_variant}, skipping correction")
            return None

        with get_db() as session:
            result = session.query(BenchmarkResult).filter_by(run_id=run_id).first()
            if not result:
                print(f"⚠ Run {run_id} not found")
                return None

            # Skip if this IS the baseline run
            if run_id == baseline['baseline_run_id']:
                result.baseline_id = baseline['id']
                result.baseline_corrected_percentage = result.percentage
                result.learning_bonus = 0.0
                session.commit()
                print(f"✓ Baseline run marked (no correction needed)")
                return {
                    'raw_percentage': result.percentage,
                    'corrected_percentage': result.percentage,
                    'learning_bonus': 0.0
                }

            # Apply correction: use baseline percentage as TRUE doc quality
            learning_bonus = result.percentage - baseline['baseline_percentage']

            result.baseline_id = baseline['id']
            result.baseline_corrected_percentage = baseline['baseline_percentage']
            result.learning_bonus = learning_bonus

            session.commit()

            print(f"✓ Baseline correction applied:")
            print(f"  Raw score: {result.percentage:.1f}%")
            print(f"  Corrected (TRUE doc quality): {result.baseline_corrected_percentage:.1f}%")
            print(f"  Learning bonus: {learning_bonus:+.1f}%")

            return {
                'raw_percentage': result.percentage,
                'corrected_percentage': result.baseline_corrected_percentage,
                'learning_bonus': learning_bonus
            }

    @staticmethod
    def list_baselines() -> List[Dict[str, Any]]:
        """List all active baselines"""
        from database.models import DocumentationBaseline

        with get_db() as session:
            baselines = session.query(DocumentationBaseline).filter_by(
                is_active=True
            ).order_by(DocumentationBaseline.created_at.desc()).all()

            return [
                {
                    'id': b.id,
                    'model': b.model,
                    'documentation_variant': b.documentation_variant,
                    'baseline_percentage': b.baseline_percentage,
                    'created_at': b.created_at,
                    'baseline_run_id': b.baseline_run_id
                }
                for b in baselines
            ]
