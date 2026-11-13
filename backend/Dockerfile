FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
# data/ (SQLite + uploads) is a volume; the price model is trained on first start if missing.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
