# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint
```

## Project Architecture

### Overview

Uranus Control is a Next.js frontend for the Uranus system, featuring:
- MQTT-based remote terminal functionality (similar to GoTTY)
- Agent management dashboard
- User authentication system
- MongoDB integration for persistence

### Core Components

1. **Server Component**
   - Custom Next.js server with MQTT integration (`server.mjs`)
   - MongoDB connection for data persistence
   - MQTT client that subscribes to heartbeat and status topics
   - Agent online/offline tracking

2. **Authentication System**
   - User model with secure password handling
   - JWT-free authentication using cookies and localStorage
   - Login/logout flow with protected routes via middleware

3. **MQTT Communication**
   - Client-side MQTT connection (`mqttStore.js`)
   - Real-time agent status monitoring
   - Command execution via MQTT topics
   - Terminal session management

4. **Agent Management**
   - MongoDB persistence for agent data
   - Real-time agent data via MQTT heartbeats
   - Combined HTTP/MQTT agent data representation
   - Agent operations: register, delete, upgrade, execute commands

5. **Terminal Implementation**
   - MQTT-based terminal sessions
   - xterm.js frontend with various add-ons
   - Command routing through MQTT topics
   - Session lifecycle management

### Data Flow

1. **Agent Discovery and Status**
   - Agents send heartbeats to MQTT broker
   - Server receives and updates MongoDB
   - Client subscribes to MQTT topics for real-time updates
   - Combined view uses both persistent and real-time data

2. **Terminal Sessions**
   - Client creates terminal session via MQTT
   - Input sent through MQTT topics to agents
   - Output streamed back through response topics
   - xterm.js renders the terminal interface

3. **Authentication Flow**
   - Server validates credentials against MongoDB
   - Client stores authentication state in localStorage and cookies
   - Middleware and client-side protection for routes
   - Dual protection both server and client side

## Environment Configuration

The application uses a hierarchical environment loading system:
1. `.env.local` (highest priority for local development)
2. `.env.development`
3. `.env` (fallback defaults)

Key environment variables:
- `MONGODB_URI` - MongoDB connection string (default: mongodb://localhost:27017/uranus-control)
- `MQTT_BROKER` - MQTT broker URL (default: wss://mqtt.qfdk.me/mqtt)
- `PORT` - HTTP server port (default: 3000)

## Technology Stack

- **Frontend**: Next.js, React, TailwindCSS, Zustand
- **Backend**: Node.js, MongoDB/Mongoose
- **Communication**: MQTT
- **Terminal**: xterm.js with add-ons (fit, web-links, search)