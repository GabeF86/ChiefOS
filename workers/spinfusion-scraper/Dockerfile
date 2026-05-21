# Playwright bundles its own Chromium and matching system deps. Use the
# official Python-on-Playwright image so we don't have to install browsers.
FROM mcr.microsoft.com/playwright/python:v1.60.0-jammy

WORKDIR /app

COPY pyproject.toml ./
COPY app ./app

RUN pip install --no-cache-dir .

# Default entrypoint — Railway runs this on cron per railway.toml.
CMD ["python", "-m", "app.main"]
