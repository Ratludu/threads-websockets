# Agent Guidelines for threads-websockets

## Build/Test Commands
- **Backend**: `cd backend && uv run ruff check && uv run ruff format && uv run python -m pytest` (no tests currently exist)
- **Frontend**: No linting/testing configured (plain HTML/CSS/JS)
- **Full stack**: `docker compose up -d --build` for development
- **Single test**: `cd backend && uv run python -m pytest tests/test_file.py::test_function`

## Code Style Guidelines

### Python (Backend)
- **Imports**: Standard library first, then third-party, then local imports
- **Formatting**: Use ruff for formatting and linting
- **Types**: Full type hints required (use `typing` module)
- **Naming**: snake_case for variables/functions, PascalCase for classes
- **Error handling**: Use FastAPI's HTTPException for API errors
- **Async**: All WebSocket and database operations must be async
- **Models**: Use Pydantic BaseModel for data validation

### JavaScript (Frontend)
- **Style**: Modern ES6+, camelCase for variables/functions
- **Error handling**: Try/catch with user-friendly alerts
- **DOM**: Use const for DOM elements that don't change
- **WebSocket**: Handle all connection states (connecting, connected, error, disconnected)

### Architecture
- **Backend**: FastAPI with Redis for data storage and pub/sub
- **WebSocket patterns**: Use ConnectionManager for connection lifecycle
- **Data flow**: API endpoints store data → Redis pub/sub → WebSocket broadcast
- **Thread isolation**: Each thread_id creates separate WebSocket channel

### Redis Keys
- Comments: `comment:{comment_id}` (hash)
- Thread comments: `thread:{thread_id}` (list of comment IDs)
- Pub/sub channels: `thread:{thread_id}`