# MCP (Model Context Protocol) Setup Guide

This guide will help you set up Supabase and GitHub MCP servers for Claude in the VidPDF project.

## Prerequisites

- Node.js installed (already included in this project)
- Supabase account with project created
- GitHub account

## 1. Supabase MCP Setup

### Step 1: Create Supabase Personal Access Token

1. Go to your Supabase dashboard: https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Give it a descriptive name: "VidPDF MCP"
4. Select appropriate scopes (recommended: all scopes for full functionality)
5. Click "Generate token"
6. **Important**: Copy the token immediately - you won't be able to see it again!

### Step 2: Configure Environment Variable

Add the token to your `.env.local` file:

```bash
# Add this line to your existing .env.local
SUPABASE_MCP_TOKEN=your_supabase_personal_access_token_here
```

## 2. GitHub MCP Setup

### Step 1: Create GitHub Personal Access Token

1. Go to GitHub Settings: https://github.com/settings/tokens
2. Click "Generate new token (classic)" or use fine-grained tokens
3. Give it a descriptive name: "VidPDF MCP"
4. Select scopes:
   - `repo` (full control of private repositories)
   - `read:org` (read org and team membership)
   - `read:user` (read user profile data)
   - `project` (for project boards)
   - Additional scopes as needed
5. Set expiration (recommend: 90 days for security)
6. Click "Generate token"
7. **Important**: Copy the token immediately!

### Step 2: Configure Environment Variable

Add the token to your `.env.local` file:

```bash
# Add this line to your existing .env.local
GITHUB_MCP_TOKEN=your_github_personal_access_token_here
```

## 3. MCP Configuration

The `.mcp.json` file has been created with the following configuration:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--read-only",
        "--project-ref=lvvdgdrfkneklvnfeass",
        "--features=database,storage,functions,docs"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_MCP_TOKEN}"
      }
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "github-mcp-server@latest"
      ],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_MCP_TOKEN}"
      }
    }
  }
}
```

## 4. Using MCP Servers

### Supabase MCP Commands

Once configured, you can use commands like:
- Query database: "Show me all users in the database"
- Check storage: "List files in the frames bucket"
- View functions: "Show me the edge functions"
- Get project info: "What's the project configuration?"

### GitHub MCP Commands

With GitHub MCP, you can:
- Create issues: "Create a new issue for implementing user dashboard"
- List PRs: "Show me open pull requests"
- Check workflows: "What GitHub Actions are configured?"
- Manage repository: "Show repository settings"

## 5. Security Best Practices

### Token Security
- **Never commit tokens** to version control
- Use environment variables for all sensitive data
- Rotate tokens regularly (every 90 days recommended)
- Use minimal required scopes

### Read-Only Mode
- Supabase MCP is configured with `--read-only` flag by default
- This prevents accidental database modifications
- Remove this flag only when write operations are needed

### Feature Restrictions
- Only enabled features: database, storage, functions, docs
- This limits the MCP server to essential operations
- Add more features as needed: `--features=database,storage,functions,docs,account`

## 6. Troubleshooting

### MCP Not Working?
1. Ensure Node.js is installed: `node --version`
2. Check token validity in respective dashboards
3. Verify `.env.local` file has correct tokens
4. Restart Claude Code after configuration changes

### Permission Errors?
- Verify token has correct scopes
- For Supabase: Check project permissions
- For GitHub: Ensure repository access

### Connection Issues?
- Check internet connectivity
- Verify project reference ID is correct
- Ensure tokens haven't expired

## 7. Advanced Configuration

### Custom Supabase Features
Available feature groups:
- `account` - Account management
- `database` - Database operations
- `storage` - File storage management
- `functions` - Edge functions
- `docs` - Documentation access
- `debug` - Debugging tools
- `development` - Development features
- `branching` - Branch management

### Local vs Global Configuration
- Current setup uses project-level configuration (`.mcp.json`)
- For user-level config, use: `claude mcp add <server-name> -s user`
- For global config across all projects: Edit Claude's global config

## Next Steps

1. Add tokens to `.env.local`
2. Test Supabase connection: Ask Claude to list database tables
3. Test GitHub connection: Ask Claude to show repository info
4. Start using MCP for development tasks!

## Resources

- [Supabase MCP Documentation](https://supabase.com/docs/guides/getting-started/mcp)
- [GitHub MCP Server](https://github.com/github/github-mcp-server)
- [Model Context Protocol Docs](https://modelcontextprotocol.io/)