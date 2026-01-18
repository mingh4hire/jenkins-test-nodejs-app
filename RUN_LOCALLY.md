# Run Locally (Without Jenkins)

To run this application on your local machine:

## Quick Start

1. **Make sure Docker is running**

2. **Navigate to the project directory**
   ```bash
   cd test-nodejs-app
   ```

3. **Start all services**
   ```bash
   docker-compose up -d --build
   ```

4. **Access the application**
   - Frontend: http://localhost
   - Backend API: http://localhost:3000
   - Swagger Docs: http://localhost:3000/api-docs

## Stop the application

```bash
docker-compose down
```

## View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

## Rebuild after changes

```bash
docker-compose up -d --build
```

## Clean up (remove volumes)

```bash
docker-compose down -v
```

This will remove all data including uploaded images.
