"""SageMaker inference server — implements /ping and /invocations on port 8080."""
from __future__ import annotations

import io
import os

import joblib
import numpy as np
from fastapi import FastAPI, Request, Response

app = FastAPI()
_model = None


def _load_model():
    global _model
    if _model is None:
        model_dir = os.environ.get("SM_MODEL_DIR", "/opt/ml/model")
        _model = joblib.load(os.path.join(model_dir, "model.joblib"))
    return _model


@app.get("/ping")
def ping():
    try:
        _load_model()
        return Response(status_code=200)
    except Exception:
        return Response(status_code=500)


@app.post("/invocations")
async def invocations(request: Request):
    body = await request.body()
    text = body.decode("utf-8")
    data = np.loadtxt(io.StringIO(text), delimiter=",").reshape(-1, 4)
    prediction = np.asarray(_load_model().predict(data), dtype=float).reshape(-1)
    return Response(
        content="\n".join(f"{v:.6g}" for v in prediction),
        media_type="text/plain",
    )
