import './style.css'
import { WebContainer } from '@webcontainer/api';
import { files } from './files';

/** @type {import('@webcontainer/api').WebContainer}  */
let webcontainerInstance;

// Parse URL query parameters for Hypha connection
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    server_url: params.get('server_url') || 'https://hypha.aicell.io',
    workspace: params.get('workspace') || null,
    token: params.get('token') || null,
    client_id: params.get('client_id') || null
  };
}

// Helper function to recursively read directory contents
async function readDirectoryRecursive(fs, basePath = '/') {
  const files = {};
  
  async function readDir(path) {
    const entries = await fs.readdir(path, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
      
      if (entry.isDirectory()) {
        // Skip node_modules and other common build directories
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          await readDir(fullPath);
        }
      } else if (entry.isFile()) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          files[fullPath] = content;
        } catch (err) {
          console.warn(`Could not read file ${fullPath}:`, err);
        }
      }
    }
  }
  
  await readDir(basePath);
  return files;
}

// Helper function to write files recursively
async function writeFilesRecursive(fs, files) {
  for (const [path, content] of Object.entries(files)) {
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir && dir !== '') {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (err) {
        // Directory might already exist
      }
    }
    await fs.writeFile(path, content);
  }
}

window.addEventListener('load', async () => {
  console.log('Initializing WebContainer compilation service...');
  
  // Load xterm.js and fit addon
  const xtermCSS = document.createElement('link');
  xtermCSS.rel = 'stylesheet';
  xtermCSS.href = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css';
  document.head.appendChild(xtermCSS);
  
  const xtermScript = document.createElement('script');
  xtermScript.src = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js';
  await new Promise((resolve, reject) => {
    xtermScript.onload = resolve;
    xtermScript.onerror = reject;
    document.head.appendChild(xtermScript);
  });
  
  const xtermFitScript = document.createElement('script');
  xtermFitScript.src = 'https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js';
  await new Promise((resolve, reject) => {
    xtermFitScript.onload = resolve;
    xtermFitScript.onerror = reject;
    document.head.appendChild(xtermFitScript);
  });
  
  // Update UI with enhanced layout including terminal tab
  document.querySelector('#app').innerHTML = `
    <div class="container">
      <div class="header">
        <h2>🚀 WebContainer Compilation Service</h2>
        <div class="header-controls">
          <span id="status-message">Initializing...</span>
          <input type="text" id="workspace-input" placeholder="Workspace (optional)" style="padding: 5px 10px; border-radius: 4px; border: 1px solid #3e3e42; background: #1e1e1e; color: #cccccc; font-size: 13px; width: 150px; display: none;">
          <button id="login-button" class="test-button" style="display: none;">
            🔐 Login to Hypha
          </button>
          <button id="test-button" class="test-button" style="display: none;">
            Run Test Compilation
          </button>
        </div>
      </div>
      
      <div class="main-layout">
        <!-- Sidebar with File Tree -->
        <div class="sidebar">
          <div class="sidebar-header">
            File Explorer
            <button class="refresh-btn" id="refresh-tree" title="Refresh file tree">🔄</button>
          </div>
          <div class="file-tree" id="file-tree">
            <div class="empty-state">
              <div class="icon">📁</div>
              <div>No files loaded</div>
            </div>
          </div>
        </div>
        
        <!-- Content Area -->
        <div class="content-area">
          <div class="tabs">
            <button class="tab active" data-tab="logs">Console Logs</button>
            <button class="tab" data-tab="terminal">Terminal</button>
            <button class="tab" data-tab="file">File Viewer</button>
            <button class="tab" data-tab="preview">Preview</button>
          </div>
          
          <div class="tab-content active" id="logs-tab">
            <div id="test-result"></div>
            <div class="logs-container">
              <pre id="logs"></pre>
            </div>
          </div>
          
          <div class="tab-content" id="terminal-tab">
            <div id="terminal-container" style="width: 100%; height: 100%; background: #1e1e1e; padding:4px;"></div>
          </div>
          
          <div class="tab-content" id="file-tab">
            <div class="file-viewer">
              <div id="file-info" class="file-info">Select a file from the explorer to view its contents</div>
              <div id="file-content" class="file-content"></div>
            </div>
          </div>
          
          <div class="tab-content" id="preview-tab">
            <div class="preview-container" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
              <div id="preview-info" style="padding: 10px; background: #252526; border-bottom: 1px solid #3e3e42; font-size: 12px; color: #8b8b8b;">
                No preview available. Start a server to see the preview.
              </div>
              <iframe id="preview-iframe" style="flex: 1; width: 100%; border: none; background: white; display: none;"></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const statusEl = document.getElementById('status-message');
  const logsEl = document.getElementById('logs');
  const fileTreeEl = document.getElementById('file-tree');
  const fileContentEl = document.getElementById('file-content');
  const fileInfoEl = document.getElementById('file-info');
  
  let currentFilePath = null;
  
  function addLog(message) {
    logsEl.textContent += message + '\n';
    logsEl.scrollTop = logsEl.scrollHeight;
  }
  
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
      
      // Resize terminal when terminal tab is activated
      if (tab.dataset.tab === 'terminal' && fitAddon) {
        setTimeout(() => {
          fitAddon.fit();
        }, 0);
      }
    });
  });
  
  // File tree functions - make it globally accessible
  window.refreshFileTree = async function refreshFileTree() {
    if (!webcontainerInstance) {
      fileTreeEl.innerHTML = '<div class="empty-state"><div class="icon">📁</div><div>WebContainer not initialized</div></div>';
      return;
    }
    
    try {
      fileTreeEl.innerHTML = '<div class="loading">Loading file tree...</div>';
      const tree = await buildFileTree('/');
      
      if (Object.keys(tree).length === 0) {
        fileTreeEl.innerHTML = '<div class="empty-state"><div class="icon">📁</div><div>No files in container</div></div>';
      } else {
        fileTreeEl.innerHTML = renderFileTree(tree, '/');
        attachFileTreeEvents();
      }
    } catch (error) {
      fileTreeEl.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><div>Error loading files: ${error.message}</div></div>`;
    }
  }
  
  async function buildFileTree(path) {
    const tree = {};
    
    try {
      const entries = await webcontainerInstance.fs.readdir(path, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
        
        if (entry.isDirectory()) {
          // Skip certain directories
          if (!['node_modules', '.git'].includes(entry.name)) {
            tree[entry.name] = {
              type: 'directory',
              path: fullPath,
              children: await buildFileTree(fullPath)
            };
          }
        } else {
          tree[entry.name] = {
            type: 'file',
            path: fullPath
          };
        }
      }
    } catch (error) {
      console.warn(`Error reading directory ${path}:`, error);
    }
    
    return tree;
  }
  
  function renderFileTree(tree, parentPath, level = 0) {
    let html = '';
    
    // Sort entries: directories first, then files
    const entries = Object.entries(tree).sort(([aName, aVal], [bName, bVal]) => {
      if (aVal.type === 'directory' && bVal.type === 'file') return -1;
      if (aVal.type === 'file' && bVal.type === 'directory') return 1;
      return aName.localeCompare(bName);
    });
    
    for (const [name, item] of entries) {
      if (item.type === 'directory') {
        html += `
          <div class="tree-item directory" data-path="${item.path}">
            <span class="icon">📁</span>
            <span>${name}</span>
          </div>
          <div class="tree-children">
            ${renderFileTree(item.children, item.path, level + 1)}
          </div>
        `;
      } else {
        const icon = getFileIcon(name);
        html += `
          <div class="tree-item file" data-path="${item.path}">
            <span class="icon">${icon}</span>
            <span>${name}</span>
          </div>
        `;
      }
    }
    
    return html;
  }
  
  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
      'js': '📜',
      'jsx': '⚛️',
      'ts': '📘',
      'tsx': '⚛️',
      'json': '📋',
      'html': '🌐',
      'css': '🎨',
      'md': '📝',
      'txt': '📄',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'gif': '🖼️',
      'svg': '🖼️',
      'yaml': '⚙️',
      'yml': '⚙️',
      'xml': '📰',
      'sh': '🖥️',
      'env': '🔐'
    };
    return iconMap[ext] || '📄';
  }
  
  function attachFileTreeEvents() {
    document.querySelectorAll('.tree-item.file').forEach(item => {
      item.addEventListener('click', async () => {
        // Remove previous selection
        document.querySelectorAll('.tree-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        
        const path = item.dataset.path;
        await loadFileContent(path);
        
        // Switch to file viewer tab
        document.querySelector('[data-tab="file"]').click();
      });
    });
    
    // Toggle directory expansion (simplified - you could add collapse/expand)
    document.querySelectorAll('.tree-item.directory').forEach(item => {
      item.addEventListener('click', () => {
        const children = item.nextElementSibling;
        if (children && children.classList.contains('tree-children')) {
          children.style.display = children.style.display === 'none' ? 'block' : 'none';
        }
      });
    });
  }
  
  async function loadFileContent(path) {
    currentFilePath = path;
    fileInfoEl.textContent = `Loading: ${path}...`;
    fileContentEl.textContent = '';
    
    try {
      const content = await webcontainerInstance.fs.readFile(path, 'utf-8');
      const stats = { size: content.length };
      
      fileInfoEl.innerHTML = `
        <strong>File:</strong> ${path}<br>
        <strong>Size:</strong> ${formatFileSize(stats.size)}
      `;
      
      // Display content with basic syntax highlighting for code files
      if (isTextFile(path)) {
        fileContentEl.textContent = content;
      } else {
        fileContentEl.innerHTML = '<em>Binary file - cannot display content</em>';
      }
    } catch (error) {
      fileInfoEl.textContent = `Error loading file: ${path}`;
      fileContentEl.innerHTML = `<span style="color: #ff6b6b;">Error: ${error.message}</span>`;
    }
  }
  
  function isTextFile(path) {
    const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.md', '.txt', '.yml', '.yaml', '.xml', '.env', '.sh', '.log'];
    return textExtensions.some(ext => path.toLowerCase().endsWith(ext));
  }
  
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  // Refresh button
  document.getElementById('refresh-tree').addEventListener('click', () => {
    console.log('Refreshing file tree...');
    window.refreshFileTree();
  });
  
  // Initialize terminal variables
  let terminal = null;
  let terminalProcess = null;
  let fitAddon = null;
  
  // Function to initialize terminal
  async function initializeTerminal() {
    if (!webcontainerInstance) {
      console.error('WebContainer not initialized');
      return;
    }
    
    const terminalContainer = document.getElementById('terminal-container');
    if (!terminalContainer) return;
    
    // Create terminal instance
    terminal = new window.Terminal({
      convertEol: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      }
    });
    
    // Initialize fit addon
    fitAddon = new window.FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    
    // Open terminal in container
    terminal.open(terminalContainer);
    fitAddon.fit();
    
    // Resize terminal on window resize
    window.addEventListener('resize', () => {
      if (fitAddon && document.getElementById('terminal-tab').classList.contains('active')) {
        fitAddon.fit();
      }
    });
    
    // Start shell process
    terminalProcess = await webcontainerInstance.spawn('jsh', [], {
      terminal: {
        cols: terminal.cols,
        rows: terminal.rows,
      }
    });
    
    // Create a writer for the process input
    const input = terminalProcess.input.getWriter();
    
    // Connect terminal input to process
    terminal.onData((data) => {
      input.write(data);
    });
    
    // Connect process output to terminal
    terminalProcess.output.pipeTo(new WritableStream({
      write(data) {
        terminal.write(data);
      }
    }));
    
    // Handle terminal resize
    terminal.onResize(({ cols, rows }) => {
      if (terminalProcess.resize) {
        terminalProcess.resize({ cols, rows });
      }
    });
    
    addLog('✓ Terminal initialized');
  }
  
  try {
    // Initialize WebContainer first
    statusEl.textContent = 'Booting WebContainer...';
    webcontainerInstance = await WebContainer.boot();
    addLog('✓ WebContainer booted successfully');
    
    // Initialize terminal after WebContainer is ready
    await initializeTerminal();
    
    // Get connection parameters from URL
    const queryParams = getQueryParams();
    
    // Load Hypha RPC client
    statusEl.textContent = 'Loading Hypha RPC client...';
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hypha-rpc@0.20.66/dist/hypha-rpc-websocket.min.js';
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    
    addLog('✓ Hypha RPC client loaded');
    
    // Check if we have a token
    if (!queryParams.token) {
      // No token provided, show login button and workspace input
      statusEl.textContent = 'Login required';
      addLog('\n⚠️ No authentication token provided');
      addLog('Please login to connect to Hypha server and use the Artifact Manager');
      
      // Show login button and workspace input
      const loginButton = document.getElementById('login-button');
      const workspaceInput = document.getElementById('workspace-input');
      loginButton.style.display = 'block';
      workspaceInput.style.display = 'block';
      
      // Pre-fill workspace if provided in URL
      if (queryParams.workspace) {
        workspaceInput.value = queryParams.workspace;
      }
      
      loginButton.addEventListener('click', async () => {
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';
        
        try {
          addLog('\n🔐 Starting login process...');
          
          // Get workspace from input
          const workspace = workspaceInput.value.trim() || null;
          if (workspace) {
            addLog(`📁 Using workspace: ${workspace}`);
            queryParams.workspace = workspace;
          }
          
          // Prepare login config
          const loginConfig = {
            server_url: queryParams.server_url,
            login_callback: (context) => {
              addLog(`📋 Login URL: ${context.login_url}`);
              // Open login URL in new window
              window.open(context.login_url, '_blank');
            }
          };
          
          // Add workspace to login if specified
          if (workspace) {
            loginConfig.workspace = workspace;
          }
          
          // Use Hypha login
          const token = await window.hyphaWebsocketClient.login(loginConfig);
          
          addLog('✓ Login successful!');
          
          // Update URL with token and workspace (optional - for persistence)
          const newUrl = new URL(window.location);
          newUrl.searchParams.set('token', token);
          if (workspace) {
            newUrl.searchParams.set('workspace', workspace);
          }
          window.history.replaceState({}, '', newUrl);
          
          // Hide login controls and update status
          loginButton.style.display = 'none';
          workspaceInput.style.display = 'none';
          statusEl.textContent = 'Connecting to server...';
          
          // Now connect with the token
          await connectToServer(queryParams, token);
          
        } catch (error) {
          addLog(`✗ Login failed: ${error.message}`);
          loginButton.disabled = false;
          loginButton.textContent = '🔐 Login to Hypha';
        }
      });
      
      return; // Don't proceed without login
    }
    
    // We have a token, proceed with connection
    await connectToServer(queryParams, queryParams.token);
    
  } catch (error) {
    console.error('Initialization error:', error);
    statusEl.textContent = `Error: ${error.message}`;
    addLog(`✗ Fatal error: ${error.message}`);
  }
  
  // Extract the connection logic into a separate function
  async function connectToServer(queryParams, token) {
    statusEl.textContent = 'Connecting to Hypha server...';
    
    // Connect to Hypha server
    const connectionConfig = {
      server_url: queryParams.server_url
    };
    
    if (queryParams.workspace) {
      connectionConfig.workspace = queryParams.workspace;
    }
    
    if (token) {
      connectionConfig.token = token;
    }
    
    if (queryParams.client_id) {
      connectionConfig.client_id = queryParams.client_id;
    }
    
    const server = await window.hyphaWebsocketClient.connectToServer(connectionConfig);
    addLog(`✓ Connected to Hypha server at ${queryParams.server_url}`);
    addLog(`  Workspace: ${server.config.workspace}`);
    
    // Get artifact manager service
    const artifactManager = await server.getService("public/artifact-manager");
    addLog('✓ Connected to Artifact Manager service');
    
    // Define service functions
    async function loadArtifact(artifactId, srcDir) {
      addLog(`Loading artifact: ${artifactId} to ${srcDir || '/'}`);
      
      try {
        // Get artifact info
        const artifact = await artifactManager.read({
          artifact_id: artifactId,
          _rkwargs: true
        });
        
        // List files in the artifact
        const files = await artifactManager.list_files({
          artifact_id: artifactId,
          _rkwargs: true
        });
        
        addLog(`  Found ${files.length} files in artifact`);
        
        const targetDir = srcDir || '/';
        
        // Download and write each file
        for (const file of files) {
          // Handle different response formats from list_files
          let filePath;
          
          if (typeof file === 'string') {
            // If it's just a string, use it as the path
            filePath = file;
          } else if (file.name) {
            // If it has a name property, use that
            filePath = file.name;
          } else if (file.path) {
            // If it has a path property, use that
            filePath = file.path;
          } else if (file.key) {
            // If it has a key property, use that
            filePath = file.key;
          } else {
            // Skip if we can't determine the file path
            console.warn('Unknown file format:', file);
            continue;
          }
          
          // Check if it's actually a file (not a directory)
          const isFile = !file.type || file.type === 'file' || typeof file === 'string';
          
          if (isFile && filePath) {
            addLog(`  Downloading: ${filePath}`);
            
            // Get download URL
            const downloadUrl = await artifactManager.get_file({
              artifact_id: artifactId,
              file_path: filePath,
              _rkwargs: true
            });
            
            // Fetch file content
            const response = await fetch(downloadUrl);
            const content = await response.text();
            
            // Write to WebContainer
            const fullPath = targetDir === '/' ? `/${filePath}` : `${targetDir}/${filePath}`;
            const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
            
            if (dir && dir !== '') {
              await webcontainerInstance.fs.mkdir(dir, { recursive: true });
            }
            
            await webcontainerInstance.fs.writeFile(fullPath, content);
          }
        }
        
        addLog(`✓ Artifact ${artifactId} loaded successfully`);
        
        // Automatically refresh the file tree after loading
        await window.refreshFileTree();
        
        return { status: 'success', files_count: files.length };
        
      } catch (error) {
        addLog(`✗ Error loading artifact: ${error.message}`);
        throw error;
      }
    }
    
    async function spawn(command, args = []) {
      const commandStr = `${command} ${args.join(' ')}`;
      addLog(`Executing: ${commandStr}`);
      
      try {
        const process = await webcontainerInstance.spawn(command, args);
        
        // Capture output
        let output = '';
        let errorOutput = '';
        
        // Stream stdout
        process.output.pipeTo(new WritableStream({
          write(data) {
            output += data;
            addLog(`  ${data}`);
          }
        }));
        
        // Wait for process to complete
        const exitCode = await process.exit;
        
        addLog(`✓ Command completed with exit code: ${exitCode}`);
        
        return {
          exitCode,
          output,
          error: errorOutput,
          command: commandStr
        };
        
      } catch (error) {
        addLog(`✗ Error executing command: ${error.message}`);
        throw error;
      }
    }
    
    async function publishArtifact(srcDir, artifactId, targetDir) {
      addLog(`Publishing from ${srcDir} to artifact ${artifactId}`);
      
      try {
        // Read all files from source directory
        const files = await readDirectoryRecursive(webcontainerInstance.fs, srcDir);
        
        // Create or edit artifact
        let artifact;
        try {
          // Try to get existing artifact
          artifact = await artifactManager.read({
            artifact_id: artifactId,
            _rkwargs: true
          });
          
          // Edit existing artifact
          await artifactManager.edit({
            artifact_id: artifactId,
            stage: true,
            version: "new",
            _rkwargs: true
          });
          
        } catch (err) {
          // Create new artifact if it doesn't exist
          artifact = await artifactManager.create({
            alias: artifactId,
            manifest: {
              name: artifactId,
              description: `Build output from WebContainer compilation service`
            },
            stage: true,
            _rkwargs: true
          });
        }
        
        // Upload each file
        let uploadedCount = 0;
        for (const [filePath, content] of Object.entries(files)) {
          // Remove leading slash and srcDir from path
          let relativePath = filePath;
          if (relativePath.startsWith(srcDir)) {
            relativePath = relativePath.slice(srcDir.length);
          }
          if (relativePath.startsWith('/')) {
            relativePath = relativePath.slice(1);
          }
          
          // Add targetDir if specified
          if (targetDir && targetDir !== '/') {
            relativePath = `${targetDir}/${relativePath}`;
          }
          
          addLog(`  Uploading: ${relativePath}`);
          
          // Get pre-signed upload URL
          const uploadUrl = await artifactManager.put_file({
            artifact_id: artifact.id,
            file_path: relativePath,
            _rkwargs: true
          });
          
          // Upload file content
          const response = await fetch(uploadUrl, {
            method: 'PUT',
            body: content,
            headers: {
              'Content-Type': 'text/plain'
            }
          });
          
          if (!response.ok) {
            throw new Error(`Failed to upload ${relativePath}: ${response.statusText}`);
          }
          
          uploadedCount++;
        }
        
        // Commit the artifact
        await artifactManager.commit({
          artifact_id: artifact.id,
          _rkwargs: true
        });
        
        addLog(`✓ Published ${uploadedCount} files to artifact ${artifact.id}`);
        
        return {
          status: 'success',
          artifact_id: artifact.id,
          files_count: uploadedCount
        };
        
      } catch (error) {
        addLog(`✗ Error publishing: ${error.message}`);
        throw error;
      }
    }
    
    // Keep track of running processes
    const runningProcesses = new Map();
    let processIdCounter = 0;
    
    // File System Operations
    async function fs_mkdir(path, options = {}) {
      addLog(`📁 Creating directory: ${path}`);
      await webcontainerInstance.fs.mkdir(path, options);
      return { success: true, path };
    }
    
    async function fs_readdir(path, options = {}) {
      addLog(`📂 Reading directory: ${path}`);
      const entries = await webcontainerInstance.fs.readdir(path, options);
      return entries;
    }
    
    async function fs_readFile(path, encoding = 'utf-8') {
      addLog(`📄 Reading file: ${path}`);
      const content = await webcontainerInstance.fs.readFile(path, encoding);
      return content;
    }
    
    async function fs_writeFile(path, data, options = {}) {
      addLog(`✏️ Writing file: ${path}`);
      await webcontainerInstance.fs.writeFile(path, data, options);
      await window.refreshFileTree(); // Auto-refresh file tree
      return { success: true, path };
    }
    
    async function fs_rm(path, options = {}) {
      addLog(`🗑️ Removing: ${path}`);
      await webcontainerInstance.fs.rm(path, options);
      await window.refreshFileTree(); // Auto-refresh file tree
      return { success: true, path };
    }
    
    async function fs_rename(oldPath, newPath) {
      addLog(`📝 Renaming: ${oldPath} → ${newPath}`);
      await webcontainerInstance.fs.rename(oldPath, newPath);
      await window.refreshFileTree(); // Auto-refresh file tree
      return { success: true, oldPath, newPath };
    }
    
    // Mount a file system tree
    async function mount(tree, options = {}) {
      addLog(`📦 Mounting file system tree...`);
      await webcontainerInstance.mount(tree, options);
      await window.refreshFileTree();
      return { success: true, message: 'File system tree mounted' };
    }
    
    // Export filesystem
    async function exportFS(path = '/', options = {}) {
      addLog(`📤 Exporting filesystem from: ${path}`);
      const data = await webcontainerInstance.export(path, options);
      
      // Convert to base64 if binary data
      if (data instanceof Uint8Array) {
        const base64 = btoa(String.fromCharCode(...data));
        return { type: 'binary', data: base64, path };
      }
      
      return { type: 'json', data, path };
    }
    
    // Enhanced spawn with process tracking
    async function spawnWithTracking(command, args = [], options = {}) {
      const processId = `proc_${++processIdCounter}`;
      addLog(`🚀 Spawning process [${processId}]: ${command} ${args.join(' ')}`);
      
      try {
        const process = await webcontainerInstance.spawn(command, args, options);
        
        // Store process reference
        runningProcesses.set(processId, {
          id: processId,
          command,
          args,
          process,
          startTime: new Date().toISOString()
        });
        
        // Capture output
        let output = '';
        let errorOutput = '';
        
        if (options.output !== false) {
          process.output.pipeTo(new WritableStream({
            write(data) {
              output += data;
              addLog(`  [${processId}] ${data}`);
            }
          }));
        }
        
        // Wait for exit and clean up
        process.exit.then(exitCode => {
          runningProcesses.delete(processId);
          addLog(`✅ Process [${processId}] exited with code: ${exitCode}`);
        });
        
        return {
          processId,
          command,
          args,
          startTime: new Date().toISOString()
        };
        
      } catch (error) {
        addLog(`❌ Failed to spawn process: ${error.message}`);
        throw error;
      }
    }
    
    // Kill a process
    async function killProcess(processId) {
      const proc = runningProcesses.get(processId);
      if (!proc) {
        throw new Error(`Process ${processId} not found`);
      }
      
      addLog(`⛔ Killing process [${processId}]`);
      proc.process.kill();
      runningProcesses.delete(processId);
      
      return { success: true, processId };
    }
    
    // List running processes
    async function listProcesses() {
      const processes = Array.from(runningProcesses.values()).map(p => ({
        id: p.id,
        command: p.command,
        args: p.args,
        startTime: p.startTime
      }));
      
      return processes;
    }
    
    // Get WebContainer info
    async function getInfo() {
      return {
        status: 'ready',
        workdir: webcontainerInstance.workdir,
        path: webcontainerInstance.path,
        processes: runningProcesses.size,
        features: {
          fileSystem: true,
          spawn: true,
          mount: true,
          export: true,
          artifactIntegration: true
        }
      };
    }
    
    // Register the comprehensive WebContainer service
    const service = await server.registerService({
      id: 'webcontainer-compiler',
      name: 'WebContainer Compilation Service',
      description: 'A comprehensive service for code compilation, file system operations, and process management using WebContainer',
      config: {
        visibility: 'public',
        require_context: false
      },
      
      // Original compilation functions
      loadArtifact: loadArtifact,
      spawn: spawn,
      publishArtifact: publishArtifact,
      
      // File System operations
      fs: {
        mkdir: fs_mkdir,
        readdir: fs_readdir,
        readFile: fs_readFile,
        writeFile: fs_writeFile,
        rm: fs_rm,
        rename: fs_rename
      },
      
      // Mount and export
      mount: mount,
      export: exportFS,
      
      // Process management
      spawnProcess: spawnWithTracking,
      killProcess: killProcess,
      listProcesses: listProcesses,
      
      // System info
      getInfo: getInfo,
    });
    
    statusEl.textContent = 'Service registered and ready!';
    addLog(`✓ Service registered with ID: ${service.id}`);
    addLog(`\n📚 Service Endpoints:`);
    
    addLog(`\n🔧 Compilation & Artifacts:`);
    addLog(`  • loadArtifact(artifactId, srcDir) - Load files from artifact`);
    addLog(`  • publishArtifact(srcDir, artifactId, targetDir) - Upload build output`);
    
    addLog(`\n📁 File System Operations:`);
    addLog(`  • fs.mkdir(path, options) - Create directory`);
    addLog(`  • fs.readdir(path, options) - List directory contents`);
    addLog(`  • fs.readFile(path, encoding) - Read file content`);
    addLog(`  • fs.writeFile(path, data, options) - Write file`);
    addLog(`  • fs.rm(path, options) - Remove file/directory`);
    addLog(`  • fs.rename(oldPath, newPath) - Rename file/directory`);
    
    addLog(`\n🚀 Process Management:`);
    addLog(`  • spawn(command, args) - Simple command execution`);
    addLog(`  • spawnProcess(command, args, options) - Tracked process with ID`);
    addLog(`  • killProcess(processId) - Kill a running process`);
    addLog(`  • listProcesses() - List all running processes`);
    
    addLog(`\n📦 Advanced Features:`);
    addLog(`  • mount(tree, options) - Mount file system tree`);
    addLog(`  • export(path, options) - Export filesystem as JSON/binary`);
    addLog(`  • getInfo() - Get WebContainer system information`);
    
    addLog(`\n🔗 Service URL: ${queryParams.server_url}/${server.config.workspace}/services/${service.id.split(':')[1]}`);
    
    // Show and setup test button functionality
    const testButton = document.getElementById('test-button');
    const testResultEl = document.getElementById('test-result');
    testButton.style.display = 'block';
    testButton.textContent = 'Run Test Compilation'; // Ensure correct text
    
    testButton.addEventListener('click', async () => {
      testButton.disabled = true;
      testButton.textContent = 'Running test...';
      testResultEl.style.display = 'none';
      
      addLog('\n========== STARTING TEST COMPILATION ==========');
      
      try {
        // Step 1: Create a test artifact and upload files from files.js
        addLog('\n📤 Step 1: Creating test source artifact...');
        
        const timestamp = Date.now();
        const sourceArtifactId = `test-source-${timestamp}`;
        
        // Create the source artifact
        const sourceArtifact = await artifactManager.create({
          alias: sourceArtifactId,
          manifest: {
            name: `Test Source ${timestamp}`,
            description: 'Test source code for WebContainer compilation service'
          },
          stage: true,
          _rkwargs: true
        });
        
        addLog(`  Created artifact: ${sourceArtifact.id}`);
        
        // Upload each file from files.js
        for (const [fileName, fileData] of Object.entries(files)) {
          if (fileData.file && fileData.file.contents) {
            addLog(`  Uploading: ${fileName}`);
            
            // Get upload URL
            const uploadUrl = await artifactManager.put_file({
              artifact_id: sourceArtifact.id,
              file_path: fileName,
              _rkwargs: true
            });
            
            // Upload the file
            const response = await fetch(uploadUrl, {
              method: 'PUT',
              body: fileData.file.contents,
              headers: {
                'Content-Type': 'text/plain'
              }
            });
            
            if (!response.ok) {
              throw new Error(`Failed to upload ${fileName}: ${response.statusText}`);
            }
          }
        }
        
        // Commit the source artifact
        await artifactManager.commit({
          artifact_id: sourceArtifact.id,
          _rkwargs: true
        });
        
        addLog(`✓ Source artifact created: ${sourceArtifact.id}`);
        
        // Step 2: Load the artifact using our service
        addLog('\n📥 Step 2: Loading artifact into WebContainer...');
        const loadResult = await loadArtifact(sourceArtifact.id, '/');
        addLog(`✓ Loaded ${loadResult.files_count} files`);
        
        // Refresh file tree after loading
        await window.refreshFileTree();
        
        // Step 3: Install dependencies
        addLog('\n📦 Step 3: Installing dependencies...');
        const installResult = await spawn('npm', ['install']);
        
        if (installResult.exitCode !== 0) {
          throw new Error(`npm install failed with exit code ${installResult.exitCode}`);
        }
        addLog('✓ Dependencies installed successfully');
        
        // Refresh file tree after npm install (to show node_modules)
        await window.refreshFileTree();
        
        // Step 4: Build the application (create a simple dist folder for demo)
        addLog('\n🔨 Step 4: Building the application...');
        
        // Check if there's a build script, otherwise create a simple dist folder
        try {
          // Try to run npm build if it exists
          const buildResult = await spawn('npm', ['run', 'build']);
          if (buildResult.exitCode === 0) {
            addLog('✓ Build completed successfully');
          } else {
            // If no build script, create a simple dist folder with the app
            addLog('  No build script found, creating dist folder...');
            await webcontainerInstance.fs.mkdir('/dist', { recursive: true });
            
            // Copy main files to dist
            const indexContent = await webcontainerInstance.fs.readFile('/index.js', 'utf-8');
            const packageContent = await webcontainerInstance.fs.readFile('/package.json', 'utf-8');
            
            await webcontainerInstance.fs.writeFile('/dist/index.js', indexContent);
            await webcontainerInstance.fs.writeFile('/dist/package.json', packageContent);
            
            addLog('✓ Created dist folder with application files');
          }
        } catch (err) {
          // Fallback: create dist with current files
          addLog('  Creating dist folder...');
          await webcontainerInstance.fs.mkdir('/dist', { recursive: true });
          
          const indexContent = await webcontainerInstance.fs.readFile('/index.js', 'utf-8');
          await webcontainerInstance.fs.writeFile('/dist/index.js', indexContent);
          
          addLog('✓ Created dist folder');
        }
        
        // Refresh file tree to show dist folder
        await window.refreshFileTree();
        
        // Step 5: Publish only the dist folder
        addLog('\n📤 Step 5: Publishing dist folder to artifact...');
        const buildArtifactId = `test-build-${timestamp}`;
        const publishResult = await publishArtifact('/dist', buildArtifactId, '/');
        
        addLog(`✓ Published ${publishResult.files_count} files from dist to ${publishResult.artifact_id}`);
        
        // Step 6: Start the server and capture URL
        addLog('\n🚀 Step 6: Starting the application server...');
        
        // Listen for server-ready event
        const serverReadyPromise = new Promise((resolve) => {
          const handler = (port, url) => {
            addLog(`✓ Server is running at: ${url}`);
            
            // Update preview iframe
            const previewIframe = document.getElementById('preview-iframe');
            const previewInfo = document.getElementById('preview-info');
            
            previewIframe.src = url;
            previewIframe.style.display = 'block';
            previewInfo.innerHTML = `<strong>Preview:</strong> ${url} | <a href="${url}" target="_blank" style="color: #3794ff;">Open in new tab ↗</a>`;
            
            // Switch to preview tab
            document.querySelector('[data-tab="preview"]').click();
            
            // Remove the listener
            webcontainerInstance.off('server-ready', handler);
            resolve({ port, url });
          };
          webcontainerInstance.on('server-ready', handler);
        });
        
        // Start the server
        const serverProcess = await webcontainerInstance.spawn('npm', ['run', 'start']);
        
        // Wait for server to be ready (with timeout)
        const serverInfo = await Promise.race([
          serverReadyPromise,
          new Promise((resolve) => setTimeout(() => resolve(null), 10000))
        ]);
        
        if (serverInfo) {
          addLog(`✓ Application is running and available for preview`);
        } else {
          addLog('⚠️ Server started but no URL captured (timeout)');
        }
        
        // Step 7: Generate artifact URL
        const artifactUrl = `${queryParams.server_url}/${server.config.workspace}/artifacts/${buildArtifactId}`;
        
        addLog('\n========== TEST COMPLETED SUCCESSFULLY ==========');
        addLog(`\n🎉 Test compilation workflow completed!`);
        addLog(`📦 Source Artifact ID: ${sourceArtifact.id}`);
        addLog(`📦 Build Artifact ID: ${publishResult.artifact_id}`);
        addLog(`🔗 Artifact URL: ${artifactUrl}`);
        if (serverInfo) {
          addLog(`🌐 Preview URL: ${serverInfo.url}`);
        }
        
        // Show result in UI
        testResultEl.innerHTML = `
          <strong>✅ Test Successful!</strong><br>
          <strong>Source Artifact:</strong> ${sourceArtifact.id}<br>
          <strong>Build Artifact (dist):</strong> ${publishResult.artifact_id}<br>
          <strong>Artifact URL:</strong> <a href="${artifactUrl}" target="_blank">${artifactUrl}</a><br>
          ${serverInfo ? `<strong>Preview:</strong> Check the Preview tab or <a href="${serverInfo.url}" target="_blank">open in new window</a>` : ''}
        `;
        testResultEl.style.display = 'block';
        testResultEl.style.background = '#d4edda';
        testResultEl.style.color = '#155724';
        
      } catch (error) {
        addLog(`\n✗ Test failed: ${error.message}`);
        console.error('Test error:', error);
        
        testResultEl.innerHTML = `
          <strong>❌ Test Failed!</strong><br>
          <strong>Error:</strong> ${error.message}
        `;
        testResultEl.style.display = 'block';
        testResultEl.style.background = '#f8d7da';
        testResultEl.style.color = '#721c24';
      } finally {
        testButton.disabled = false;
        testButton.textContent = 'Run Test Compilation';
      }
    });
  }
});