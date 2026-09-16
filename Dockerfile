FROM python:3.11-slim

WORKDIR /app

# Kopiowanie plików projektu
COPY . .

# Expose port 8888 (jak u Ciebie lokalnie)
EXPOSE 8888

# Uruchomienie Python HTTP servera
CMD ["python3", "-m", "http.server", "8888"]
