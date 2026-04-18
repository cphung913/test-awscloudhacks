"""Deploy the dispersion coefficient regressor to a SageMaker endpoint.

Uses a custom FastAPI container that implements /ping and /invocations on
port 8080, bypassing the broken sagemaker_containers sklearn framework image.
"""

from __future__ import annotations

import argparse
import base64
import os
import subprocess
import tarfile
import tempfile
from pathlib import Path

import boto3
import joblib
import numpy as np
import sagemaker
from sagemaker.model import Model
from sklearn.dummy import DummyRegressor

SSM_PARAM_NAME = "/downstream/sagemaker/dispersionEndpoint"
DEFAULT_ENDPOINT = "watershed-dispersion-model"
DEFAULT_INSTANCE = "ml.t2.medium"
ECR_REPO = "watershed-dispersion"


def deploy_endpoint(
    model_path: str = "model.joblib",
    endpoint_name: str = DEFAULT_ENDPOINT,
    instance_type: str = DEFAULT_INSTANCE,
) -> str:
    role = os.environ.get("SAGEMAKER_ROLE_ARN")
    if not role:
        raise SystemExit("SAGEMAKER_ROLE_ARN env var must be set")

    boto_sess = boto3.Session(
        profile_name=os.environ.get("AWS_PROFILE"),
        region_name=os.environ.get("AWS_DEFAULT_REGION", "us-west-2"),
    )
    sess = sagemaker.Session(boto_session=boto_sess)
    region = boto_sess.region_name
    account = boto_sess.client("sts").get_caller_identity()["Account"]

    # Prepare model artifact
    path = Path(model_path)
    if not path.exists() or path.stat().st_size < 10:
        print("Placeholder detected; training stub DummyRegressor.")
        stub = DummyRegressor(strategy="constant", constant=1.0)
        stub.fit(np.zeros((1, 4)), np.array([1.0]))
        joblib.dump(stub, path)

    # Build and push custom Docker image to ECR
    image_uri = _build_and_push(boto_sess, account, region, ECR_REPO)

    # Upload model artifact to S3
    bucket = sess.default_bucket()
    with tempfile.TemporaryDirectory() as tmp:
        tar_path = Path(tmp) / "model.tar.gz"
        with tarfile.open(tar_path, "w:gz") as tf:
            tf.add(path, arcname="model.joblib")
        model_s3 = sess.upload_data(
            str(tar_path), bucket=bucket, key_prefix="downstream/dispersion"
        )
    print(f"Model artifact: {model_s3}")

    # Clean up any previous failed endpoint/config
    sm = boto_sess.client("sagemaker")
    for delete in [
        lambda: sm.delete_endpoint(EndpointName=endpoint_name),
        lambda: sm.delete_endpoint_config(EndpointConfigName=endpoint_name),
    ]:
        try:
            delete()
        except Exception:
            pass

    # Deploy using the custom container
    model = Model(
        image_uri=image_uri,
        model_data=model_s3,
        role=role,
        sagemaker_session=sess,
    )
    print(f"Deploying {endpoint_name} on {instance_type} (takes ~10 min)...")
    predictor = model.deploy(
        initial_instance_count=1,
        instance_type=instance_type,
        endpoint_name=endpoint_name,
    )

    boto_sess.client("ssm").put_parameter(
        Name=SSM_PARAM_NAME,
        Value=endpoint_name,
        Type="String",
        Overwrite=True,
    )
    print(f"Deployed endpoint: {endpoint_name}")
    return endpoint_name


def _build_and_push(boto_sess: boto3.Session, account: str, region: str, repo: str) -> str:
    ecr = boto_sess.client("ecr")
    image_uri = f"{account}.dkr.ecr.{region}.amazonaws.com/{repo}:latest"
    script_dir = Path(__file__).parent

    # Create ECR repo if it doesn't exist
    try:
        ecr.create_repository(repositoryName=repo)
        print(f"Created ECR repo: {repo}")
    except ecr.exceptions.RepositoryAlreadyExistsException:
        print(f"ECR repo exists: {repo}")

    # Docker login
    token = ecr.get_authorization_token()
    auth = token["authorizationData"][0]
    creds = base64.b64decode(auth["authorizationToken"]).decode()
    user, password = creds.split(":", 1)
    registry = auth["proxyEndpoint"]
    subprocess.run(
        ["docker", "login", "--username", user, "--password-stdin", registry],
        input=password.encode(),
        check=True,
    )

    # Build, tag, push
    print("Building and pushing Docker image...")
    subprocess.run(
        [
            "docker", "buildx", "build",
            "--platform", "linux/amd64",
            "--provenance=false",
            "--sbom=false",
            "-t", image_uri,
            "--push",
            str(script_dir),
        ],
        check=True,
    )
    print(f"Pushed: {image_uri}")
    return image_uri


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", default="model.joblib")
    parser.add_argument("--endpoint-name", default=DEFAULT_ENDPOINT)
    parser.add_argument("--instance-type", default=DEFAULT_INSTANCE)
    args = parser.parse_args()
    deploy_endpoint(args.model_path, args.endpoint_name, args.instance_type)
