FROM python:3.11-slim

WORKDIR /app

# Copy the requirements file from the root folder
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your project files into the container
COPY . .

EXPOSE 7860

# Point Uvicorn to backend.main:app from the root workspace
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]