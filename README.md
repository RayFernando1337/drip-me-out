# 🎨 Anime Studio

An AI-powered image transformation app that transforms everyday objects into magical anime illustrations using cutting-edge machine learning and real-time backend processing. Built with Next.js and powered by Convex's revolutionary backend-as-a-service platform.

## Agent Guides

- Start with the root overview: [AGENTS.md](./AGENTS.md)
- Frontend app rules: [app/AGENTS.md](./app/AGENTS.md)
- Shared components rules: [components/AGENTS.md](./components/AGENTS.md)
- Convex backend rules: [convex/AGENTS.md](./convex/AGENTS.md)

Agents follow the closest-wins rule (see https://agents.md): read the nearest AGENTS.md in the folder tree first, then fall back to the root.

## ✨ Features

- **📸 Dual Input Methods**: Upload images or capture live photos with your webcam
- **🤖 AI-Powered Transformation**: Uses Google's Gemini 2.5 Flash model to transform objects into Studio Ghibli-inspired anime art
- **⚡ Real-Time Processing**: See generation status updates in real-time with Convex's reactive queries
- **🎨 Modern UI**: Built with shadcn/ui components and Tailwind CSS for a polished experience
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **🔄 Background Processing**: Convex's scheduler ensures reliable image processing even if users navigate away
- **💾 File Storage**: Secure image storage with Convex's built-in file management

## 🚀 Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Modern component library built on Radix UI
- **React Webcam** - Camera integration
- **Sonner** - Beautiful toast notifications

### Backend (Convex)
- **Convex Database** - Real-time NoSQL database with automatic schema management
- **Convex Storage** - Secure file upload and storage
- **Convex Scheduler** - Background job processing for AI image generation
- **Convex Actions** - Server-side functions with proper isolation

### AI Integration
- **Google Gemini 2.5 Flash** - Latest multimodal AI model for image transformation
- **Base64 Image Processing** - Efficient image data handling

## 🏗️ Architecture Highlights

### Powered by Convex's Game-Changing Features

**🔥 Real-Time Reactive Queries**
```typescript
const images = useQuery(api.images.getImages) || [];
```
Convex's reactive queries automatically update your UI when data changes, providing instant feedback during image processing.

**⚡ Background Job Scheduling**
```typescript
await ctx.scheduler.runAfter(0, internal.generate.generateImage, {
  storageId,
  originalImageId,
});
```
Process-intensive AI tasks run in the background, ensuring your app remains responsive and users never lose their work.

**💾 Secure File Storage**
```typescript
const uploadUrl = await generateUploadUrl();
// Upload directly to Convex Storage
const result = await fetch(uploadUrl, { method: "POST", body: file });
```
Files are uploaded directly to Convex's secure storage with automatic URL generation and access control.

**📊 Real-Time Status Updates**
```typescript
// Track processing status in real-time
images.some(img => img.generationStatus === 'pending' || img.generationStatus === 'processing')
```
Monitor AI generation progress with live status updates that automatically sync across all connected clients.

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- A Convex account ([sign up here](https://www.convex.dev/))
- Google Gemini API key

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd anime-studio
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Convex**
```bash
npx convex dev --once
```

4. **Configure environment variables**

Create a `.env.local` file:
```bash
CONVEX_DEPLOYMENT=your-convex-deployment-url
GEMINI_API_KEY=your-gemini-api-key
```

5. **Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app!

## 🎯 How It Works

1. **Upload or Capture**: Users can either upload an existing image or capture a live photo
2. **AI Processing**: Images are sent to Convex Storage, then scheduled for AI transformation using Gemini 2.5 Flash
3. **Real-Time Updates**: Users see live status updates as their images are processed
4. **Instant Results**: Transformed anime illustrations appear automatically once processing completes

## 🏆 Why Convex?

This app showcases Convex's most powerful features:

- **Zero-Config Backend**: No servers to manage, just write functions and deploy
- **Real-Time by Default**: Every query is reactive and updates automatically
- **Type Safety**: End-to-end TypeScript support with generated client libraries
- **Built-in Storage**: File uploads and management without external services
- **Background Processing**: Reliable job scheduling for long-running tasks
- **Developer Experience**: Hot reload, automatic deployments, and excellent DX

## 📁 Project Structure

```
anime-studio/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx          # Main application page
│   └── globals.css       # Global styles
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── Webcam.tsx        # Camera capture component
│   ├── ImagePreview.tsx  # Image gallery component
│   └── HeroGalleryDemo.tsx # Landing page hero animation
├── convex/               # Convex backend
│   ├── schema.ts         # Database schema
│   ├── images.ts         # Image CRUD operations
│   ├── generate.ts       # AI image transformation logic
│   └── https.ts          # HTTP utilities
└── lib/                  # Utility functions
```

## 🚀 Deployment

### Deploy to Convex
```bash
npx convex deploy
```

### Deploy to Vercel
```bash
npm run build
# Deploy using Vercel CLI or connect your GitHub repo
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **Convex** - For revolutionizing backend development
- **Google Gemini** - For powerful multimodal AI capabilities
- **shadcn/ui** - For beautiful, accessible UI components
- **Vercel** - For the best Next.js deployment platform

---

**Made with ❤️ and powered by Convex**
