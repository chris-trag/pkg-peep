#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import https from 'https';

class PkgPeepServer {
  constructor() {
    this.server = new Server(
      {
        name: 'pkg-peep',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.server.onerror = (error) => console.error('[MCP Error]', error);

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async getPackageInfo(packageName) {
    const url = `https://registry.npmjs.org/${packageName}`;
    
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.error) {
              reject(new Error(result.error));
            } else {
              // Extract useful metadata
              const latest = result['dist-tags']?.latest;
              const latestVersion = result.versions?.[latest];
              
              resolve({
                name: result.name,
                description: result.description,
                latest: latest,
                versions: Object.keys(result.versions || {}),
                license: latestVersion?.license,
                keywords: result.keywords,
                homepage: result.homepage,
                repository: result.repository,
                bugs: result.bugs,
                maintainers: result.maintainers,
                author: result.author,
                created: result.time?.created,
                modified: result.time?.modified,
                dependencies: latestVersion?.dependencies,
                devDependencies: latestVersion?.devDependencies,
                peerDependencies: latestVersion?.peerDependencies
              });
            }
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  async getDownloads(packageName, period = 'last-week', startDate = null, endDate = null) {
    let url;
    
    if (startDate && endDate) {
      // Custom date range: YYYY-MM-DD:YYYY-MM-DD format
      url = `https://api.npmjs.org/downloads/range/${startDate}:${endDate}/${packageName}`;
    } else {
      // Predefined periods
      url = `https://api.npmjs.org/downloads/point/${period}/${packageName}`;
    }
    
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.error) {
              reject(new Error(result.error));
            } else {
              resolve(result);
            }
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_npm_downloads',
          description: 'Get NPM package download statistics',
          inputSchema: {
            type: 'object',
            properties: {
              package: {
                type: 'string',
                description: 'NPM package name',
              },
              period: {
                type: 'string',
                enum: ['last-day', 'last-week', 'last-month'],
                description: 'Predefined time period for download stats',
              },
              startDate: {
                type: 'string',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                description: 'Start date for custom range (YYYY-MM-DD format)',
              },
              endDate: {
                type: 'string', 
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                description: 'End date for custom range (YYYY-MM-DD format)',
              }
            },
            required: ['package'],
          },
        },
        {
          name: 'get_npm_package_info',
          description: 'Get comprehensive NPM package metadata',
          inputSchema: {
            type: 'object',
            properties: {
              package: {
                type: 'string',
                description: 'NPM package name',
              }
            },
            required: ['package'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!request.params.arguments) {
        throw new McpError(ErrorCode.InvalidParams, 'Missing arguments');
      }

      switch (request.params.name) {
        case 'get_npm_downloads':
          const { 
            package: packageName, 
            period = 'last-week', 
            startDate, 
            endDate 
          } = request.params.arguments;
          
          try {
            const data = await this.getDownloads(packageName, period, startDate, endDate);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          } catch (error) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get downloads for ${packageName}: ${error.message}`
            );
          }

        case 'get_npm_package_info':
          const { package: pkgName } = request.params.arguments;
          
          try {
            const data = await this.getPackageInfo(pkgName);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          } catch (error) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get package info for ${pkgName}: ${error.message}`
            );
          }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('pkg-peep MCP server running on stdio');
  }
}

const server = new PkgPeepServer();
server.run().catch(console.error);
