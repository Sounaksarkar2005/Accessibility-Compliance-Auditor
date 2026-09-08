# Frontend - Accessibility Auditor UI

Next.js 15 frontend application for the Accessibility Compliance Auditor.

## Structure

```
frontend/
├── public/                 # Static assets
├── src/
│   ├── app/               # Next.js App Router pages
│   │   ├── dashboard/     # Main dashboard page
│   │   ├── globals.css    # Global styles
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Landing page (redirects to dashboard)
│   ├── components/        # React components
│   │   ├── DropZone.tsx   # File upload component
│   │   ├── ImageComparison.tsx  # Tabbed image viewer
│   │   └── ViolationCard.tsx    # Violation display
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Frontend utilities
│   │   └── utils.ts       # cn(), formatting helpers
│   └── types/             # Shared TypeScript types
│       └── index.ts       # Violation, Audit, Component types
├── package.json           # Frontend dependencies
├── tailwind.config.js     # Tailwind CSS v3 config
├── postcss.config.mjs     # PostCSS config
├── tsconfig.json          # TypeScript config
├── next.config.ts         # Next.js config
└── .env.local             # Environment variables (gitignored)
```

## Development

```bash
cd frontend
npm install
npm run dev
```

Opens at http://localhost:3000 (redirects to /dashboard)

## API Integration

The frontend communicates with the backend API routes:
- `POST /api/audit/upload` - Upload screenshot for analysis
- `GET /api/audit/results?auditId=` - Fetch analysis results
- `POST /api/audit/fix` - Get Cortex LLM fix explanation

## Key Features

- Drag & drop screenshot upload
- Tabbed image comparison (Original / Annotated / Fixed)
- Violation list with severity badges
- Cortex LLM-powered fix explanations
- VPAT report export (stubbed)
- GitHub PR comment copy (stubbed)