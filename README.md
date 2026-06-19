# Freepilot CLI

An autonomous AI coding agent for the terminal. Freepilot helps you write code, run commands, and manage your development workflow directly from the command line.

## Installation

```bash
npm install -g freepilot-cli
```

## Usage

```bash
freepilot
```

Follow the prompts to configure your API key and start using Freepilot.

## Configuration

Freepilot uses environment variables for configuration:

| Variable | Description | Default |
|---|---|---|
| `FREEPILOT_PROVIDER` | AI provider (e.g., `openrouter`) | `openrouter` |
| `OPENROUTER_API_KEY` | Your OpenRouter API key | - |
| `FREEPILOT_MODEL` | AI model to use | `google/gemini-2.0-flash-exp:free` |

You can create a `.env` file in your project root or set these variables in your shell.

## Features

- Autonomous coding assistance
- Terminal-native interface
- Multiple AI provider support
- File system operations
- Code generation and refactoring

## License

MIT
