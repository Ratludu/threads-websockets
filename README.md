# WebSocket Threads Demo

Hey! This is a real-time comment system I built using WebSockets. People can chat in different threads and see messages pop up instantly.

## Getting Started

Just run these commands:

```bash
git clone https://github.com/yourusername/threads-websockets.git
cd threads-websockets
docker compose up -d
```

Then open http://localhost:3000 in your browser.

## What It Does

- Real-time comments that show up immediately
- Multiple chat threads (General, Tech, Random)
- Dark mode interface that looks pretty clean
- Works on phones and computers
- Easy to deploy with Docker

## How to Use

1. Pick a thread from the dropdown
2. Read the existing comments
3. Type your name and message
4. Hit send and watch it appear for everyone

## API Stuff

If you want to integrate with it:

- `GET /threads/{thread_id}/comments/` - Gets all comments for a thread
- `POST /threads/{thread_id}/comments/` - Adds a new comment
- `WS /ws/{thread_id}/comments/` - WebSocket for live updates

Comments look like this:
```json
{
  "comment_id": "some-uuid",
  "thread_id": "general",
  "author": "Your Name",
  "content": "Hello world!",
  "timestamp": "2024-01-01T12:00:00"
}
```

## Deploying

### On Your Computer
```bash
docker compose up -d
```

### On a VPS
```bash
# Get Docker first
curl -fsSL get.docker.com | sh
sudo apt install docker-compose-plugin

# Then deploy
git clone https://github.com/yourusername/threads-websockets.git
cd threads-websockets
docker compose up -d --build
```

### Add SSL (Optional)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Project Layout

```
threads-websockets/
├── backend/          # The FastAPI server and WebSocket stuff
├── frontend/         # HTML, CSS, and JavaScript
├── docker-compose.yml
└── README.md
```

## Tech Used

- **Backend**: FastAPI for the API, Redis for data storage, WebSockets for real-time
- **Frontend**: Plain HTML/CSS/JS with a dark theme
- **Deployment**: Docker containers with Nginx

## License

MIT - do whatever you want with it.