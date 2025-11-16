const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;

// Middleware to parse JSON
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * Transform Sentry webhook payload to Teams Adaptive Card format
 */
function transformToTeamsCard(sentryPayload) {
  const action = sentryPayload.action || 'unknown';
  const data = sentryPayload.data || {};
  const issue = data.issue || {};
  const event = data.event || {};

  // Extract key information
  const title = issue.title || event.title || 'Sentry Alert';
  const message = event.message || issue.metadata?.value || issue.culprit || 'No message available';
  const level = issue.level || event.level || 'info';
  const project = sentryPayload.project_name || sentryPayload.project || 'Unknown Project';
  const url = issue.web_url || sentryPayload.url || '';

  // Determine color based on level
  const levelColors = {
    'fatal': 'attention',
    'error': 'attention',
    'warning': 'warning',
    'info': 'good',
    'debug': 'default'
  };
  const color = levelColors[level] || 'default';

  // Determine emoji based on level
  const levelEmojis = {
    'fatal': '🔴',
    'error': '🔴',
    'warning': '⚠️',
    'info': 'ℹ️',
    'debug': '🐛'
  };
  const emoji = levelEmojis[level] || '📢';

  // Build Adaptive Card
  const card = {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.2',
        body: [
          {
            type: 'TextBlock',
            text: `${emoji} Sentry Alert: ${action}`,
            weight: 'bolder',
            size: 'large',
            wrap: true
          },
          {
            type: 'FactSet',
            facts: [
              {
                title: 'Project',
                value: project
              },
              {
                title: 'Level',
                value: level.toUpperCase()
              },
              {
                title: 'Title',
                value: title
              }
            ]
          },
          {
            type: 'TextBlock',
            text: message,
            wrap: true,
            separator: true
          }
        ],
        actions: url ? [{
          type: 'Action.OpenUrl',
          title: 'View in Sentry',
          url: url
        }] : []
      }
    }]
  };

  return card;
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    webhookConfigured: !!TEAMS_WEBHOOK_URL
  });
});

/**
 * Main webhook endpoint
 */
app.post('/teams-hook', async (req, res) => {
  try {
    console.log('Received webhook from Sentry');
    console.log('Payload:', JSON.stringify(req.body, null, 2));

    // Check if Teams webhook URL is configured
    if (!TEAMS_WEBHOOK_URL) {
      console.error('TEAMS_WEBHOOK_URL not configured');
      return res.status(500).json({
        error: 'Teams webhook URL not configured'
      });
    }

    // Transform Sentry payload to Teams format
    const teamsCard = transformToTeamsCard(req.body);
    console.log('Transformed to Teams card:', JSON.stringify(teamsCard, null, 2));

    // Forward to Teams webhook
    const response = await axios.post(TEAMS_WEBHOOK_URL, teamsCard, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Successfully forwarded to Teams. Status:', response.status);

    res.json({
      success: true,
      message: 'Webhook forwarded to Teams',
      teamsResponse: response.status
    });

  } catch (error) {
    console.error('Error processing webhook:', error.message);
    if (error.response) {
      console.error('Teams API error:', error.response.status, error.response.data);
    }

    res.status(500).json({
      error: 'Failed to forward webhook',
      details: error.message
    });
  }
});

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    service: 'Sentry to Teams Webhook Proxy',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      webhook: '/teams-hook (POST)'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Sentry-Teams Webhook Proxy running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/teams-hook`);
  console.log(`Teams webhook configured: ${!!TEAMS_WEBHOOK_URL ? 'Yes' : 'No'}`);
});
