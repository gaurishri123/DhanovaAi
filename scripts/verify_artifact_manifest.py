"""Validate model artifact metadata and SHA-256 checksums."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

REQUIRED_ARTIFACTS = (
    "risk_model.joblib",
    "calibrator.joblib",
    "feature_columns.json",
    "model_version.txt",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_manifest(model_dir: Path, source_commit: str | None = None) -> dict:
    missing = [name for name in REQUIRED_ARTIFACTS if not (model_dir / name).is_file()]
    if missing:
        raise FileNotFoundError(f"Missing model artifacts: {missing}")
    columns = json.loads((model_dir / "feature_columns.json").read_text(encoding="utf-8"))
    version = (model_dir / "model_version.txt").read_text(encoding="utf-8").strip()
    return {
        "model_version": version,
        "feature_count": len(columns),
        "feature_columns": columns,
        "source_commit": source_commit,
        "artifacts": {
            name: {
                "bytes": (model_dir / name).stat().st_size,
                "sha256": sha256(model_dir / name),
            }
            for name in REQUIRED_ARTIFACTS
        },
        "synthetic_data_disclaimer": (
            "Artifacts are validated on generated data and are not production accuracy evidence."
        ),
    }


def verify_manifest(model_dir: Path, manifest_path: Path) -> dict:
    expected = json.loads(manifest_path.read_text(encoding="utf-8"))
    actual = build_manifest(model_dir, expected.get("source_commit"))
    for name, metadata in expected.get("artifacts", {}).items():
        if actual["artifacts"].get(name) != metadata:
            raise ValueError(f"Artifact checksum mismatch: {name}")
    if actual["feature_columns"] != expected.get("feature_columns"):
        raise ValueError("Feature schema mismatch")
    if actual["model_version"] != expected.get("model_version"):
        raise ValueError("Model version mismatch")
    return actual


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, default=Path("models"))
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    manifest_path = args.manifest or args.model_dir / "manifest.json"
    if args.write:
        manifest = build_manifest(args.model_dir)
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    else:
        verify_manifest(args.model_dir, manifest_path)
    print(f"Artifact manifest valid: {manifest_path}")


if __name__ == "__main__":
    main()
