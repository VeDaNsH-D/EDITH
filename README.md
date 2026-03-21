# EDITH

edith is a full-stack healthcare X12 platform for 837P/837I/835/834 ingestion, parsing, validation, AI explanations, and fix-revalidate workflows.

## Stack

- Frontend: React + Vite (`Frontend`), deploy to Vercel
- Backend: Node.js + Express (`Backend`), deploy to Render Web Service
- Database: MongoDB Atlas
- AI: OpenAI API (optional fallback mode without key)

## Architecture (based on your defined execution flow)

1. Ingest: file upload and transaction auto-detection from ISA/GS/ST
2. Interpret: parse segments/elements and build loop-aware hierarchy
3. Validate: structural + format + qualifier + cross-segment checks
4. Explain: plain-language issue descriptions and AI contextual Q&A
5. Correct: one-click deterministic fixes and immediate revalidation
6. Summarize: 835 claim remittance summary and 834 member roster table

## Local Run

### Backend

```bash
cd Backend
npm install
cp .env.example .env
npm run dev
```

### Frontend

```bash
cd Frontend
npm install
cp .env.example .env
npm run dev
```

## Deployment (Vercel + Render + MongoDB)

### 1) MongoDB Atlas

- Create Atlas cluster and database for edith
- Whitelist Render egress / allow required network access
- Copy connection string into Render as `MONGO_URI`

### 2) Render (backend)

- New Web Service from `Backend` folder
- Build command: `npm install`
- Start command: `npm start`
- Environment variables:
	- `PORT=8080`
	- `MONGO_URI=<atlas-uri>`
	- `FRONTEND_URL=<vercel-frontend-url>`
	- `OPENAI_API_KEY=<optional>`
	- `OPENAI_MODEL=gpt-4o-mini`

### 3) Vercel (frontend)

- Import repo and set root directory to `Frontend`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable:
	- `VITE_API_BASE_URL=https://<render-backend-domain>/api`

## Notes

- No Dockerfile required (aligned to your deployment preference).
- Project naming is kept as edith across backend, frontend, and docs.

## Sample Test Files

- Judge/demo-ready EDI files are in `samples/`:
	- `samples/valid-837P.edi`
	- `samples/malformed-837I.edi`
	- `samples/sample-835.edi`
	- `samples/sample-834.edi`
- See `samples/README.md` for expected outcomes.
