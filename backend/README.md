# Backend - Accessibility Auditor API & Services

Backend services for the Accessibility Compliance Auditor including API routes, Cloudinary functions, Snowflake integration, and CI/CD.

## Structure

```
backend/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── audit/
│   │           ├── upload/route.ts    # Upload → Cloudinary → Snowflake
│   │           ├── results/route.ts   # Fetch violations + CDN URLs
│   │           └── fix/route.ts       # Cortex LLM explanations
│   ├── lib/
│   │   ├── cloudinary.ts              # Cloudinary client + URL helpers
│   │   ├── snowflake.ts               # Snowflake client + queries
│   │   ├── color-fix.ts               # OKLab contrast correction
│   │   └── utils.ts                   # Shared utilities
│   └── types/
│       └── index.ts                   # Shared TypeScript types
├── cloudinary/
│   ├── functions/                     # Node.js Cloudinary function (legacy)
│   │   └── accessibility_analysis.js
│   └── functions_python/              # Python Cloudinary function (primary)
│       └── accessibility_analysis.py
├── figma-plugin/
│   ├── code.ts                        # Figma plugin main thread
│   └── ui.html                        # Figma plugin UI
├── .github/
│   ├── workflows/
│   │   └── a11y-audit.yml             # GitHub Actions CI/CD
│   └── actions/
│       └── a11y-audit/                # Reusable GitHub Action
├── snowflake-setup.sql                # Full DDL + Cortex setup
├── requirements-python.txt            # Python deps for Cloudinary function
├── package.json                       # Backend dependencies
├── tsconfig.json                      # TypeScript config
└── .env.local                         # Environment variables (gitignored)
```

## Services

### API Routes (Next.js Serverless)
- `POST /api/audit/upload` - Accepts screenshot, triggers Cloudinary analysis, creates audit record
- `GET /api/audit/results` - Returns violations + annotated/fixed image CDN URLs
- `POST /api/audit/fix` - Generates Cortex LLM explanation for a violation

### Cloudinary Custom Function
- **Primary**: `cloudinary/functions_python/accessibility_analysis.py`
  - OCR text detection (Tesseract)
  - Per-pixel contrast sampling
  - Focus indicator detection
  - Touch target sizing
  - Auto color correction (OKLab minimal ΔE)
  - Returns violations + annotated/fixed images

### Snowflake Integration
- Tables: `audits`, `violations`, `components`, `violation_embeddings`
- Stream: `violation_stream` (real-time ingestion)
- Task: `regression_check_task` (hourly regression detection)
- Cortex LLM: `generate_fix_explanation` procedure (llama3.1-70b)
- Cortex Search: `violation_search_service` (semantic search)
- Native App Framework support

### Figma Plugin
- Real-time violation detection in Figma
- Exports frame → API → shows violations as sticky notes

### CI/CD (GitHub Actions)
- Triggers on PR with frontend changes
- Builds Storybook, captures screenshots
- Runs audit on changed components
- Posts results as PR comment

## Development

```bash
cd backend
npm install
# Set up .env.local with credentials
# Deploy Cloudinary function:
#   npx cloudinary functions:deploy accessibility_analysis --path ./cloudinary/functions_python
# Run Snowflake setup:
#   Execute snowflake-setup.sql in Snowflake worksheet
```

## Environment Variables

Required in `.env.local`:
```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SNOWFLAKE_ACCOUNT=
SNOWFLAKE_USER=
SNOWFLAKE_PASSWORD=
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_DATABASE=A11Y_AUDITOR
SNOWFLAKE_SCHEMA=PUBLIC
```

## Python Cloudinary Function

```bash
cd cloudinary/functions_python
pip install -r ../../requirements-python.txt
# Test locally:
python accessibility_analysis.py test-image.png
```