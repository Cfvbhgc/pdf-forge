# PDF Forge

A PDF generator that renders professional documents from HTML templates using Puppeteer and Express. Upload or select a built-in template, substitute your data, and download a pixel-perfect PDF.

## Features

- **4 built-in templates** — invoice, report, resume, certificate
- **Simple REST API** — POST JSON, receive a PDF file
- **Template preview** — render any template with sample data in the browser
- **Variable substitution** — `{{placeholder}}` syntax with automatic array-to-HTML expansion
- **Docker-ready** — ships with a Dockerfile and docker-compose.yml that bundles Chromium
- **No external stylesheets** — all templates use inline CSS for reliable PDF rendering

## Tech Stack

| Layer       | Technology              |
|-------------|------------------------|
| Runtime     | Node.js 20+            |
| Framework   | Express 4              |
| PDF Engine  | Puppeteer (Chromium)   |
| Module style| CommonJS               |
| Container   | Docker + docker-compose|

## Project Structure

```
pdf-forge/
├── src/
│   ├── app.js                  # Entry point, Express setup, graceful shutdown
│   ├── config/
│   │   └── puppeteer.js        # Chromium launch options, PDF defaults
│   ├── routes/
│   │   ├── generate.js         # POST /api/generate
│   │   └── templates.js        # GET /api/templates, GET /api/templates/:name/preview
│   ├── services/
│   │   ├── pdfService.js       # Puppeteer browser management, HTML → PDF
│   │   └── templateEngine.js   # Load templates, substitute variables
│   ├── templates/
│   │   ├── invoice.html
│   │   ├── report.html
│   │   ├── resume.html
│   │   └── certificate.html
│   └── middleware/
│       ├── validate.js         # Request validation
│       └── errorHandler.js     # Global error handler
├── package.json
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md
```

## Quick Start

### Local (requires Node.js 20+ and Chromium)

```bash
# Install dependencies
npm install

# Copy environment config (optional — defaults work out of the box)
cp .env.example .env

# Start the server
npm start

# Or with auto-reload during development
npm run dev
```

The server starts on **http://localhost:3003**.

### Docker

```bash
# Build and start
docker compose up --build

# Or in detached mode
docker compose up -d --build

# View logs
docker compose logs -f pdf-forge

# Stop
docker compose down
```

## API Reference

### `GET /`

Health check. Returns service info and available endpoints.

### `GET /api/templates`

List all available templates with their metadata (description, required fields, sample data).

**Response:**

```json
{
  "success": true,
  "count": 4,
  "templates": [
    {
      "name": "invoice",
      "description": "Professional invoice with itemised line items...",
      "requiredFields": ["companyName", "clientName", "items", "tax", "dueDate"],
      "sampleData": { "..." }
    }
  ]
}
```

### `GET /api/templates/:name/preview`

Render a template with built-in sample data and return HTML. Open in a browser to visually inspect the template before generating a PDF.

**Example:** `http://localhost:3003/api/templates/invoice/preview`

### `POST /api/generate`

Generate a PDF from a template and data payload.

**Request body:**

```json
{
  "template": "invoice",
  "data": {
    "companyName": "Acme Corp",
    "clientName": "Jane Smith",
    "items": [
      { "name": "Consulting", "qty": 10, "price": 150 }
    ],
    "tax": 10,
    "dueDate": "2026-04-30"
  }
}
```

**Response:** PDF file (`Content-Type: application/pdf`)

**cURL example:**

```bash
curl -X POST http://localhost:3003/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "template": "invoice",
    "data": {
      "companyName": "Acme Corp",
      "companyAddress": "123 Business Ave, San Francisco, CA",
      "companyEmail": "billing@acme.com",
      "clientName": "Jane Smith",
      "clientAddress": "456 Client Rd, New York, NY",
      "invoiceNumber": "INV-001",
      "items": [
        { "name": "Web Design", "qty": 1, "price": 2500 },
        { "name": "Development", "qty": 40, "price": 150 }
      ],
      "tax": 10,
      "dueDate": "2026-04-30",
      "notes": "Payment due within 30 days."
    }
  }' \
  --output invoice.pdf
```

## Template Data Schemas

### Invoice

| Field           | Type     | Required | Description                        |
|-----------------|----------|----------|------------------------------------|
| companyName     | string   | Yes      | Your company name                  |
| companyAddress  | string   | No       | Company street address             |
| companyEmail    | string   | No       | Company email                      |
| companyPhone    | string   | No       | Company phone number               |
| invoiceNumber   | string   | No       | Invoice reference number           |
| clientName      | string   | Yes      | Client / recipient name            |
| clientAddress   | string   | No       | Client address                     |
| clientEmail     | string   | No       | Client email                       |
| items           | array    | Yes      | `[{ name, qty, price }]`          |
| tax             | number   | Yes      | Tax percentage (e.g. `10`)         |
| dueDate         | string   | Yes      | Payment due date                   |
| notes           | string   | No       | Footer notes                       |

### Report

| Field    | Type   | Required | Description                              |
|----------|--------|----------|------------------------------------------|
| title    | string | Yes      | Report title                             |
| author   | string | Yes      | Author name                              |
| date     | string | Yes      | Report date                              |
| sections | array  | Yes      | `[{ heading, content }]`                |
| summary  | string | Yes      | Executive summary text                   |

### Resume

| Field      | Type   | Required | Description                                      |
|------------|--------|----------|--------------------------------------------------|
| name       | string | Yes      | Full name                                        |
| email      | string | Yes      | Email address                                    |
| phone      | string | Yes      | Phone number                                     |
| location   | string | No       | City, State                                      |
| website    | string | No       | Personal website URL                             |
| summary    | string | Yes      | Professional summary paragraph                   |
| experience | array  | Yes      | `[{ company, role, period, description }]`      |
| skills     | array  | Yes      | `["JavaScript", "Node.js", ...]`                |
| education  | array  | Yes      | `[{ school, degree, year }]`                    |

### Certificate

| Field         | Type   | Required | Description                        |
|---------------|--------|----------|------------------------------------|
| recipientName | string | Yes      | Name of the certificate recipient  |
| courseName    | string | Yes      | Course or programme name           |
| date          | string | Yes      | Date of completion                 |
| issuer        | string | Yes      | Issuing person or organisation     |
| issuerTitle   | string | No       | Title of the issuer                |
| description   | string | Yes      | What was accomplished              |
| certificateId | string | No       | Unique certificate identifier      |

## Environment Variables

| Variable               | Default       | Description                                 |
|------------------------|---------------|---------------------------------------------|
| PORT                   | 3003          | Server port                                 |
| NODE_ENV               | development   | Environment mode                            |
| CHROMIUM_PATH          | (bundled)     | Path to Chromium binary                     |
| PUPPETEER_NO_SANDBOX   | false         | Disable Chromium sandbox (required in Docker)|
| PDF_FORMAT             | A4            | Default paper format                        |
| PDF_PRINT_BACKGROUND   | true          | Include background colours in PDF           |

## License

MIT
