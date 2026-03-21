# edith backend

Express + MongoDB API for ingesting, parsing, validating, and explaining X12 healthcare EDI files (837P/837I/835/834).

## Environment

Copy `.env.example` to `.env`:

- `PORT`
- `MONGO_URI`
- `FRONTEND_URL`
- `OPENAI_API_KEY` (optional for AI copilot)
- `OPENAI_MODEL`

## Run

```bash
npm install
npm run dev
```

## API Endpoints

- `GET /api/health`
- `POST /api/edi/upload` (multipart form-data, field: `file`)
- `POST /api/edi/apply-fix`
- `POST /api/edi/chat`
