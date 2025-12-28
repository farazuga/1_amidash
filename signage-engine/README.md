# Amidash NDI Signage Engine

A Node.js-based digital signage engine that outputs slides via NDI (Network Device Interface).

## Prerequisites

- **Node.js** 18+ (tested with Node.js 24)
- **NDI SDK** (for real NDI output)
- **Supabase** credentials (for data fetching)

## Quick Start (Mock NDI - No SDK Required)

```bash
cd signage-engine
npm install
npm run dev
```

This runs with a mock NDI sender (logs frames, no actual NDI output).
Preview available at: http://127.0.0.1:3001/preview

## Full Setup with Real NDI Output

### 1. Install NDI SDK

**macOS:**
```bash
# Option A: Download from NDI website
# https://ndi.video/download-ndi-sdk/

# Option B: Homebrew
brew install --cask ndi-tools
```

**Windows:**
- Download NDI SDK from https://ndi.video/download-ndi-sdk/
- Run the installer

**Linux:**
- Download NDI SDK from https://ndi.video/download-ndi-sdk/
- Extract to `/usr/local/lib/`

### 2. Install Dependencies

```bash
cd signage-engine
npm install
```

### 3. Fix NDI Library Path (macOS only)

The NDI native addon needs to find the NDI library at runtime:

```bash
# Create symlink to standard library location
sudo ln -sf "/Library/NDI SDK for Apple/lib/macOS/libndi.dylib" /usr/local/lib/libndi.dylib

# Add rpath to the addon
sudo install_name_tool -add_rpath "/Library/NDI SDK for Apple/lib/macOS" node_modules/@vygr-labs/ndi-node/build/Release/ndi_addon.node
```

### 4. Configure Environment

Create `.env` file:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

### 5. Run the Engine

```bash
npm run dev
```

You should see:
```
INFO: NDI SDK (@vygr-labs/ndi-node) loaded and initialized successfully
INFO: NDI sender initialized
    name: "Amidash Signage"
```

### 6. View NDI Output

Use any NDI receiver to view the output:
- **NDI Studio Monitor** (comes with NDI Tools)
- **OBS Studio** (with NDI plugin)
- **vMix**
- Any NDI-compatible video mixer

Look for source named: **"Amidash Signage"**

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Engine status and metrics |
| `/preview` | GET | PNG snapshot of current frame |
| `/start` | POST | Start the engine |
| `/stop` | POST | Stop the engine |

## Configuration

Edit `config/default.yaml`:

```yaml
ndi:
  name: "Amidash Signage"
  frameRate: 30

display:
  width: 3840
  height: 2160
  backgroundColor: "#053B2C"

slides:
  - type: "active-projects"
    enabled: true
    duration: 15000
```

## Troubleshooting

### "NDI SDK not available" warning
- NDI SDK is not installed, or library path is not set
- Run the symlink/rpath commands from step 3

### "library 'ndi' not found" during npm install
- Set library path before install:
  ```bash
  export LIBRARY_PATH="/Library/NDI SDK for Apple/lib/macOS:$LIBRARY_PATH"
  npm install @vygr-labs/ndi-node
  ```

### "Cannot find module 'readable-stream'"
```bash
npm install readable-stream
```

### Port 3001 already in use
```bash
lsof -ti:3001 | xargs kill -9
npm run dev
```

## Tech Stack

- **@napi-rs/canvas** - Canvas rendering (Node.js 24 compatible)
- **@vygr-labs/ndi-node** - NDI output
- **pino** - Logging
- **express** - API server
- **tsx** - TypeScript execution
