# Sentry to Teams Webhook Proxy

A lightweight Docker-based proxy service that transforms Sentry webhook payloads into Microsoft Teams Adaptive Card format for Power Automate integration.

## Overview

This proxy solves the incompatibility between Sentry's webhook format and basic Teams webhooks in Power Automate. It receives webhooks from Sentry, transforms them into Teams-compatible Adaptive Cards, and forwards them to your Power Automate workflow.

Perfect for teams using Sentry (self-hosted or cloud) who want beautifully formatted alerts in Microsoft Teams without complex integrations.

## Features

- Transforms Sentry webhooks to Teams Adaptive Card format
- Docker-based for easy deployment
- Health check endpoint
- Comprehensive logging
- Support for different Sentry alert levels (error, warning, info, etc.)
- Color-coded messages based on severity
- Direct links to Sentry issues from Teams

## Project Structure

```
webhook-proxy/
├── src/
│   └── index.js          # Main application
├── Dockerfile            # Docker image configuration
├── docker-compose.yml    # Docker Compose setup
├── package.json          # Node.js dependencies
├── .env                  # Environment variables (contains webhook URL)
├── .env.example          # Example environment file
├── nginx-webhook.conf    # Nginx configuration for DNS access
├── PLAN.md              # Implementation plan
└── README.md            # This file
```

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Access to Sentry (self-hosted or cloud)
- Microsoft Power Automate with Teams connector
- A server or machine where you can run Docker containers

### 0. Get Your Teams Webhook URL from Power Automate

1. Go to [Power Automate](https://make.powerautomate.com)
2. Create a new **Instant cloud flow**
3. Choose **When an HTTP request is received** as the trigger
4. Add an action: **Post adaptive card in a chat or channel** (Teams connector)
5. Configure your Teams channel/chat
6. Save the flow and copy the **HTTP POST URL** that's generated
7. This URL is your `TEAMS_WEBHOOK_URL` for the `.env` file

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/dcoric/sentry-teams-webhook.git
cd sentry-teams-webhook

# Copy the example environment file
cp .env.example .env

# Edit .env and add your Teams webhook URL
nano .env  # or use your preferred editor
```

In the `.env` file, replace the placeholder with your actual Power Automate Teams webhook URL:
```
TEAMS_WEBHOOK_URL=https://prod-XX.westus.logic.azure.com:443/workflows/...
```

### 2. Deploy with Docker Compose

Build and start the container:

```bash
# Build and start the container
docker-compose up -d

# Check if it's running
docker-compose ps

# View logs
docker-compose logs -f
```

### 3. Test the Service

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

You should see:
```json
{
  "status": "ok",
  "timestamp": "2025-11-16T...",
  "webhookConfigured": true
}
```

### 4. Configure Sentry

In your Sentry project:

1. Go to **Settings** → **Integrations** → **WebHooks**
2. Add a new webhook with URL: `http://localhost:3000/teams-hook`
3. Select the events you want to receive (e.g., issue alerts)
4. Save the webhook

### 5. Test with Sentry

Trigger a test event in Sentry or use curl:

```bash
curl -X POST http://localhost:3000/teams-hook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "created",
    "data": {
      "issue": {
        "title": "Test Issue",
        "level": "error",
        "web_url": "https://sentry.example.com/issues/123"
      }
    },
    "project_name": "my-project"
  }'
```

You should receive a message in Teams!

## Access Methods

### Option 1: Local Access (Current Setup)

Use `http://localhost:3000/teams-hook` in Sentry configuration.

- **Pros**: Simple, no additional setup needed
- **Cons**: Only accessible from the local server

### Option 2: Public DNS Access (Production)

To make the webhook accessible from the internet (required if Sentry is on a different server):

#### Step 1: Install Nginx Configuration

```bash
# Edit the nginx config with your domain
sudo nano /etc/nginx/sites-available/your-domain.com

# Create symbolic link to sites-enabled
sudo ln -s /etc/nginx/sites-available/your-domain.com /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

Example nginx configuration (see `nginx-webhook.conf` in this repo):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /teams-hook {
        proxy_pass http://localhost:3000/teams-hook;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Step 2: Configure DNS

Add an A record for `your-domain.com` pointing to your server's public IP address.

#### Step 3: Add SSL with Let's Encrypt (Recommended)

```bash
# Install certbot if not already installed
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Certbot will automatically update the nginx config to use HTTPS
```

#### Step 4: Update Sentry

Change the webhook URL in Sentry to: `https://your-domain.com/teams-hook`

## API Endpoints

### GET /
Service information and available endpoints

### GET /health
Health check endpoint
- Returns service status
- Checks if Teams webhook URL is configured

### POST /teams-hook
Main webhook endpoint for receiving Sentry webhooks
- Accepts Sentry webhook payload
- Transforms to Teams Adaptive Card format
- Forwards to Power Automate

## Configuration

### Environment Variables

Edit `.env` file:

```bash
# Port for the webhook proxy server
PORT=3000

# Teams webhook URL from Power Automate
TEAMS_WEBHOOK_URL=https://your-webhook-url...
```

### Restart After Configuration Changes

```bash
docker-compose restart
```

## Monitoring

### View Logs

```bash
# Follow logs in real-time
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100
```

### Check Container Status

```bash
# List containers
docker-compose ps

# Check health
docker inspect sentry-teams-proxy --format='{{.State.Health.Status}}'
```

## Maintenance

### Update the Service

```bash
# Pull latest changes (if using git)
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Stop the Service

```bash
docker-compose down
```

### Remove Everything (including volumes)

```bash
docker-compose down -v
```

## Troubleshooting

### Webhook not forwarding to Teams

1. Check logs: `docker-compose logs -f`
2. Verify Teams webhook URL in `.env`
3. Test health endpoint: `curl http://localhost:3000/health`
4. Ensure container is running: `docker-compose ps`

### Sentry can't reach the webhook

1. Verify the proxy is accessible from Sentry server
2. Check firewall rules if using DNS access
3. Test connectivity: `curl http://localhost:3000/health` from Sentry server

### Teams webhook URL expired

Power Automate webhook URLs can expire. If you see 401/403 errors:

1. Generate a new webhook URL in Power Automate
2. Update `.env` file with new URL
3. Restart: `docker-compose restart`

## Teams Card Format

The proxy creates Adaptive Cards with:

- Alert emoji based on severity level (🔴 for errors, ⚠️ for warnings, etc.)
- Project name and alert level
- Issue title and message
- Action button linking to Sentry issue

### Example Card

```
🔴 Sentry Alert: created

Project: my-project
Level: ERROR
Title: TypeError: Cannot read property 'x' of undefined

Message details...

[View in Sentry] (button)
```

## Security Notes

- The `.env` file contains sensitive webhook URLs - keep it secure
- Consider using HTTPS (nginx with SSL) for production
- The Power Automate webhook URL includes authentication tokens
- Webhook URLs should not be committed to version control (see `.gitignore`)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Roadmap

Potential future enhancements:
- Support for other monitoring platforms (PagerDuty, Datadog, etc.)
- Customizable Adaptive Card templates
- Message filtering and routing rules
- Metrics and monitoring dashboard

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

If you encounter issues or have questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Contribute improvements via pull requests
