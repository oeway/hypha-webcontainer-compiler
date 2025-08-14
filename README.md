# Hypha WebContainer Compiler 🚀

A powerful browser-based compilation service that combines WebContainer API with Hypha RPC to provide remote code compilation, building, and artifact management capabilities directly in the browser.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![WebContainer](https://img.shields.io/badge/WebContainer-API-green.svg)
![Hypha](https://img.shields.io/badge/Hypha-RPC-purple.svg)

## 🌟 Features

- **Browser-Based Compilation**: Compile and build Node.js applications entirely in the browser using WebContainer API
- **Remote Service Integration**: Connect to Hypha servers for distributed compilation services
- **Artifact Management**: Upload source code and download compiled artifacts through Hypha's Artifact Manager
- **File System Explorer**: Interactive file tree viewer with real-time updates
- **Live Preview**: Built-in preview pane with iframe support for running applications
- **Authentication**: Secure token-based authentication with Hypha servers
- **Workspace Support**: Custom workspace configuration for team collaboration

## 🎯 Use Cases

- **Remote Compilation Service**: Run as a service in server-side browsers (Playwright) for compilation tasks
- **CI/CD Integration**: Automate builds and deployments through Hypha RPC
- **Educational Platform**: Teach coding with instant compilation and preview
- **Serverless Build System**: Compile TypeScript, bundle JavaScript, and build web apps without local tools

## 🚀 Quick Start

### Online Demo

Visit the live demo: [https://yourusername.github.io/hypha-webcontainer-compiler](https://yourusername.github.io/hypha-webcontainer-compiler)

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/hypha-webcontainer-compiler.git
cd hypha-webcontainer-compiler
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

4. **Open in browser**
```
http://localhost:5173/
```

## 📋 Prerequisites

- Modern browser with WebAssembly support (Chrome, Firefox, Edge, Safari)
- Hypha server (optional - uses public server by default)
- Node.js 16+ (for local development only)

## 🔧 Configuration

### URL Parameters

The service can be configured via URL query parameters:

- `server_url` - Hypha server URL (default: `https://hypha.aicell.io`)
- `workspace` - Custom workspace name (optional)
- `token` - Authentication token (optional, will prompt for login if not provided)
- `client_id` - Client identifier (optional)

**Examples:**

```
# With authentication token
http://localhost:5173/?server_url=https://hypha.aicell.io&token=YOUR_TOKEN

# With custom workspace
http://localhost:5173/?workspace=my-team-workspace

# Public access (will show login button)
http://localhost:5173/
```

## 💻 API Reference

Once connected, the service registers these RPC endpoints:

### `loadArtifact(artifactId, srcDir)`
Download and mount files from an artifact into WebContainer.

```javascript
await service.loadArtifact("my-source-code", "/src");
```

### `spawn(command, args)`
Execute commands in the WebContainer environment.

```javascript
await service.spawn("npm", ["install"]);
await service.spawn("npm", ["run", "build"]);
```

### `publishArtifact(srcDir, artifactId, targetDir)`
Upload compiled files to the artifact manager.

```javascript
await service.publishArtifact("/dist", "my-build-output", "/");
```

## 🏗️ Architecture

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────────┐
│  Hypha Client   │─────▶│ Hypha Server │◀─────│ Browser Service │
└─────────────────┘      └──────────────┘      └─────────────────┘
                               │                         │
                               ▼                         ▼
                        ┌──────────────┐         ┌──────────────┐
                        │   Artifact   │         │ WebContainer │
                        │   Manager    │         │     API      │
                        └──────────────┘         └──────────────┘
```

## 🎮 Test Compilation Workflow

Click the "Run Test Compilation" button to execute a complete workflow:

1. **Upload** - Creates test artifact with Express.js app
2. **Load** - Downloads files into WebContainer
3. **Install** - Runs `npm install` for dependencies
4. **Build** - Executes `npm run build` to create dist folder
5. **Publish** - Uploads dist folder to artifact manager
6. **Preview** - Starts server and shows live preview

## 🚢 Deployment

### GitHub Pages

1. **Build the project**
```bash
npm run build
```

2. **Deploy to GitHub Pages**
```bash
npm run deploy
```

**Important Note about CORS:** GitHub Pages doesn't natively support the required CORS headers for WebContainer API. This project includes a service worker (`coi-serviceworker.js`) that automatically adds the necessary headers:
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

The service worker is automatically registered when the page loads, enabling SharedArrayBuffer support required by WebContainer.

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview", "--", "--host"]
```

### Server-Side with Playwright

```python
from playwright.async_api import async_playwright

async def start_compiler_service():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        await page.goto(
            "https://yourusername.github.io/hypha-webcontainer-compiler"
            "?server_url=https://hypha.aicell.io"
            "&token=YOUR_TOKEN"
        )
        
        # Service runs indefinitely
        await page.wait_for_timeout(0)
```

## 🔒 Security

- All compilation happens in sandboxed WebContainer environment
- File system operations are isolated within the container
- Authentication via secure token-based system
- No direct access to host system resources

## 🛠️ Development

### Project Structure

```
hypha-webcontainer-compiler/
├── index.html          # Entry point
├── main.js            # Main application logic
├── style.css          # UI styles
├── files.js           # Test files for demo
├── package.json       # Project configuration
├── vite.config.js     # Vite configuration
├── public/            # Static assets
│   └── _headers       # CORS headers for GitHub Pages
└── .github/
    └── workflows/
        └── deploy.yml # GitHub Actions workflow
```

### Building from Source

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [WebContainer API](https://webcontainers.io/) by StackBlitz
- [Hypha RPC](https://github.com/amun-ai/hypha) framework
- The open-source community

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/hypha-webcontainer-compiler/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/hypha-webcontainer-compiler/discussions)
- **Documentation**: [Wiki](https://github.com/yourusername/hypha-webcontainer-compiler/wiki)

## 🔗 Links

- [Live Demo](https://yourusername.github.io/hypha-webcontainer-compiler)
- [WebContainer Docs](https://webcontainers.io/docs)
- [Hypha Documentation](https://ha.amun.ai/)
- [API Reference](./docs/API.md)

---

Built with ❤️ using WebContainer API and Hypha RPC