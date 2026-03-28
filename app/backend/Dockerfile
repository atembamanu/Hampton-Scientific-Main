# Use the official Playwright image which includes Python 3.12 and all browser dependencies
FROM mcr.microsoft.com/playwright/python:v1.42.0-jammy

WORKDIR /app

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Install Python dependencies
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

# The CMD remains the same
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]