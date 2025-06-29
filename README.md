# Video Flip-Scan

Transform videos of document pages into high-quality, searchable PDF files with AI-powered processing.

## Features

- 📹 **Video to PDF**: Upload a video of yourself flipping through pages
- 🤖 **AI Processing**: Automatic frame extraction and optimization
- 🔍 **OCR Support**: Create searchable PDFs (coming soon)
- 💫 **Smart Processing**: Blur detection and quality analysis
- 🎯 **Free & Pro Plans**: Start free, upgrade for advanced features

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (for backend services)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/videoscan.git
cd videoscan
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth, Database, Storage)
- **Processing**: Browser-based video frame extraction
- **PDF Generation**: pdf-lib (coming soon)

## Project Structure

```
videoscan/
├── src/
│   ├── app/           # Next.js app directory
│   ├── lib/           # Utility functions
│   └── types/         # TypeScript types
├── public/            # Static assets
└── supabase/          # Supabase functions (coming soon)
```

## Roadmap

- [x] Basic video upload interface
- [x] Frame extraction from video
- [ ] Supabase integration
- [ ] OCR processing
- [ ] PDF generation
- [ ] User authentication
- [ ] Free/Pro plan implementation
- [ ] Dashboard for scan history

## License

MIT