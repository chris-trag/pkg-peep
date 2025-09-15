# Technical Specification

## Project Overview
**pkg-peep** is a Model Context Protocol (MCP) server that provides NPM package intelligence through two main tools: download statistics and package metadata retrieval.

## Architecture

### Core Components
- **MCP Server**: Built using `@modelcontextprotocol/sdk`
- **Transport**: StdioServerTransport for communication
- **APIs**: Direct HTTPS calls to NPM registry APIs (no authentication required)

### File Structure
```
pkg-peep/
├── index.js           # Main MCP server implementation
├── package.json       # Node.js package configuration
├── test.js           # Test suite
├── README.md         # User documentation
├── EXAMPLES.md       # Sample prompts and queries
├── SPEC.md           # This technical specification
├── LICENSE           # MIT license
└── .gitignore        # Git ignore rules
```

## API Endpoints Used

### NPM Downloads API
- **Base URL**: `https://api.npmjs.org/downloads/`
- **Point data**: `/point/{period}/{package}` - Single download count
- **Range data**: `/range/{start}:{end}/{package}` - Daily breakdown
- **Periods**: `last-day`, `last-week`, `last-month`
- **Date format**: YYYY-MM-DD

### NPM Registry API  
- **Base URL**: `https://registry.npmjs.org/`
- **Package data**: `/{package}` - Complete package metadata
- **No authentication required**

## MCP Tools

### 1. get_npm_downloads
**Purpose**: Retrieve download statistics for NPM packages

**Parameters**:
- `package` (required): NPM package name
- `period` (optional): `last-day`, `last-week`, `last-month`
- `startDate` (optional): Custom start date (YYYY-MM-DD)
- `endDate` (optional): Custom end date (YYYY-MM-DD)

**Logic**:
- If `startDate` and `endDate` provided: Use range API
- Otherwise: Use point API with period
- Default period: `last-week`

**Response**: JSON with download counts and date ranges

### 2. get_npm_package_info
**Purpose**: Retrieve comprehensive package metadata

**Parameters**:
- `package` (required): NPM package name

**Extracted Data**:
- Basic: name, description, latest version
- Versions: all published versions array
- Legal: license information
- Links: homepage, repository, bugs URL
- People: maintainers, author
- Dependencies: dependencies, devDependencies, peerDependencies
- Timestamps: created, modified dates

## Implementation Details

### Server Class: PkgPeepServer
- Initializes MCP server with name "pkg-peep" v1.0.0
- Registers two tools via `ListToolsRequestSchema`
- Handles tool calls via `CallToolRequestSchema`
- Graceful shutdown on SIGINT

### HTTP Requests
- Uses Node.js built-in `https` module
- Promise-based wrapper for async/await compatibility
- Error handling for network failures and invalid packages
- JSON parsing with error recovery

### Error Handling
- Invalid package names: Returns MCP error
- Network failures: Propagates as InternalError
- JSON parsing errors: Handled gracefully
- Non-existent packages: API returns error object

## Testing Strategy

### Test Suite (test.js)
1. **Tool Registration**: Verifies both tools are available
2. **Download Stats**: Tests with real packages (react, lodash)
3. **Time Periods**: Tests different period options
4. **Package Info**: Tests metadata retrieval
5. **Custom Dates**: Tests date range functionality
6. **Error Cases**: Tests non-existent packages

### Test Packages Used
- `react` - High download volume, stable
- `lodash` - Popular utility library
- `express` - Backend framework
- `nonexistent-package-12345-test` - Error testing

## Configuration

### Amazon Q CLI Integration
Location: `~/.aws/amazonq/mcp.json`
```json
{
  "mcpServers": {
    "pkg-peep": {
      "command": "node",
      "args": ["/path/to/pkg-peep/index.js"],
      "timeout": 120000,
      "disabled": false
    }
  }
}
```

### Claude Desktop Integration
Location: `~/Library/Application Support/Claude/claude_desktop_config.json`
```json
{
  "mcpServers": {
    "pkg-peep": {
      "command": "node",
      "args": ["/path/to/pkg-peep/index.js"]
    }
  }
}
```

## Development Commands
- `npm test` - Run test suite
- `npm start` - Start MCP server
- `node index.js` - Direct server execution
- `chmod +x index.js` - Make executable

## Dependencies
- `@modelcontextprotocol/sdk`: ^0.5.0 (MCP protocol implementation)
- Node.js: >=18.0.0 (ES modules, built-in fetch)

## Future Enhancement Ideas
- Batch package queries
- Package comparison tools
- Dependency tree analysis
- Security vulnerability integration
- Package popularity rankings
- Historical trend analysis

## Debugging
- Server logs to stderr
- JSON responses to stdout
- Test suite provides detailed output
- MCP protocol errors include descriptive messages
