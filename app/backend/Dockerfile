# Use the official Playwright image which includes Python 3.12 and all browser dependencies
FROM mcr.microsoft.com/playwright/python:v1.42.0-jammy

WORKDIR /app

# Base image has Python but not ensurepip; venv module comes from distro package
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3-venv \
    && rm -rf /var/lib/apt/lists/*

# App dependencies live in a venv (avoids pip "running as root" / system site-packages warning)
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

RUN pip install --no-cache-dir --upgrade pip

# Install Python dependencies into the venv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install the Chromium browser (and omit others to save space)
RUN playwright install chromium

# Copy your backend source code
COPY . .

# Playwright creates a cache for browsers; we want to make sure it's accessible
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

EXPOSE 8001

# This ensures /app is always in the search path for imports
ENV PYTHONPATH=/app

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
