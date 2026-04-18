FROM python:3.11-slim

RUN pip install --no-cache-dir fastapi "uvicorn[standard]" joblib numpy scikit-learn

COPY serve.py /opt/ml/code/serve.py

# SageMaker invokes the container as: docker run <image> serve
# So /usr/local/bin/serve must exist and start the web server
RUN printf '#!/bin/bash\ncd /opt/ml/code && exec uvicorn serve:app --host 0.0.0.0 --port 8080\n' \
    > /usr/local/bin/serve && chmod +x /usr/local/bin/serve

EXPOSE 8080
