# Accessibility Compliance Auditor

Automated WCAG 2.2 accessibility auditing for digital products — catching violations in designs (Figma), code (GitHub PRs), and live URLs before they ship.

## Architecture

```
MLH/
├── frontend/                 # Next.js 15 React Application
│   ├── src/
│   │   ├── app/             # Pages (dashboard, landing)
│   │   ├── components/      # UI components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Frontend utilities
│   │   └── types/           # Shared TypeScript types
│   └── package.json
│
├── backend/                  # API Routes + Cloudinary + Snowflake + CI/CD
│   ├── src/
│   │   ├── app/api/         # Next.js API routes (serverless)
│   │   ├── lib/             # Cloudinary, Snowflake, color-fix
│   │   └── types/           # Shared TypeScript types
│   ├── cloudinary/          # Custom Cloudinary functions
│   │   ├── functions/       # Node.js version (legacy)
│   │   └── functions_python/# Python version (primary)
│   ├── figma-plugin/        # Figma plugin for real-time auditing
│   ├── .github/             # GitHub Actions CI/CD
│   └── package.json
│
├── .opencode/
│   └── config.json          # Ponytail agent skill config
└── README.md
```

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS v3 |
| **Image Analysis** | Cloudinary (upload, transformations, custom functions) |
| **Data & ML** | Snowflake (tables, streams, Cortex LLM, Cortex Search) |
| **Computer Vision** | Python (Pillow, OpenCV, pytesseract, NumPy) |
| **CI/CD** | GitHub Actions |
| **Design Tool** | Figma Plugin |

## Quick Start

### Prerequisites
- Node.js 18+
- Cloudinary account (free tier)
- Snowflake account (30-day trial)

### 1. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # Add your credentials
npm run dev
```
Opens at http://localhost:3000

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env.local  # Add your credentials

# Deploy Cloudinary Python function
pip install -r requirements-python.txt
npx cloudinary functions:deploy accessibility_analysis --path ./cloudinary/functions_python

# Run Snowflake setup
# Execute snowflake-setup.sql in Snowflake worksheet
```

### 3. Figma Plugin
1. Open Figma → Plugins → Development → New Plugin
2. Copy `backend/figma-plugin/code.ts` and `backend/figma-plugin/ui.html`
3. Run plugin, select a frame, get violations as sticky notes

### 4. CI/CD
- Add secrets to GitHub repo: `CLOUDINARY_*`, `SNOWFLAKE_*`, `AUDIT_API_URL`
- Push to trigger `.github/workflows/a11y-audit.yml`

## Core Features

| Feature | Implementation |
|---------|----------------|
| Pixel-level contrast (WCAG 1.4.3) | Cloudinary Python function |
| Focus indicator (WCAG 2.4.7) | Cloudinary function |
| Touch target sizing (WCAG 2.5.8) | Cloudinary function |
| Auto color correction | OKLab minimal ΔE algorithm |
| Annotated/fixed images | Cloudinary transformations + CDN |
| Audit history + regressions | Snowflake Stream + Task |
| LLM fix explanations | Cortex LLM (llama3.1-70b) |
| Semantic violation search | Cortex Search Service |
| VPAT PDF export | @react-pdf/renderer |
| GitHub PR comments | GitHub Action |
| Figma real-time violations | Figma Plugin |

## Environment Variables

Both `frontend/.env.local` and `backend/.env.local` need:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
SNOWFLAKE_ACCOUNT=your_account_identifier
SNOWFLAKE_USER=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_DATABASE=A11Y_AUDITOR
SNOWFLAKE_SCHEMA=PUBLIC
```

## Hackathon Submission Checklist

- [ ] Public GitHub repository
- [ ] Deployed demo (Vercel for frontend)
- [ ] 3-minute demo video
- [ ] Project presentation (PDF)
- [ ] Cloudinary implementation details
- [ ] Snowflake implementation details
- [ ] All links publicly accessible

## Ponytail Agent Skill

Configured in `.opencode/config.json`:
```json
{ "plugin": ["@dietrichgebert/ponytail"] }
```