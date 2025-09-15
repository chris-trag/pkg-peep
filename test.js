#!/usr/bin/env node

/**
 * Test suite for pkg-peep MCP server
 * Tests both download stats and package info functionality
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPTester {
  constructor() {
    this.serverPath = join(__dirname, 'index.js');
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  async runTest(name, request, validator) {
    console.log(`\n🧪 Testing: ${name}`);
    
    try {
      const response = await this.sendRequest(request);
      const isValid = validator(response);
      
      if (isValid) {
        console.log(`✅ PASS: ${name}`);
        this.passed++;
      } else {
        console.log(`❌ FAIL: ${name}`);
        console.log('Response:', JSON.stringify(response, null, 2));
        this.failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${name} - ${error.message}`);
      this.failed++;
    }
  }

  async sendRequest(request) {
    return new Promise((resolve, reject) => {
      const server = spawn('node', [this.serverPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      server.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      server.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      server.on('close', (code) => {
        try {
          // Parse the JSON response from stdout
          const lines = stdout.trim().split('\n');
          const jsonLine = lines.find(line => line.startsWith('{'));
          if (jsonLine) {
            resolve(JSON.parse(jsonLine));
          } else {
            reject(new Error('No JSON response found'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });

      server.on('error', (error) => {
        reject(error);
      });

      // Send the request
      server.stdin.write(JSON.stringify(request) + '\n');
      server.stdin.end();
    });
  }

  async runAllTests() {
    console.log('🚀 Starting pkg-peep MCP tests...\n');

    // Test 1: List tools
    await this.runTest(
      'List available tools',
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      },
      (response) => {
        return response.result && 
               response.result.tools && 
               response.result.tools.length === 2 &&
               response.result.tools.some(t => t.name === 'get_npm_downloads') &&
               response.result.tools.some(t => t.name === 'get_npm_package_info');
      }
    );

    // Test 2: Get downloads for popular package
    await this.runTest(
      'Get downloads for "react"',
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'get_npm_downloads',
          arguments: {
            package: 'react'
          }
        }
      },
      (response) => {
        const content = response.result?.content?.[0]?.text;
        if (!content) return false;
        
        try {
          const data = JSON.parse(content);
          return data.package === 'react' && 
                 typeof data.downloads === 'number' &&
                 data.downloads > 0;
        } catch {
          return false;
        }
      }
    );

    // Test 3: Get downloads with custom period
    await this.runTest(
      'Get monthly downloads for "lodash"',
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'get_npm_downloads',
          arguments: {
            package: 'lodash',
            period: 'last-month'
          }
        }
      },
      (response) => {
        const content = response.result?.content?.[0]?.text;
        if (!content) return false;
        
        try {
          const data = JSON.parse(content);
          return data.package === 'lodash' && 
                 typeof data.downloads === 'number';
        } catch {
          return false;
        }
      }
    );

    // Test 4: Get package info
    await this.runTest(
      'Get package info for "express"',
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'get_npm_package_info',
          arguments: {
            package: 'express'
          }
        }
      },
      (response) => {
        const content = response.result?.content?.[0]?.text;
        if (!content) return false;
        
        try {
          const data = JSON.parse(content);
          return data.name === 'express' && 
                 data.description && 
                 data.latest &&
                 Array.isArray(data.versions);
        } catch {
          return false;
        }
      }
    );

    // Test 5: Handle non-existent package
    await this.runTest(
      'Handle non-existent package gracefully',
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'get_npm_downloads',
          arguments: {
            package: 'nonexistent-package-12345-test'
          }
        }
      },
      (response) => {
        // Should return an error for non-existent package
        return response.error && response.error.code;
      }
    );

    // Test 6: Custom date range
    await this.runTest(
      'Get downloads with custom date range',
      {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'get_npm_downloads',
          arguments: {
            package: 'react',
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          }
        }
      },
      (response) => {
        const content = response.result?.content?.[0]?.text;
        if (!content) return false;
        
        try {
          const data = JSON.parse(content);
          return data.package === 'react' && 
                 (data.downloads || Array.isArray(data.downloads));
        } catch {
          return false;
        }
      }
    );

    // Summary
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`);

    if (this.failed === 0) {
      console.log('\n🎉 All tests passed! pkg-peep is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Check the output above for details.');
      process.exit(1);
    }
  }
}

// Run tests
const tester = new MCPTester();
tester.runAllTests().catch(console.error);
