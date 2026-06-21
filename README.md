# Freepilot CLI

An autonomous AI coding agent for the terminal.

## Installation

```bash
npm install -g freepilot-cli
```

## Quick Start

### 1. Run the setup wizard

```bash
freepilot init
```

This will prompt you for your API key and create a `.env` file automatically.

### 2. Start using Freepilot

```bash
freepilot
```

## Manual Configuration

Create a `.env` file in your project root (or `~/.config/freepilot/.env`) with your API key:

### OpenRouter (default, free tier available)

Get a **free API key** at https://openrouter.ai/keys

```env
FREEPILOT_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Free models to try:
- `deepseek/deepseek-v4-flash` (default)
- `qwen/qwen-2.5-coder-32b-instruct:free`
- `deepseek/deepseek-r1:free`
- `meta-llama/llama-3.3-70b-instruct:free`
- `google/gemma-3-27b-it:free`

### Ollama (local, completely free, no API key)

Install from https://ollama.ai and run:

```env
FREEPILOT_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=codellama
```

### DeepSeek (free API tier)

Get a free API key at https://platform.deepseek.com/api_keys

```env
FREEPILOT_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-your-deepseek-key-here
```

### OpenAI (requires API key)

```env
FREEPILOT_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key-here
```

## CLI Options

```bash
freepilot                          # Start interactive session
freepilot init                     # Create .env configuration file
freepilot -m <model>               # Specify AI model
freepilot -p <provider>            # Specify provider (openrouter, ollama, deepseek, openai)
freepilot -y                       # Auto-accept all file changes (non-interactive mode)
```

## Configuration Reference

| Variable | Description | Default |
|---|---|---|
| `FREEPILOT_PROVIDER` | AI provider | `openrouter` |
| `OPENROUTER_API_KEY` | OpenRouter API key | - |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `DEEPSEEK_API_KEY` | DeepSeek API key | - |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434/v1` |
| `OLLAMA_MODEL` | Ollama model name | `codellama` |
| `FREEPILOT_MODEL` | AI model override | (per provider default) |
| `FREEPILOT_MAX_TOKENS` | Max response tokens | `4096` |
| `FREEPILOT_TEMPERATURE` | Model temperature | `0.7` |
| `FREEPILOT_AUTO_ACCEPT` | Auto-accept changes | `false` |

## How API Key Configuration Works

Freepilot loads configuration in this order (later overrides earlier):
1. `~/.config/freepilot/.env` (global)
2. `./.env.local` (local overrides, gitignored)
3. `./.env` (project-specific)
4. Shell environment variables

This means you can set `OPENROUTER_API_KEY` in your shell profile (`~/.bashrc`, `~/.zshrc`) and it will be picked up automatically without any `.env` file:

```bash
export OPENROUTER_API_KEY="sk-or-v1-your-key-here"
```

## License

MIT
