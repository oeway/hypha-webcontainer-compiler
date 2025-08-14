/** @satisfies {import('@webcontainer/api').FileSystemTree} */

export const files = {
    'index.js': {
      file: {
        contents: `
import express from 'express';
const app = express();
const port = 3111;
  
app.get('/', (req, res) => {
    res.send('Welcome to a WebContainers app! 🥳');
});
  
app.listen(port, () => {
    console.log(\`App is live at http://localhost:\${port}\`);
});`,
      },
    },
    'package.json': {
      file: {
        contents: `
          {
            "name": "example-app",
            "type": "module",
            "dependencies": {
              "express": "latest",
              "nodemon": "latest"
            },
            "scripts": {
              "start": "nodemon index.js",
              "build": "node build.js"
            }
          }`,
      },
    },
    'build.js': {
      file: {
        contents: `
import fs from 'fs';
import path from 'path';

console.log('Building application...');

// Create dist directory
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Copy main application files to dist
const filesToCopy = ['index.js', 'package.json'];

filesToCopy.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    fs.writeFileSync(path.join('dist', file), content);
    console.log(\`Copied \${file} to dist/\`);
  }
});

// Create a production package.json without dev dependencies
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const prodPackageJson = {
  ...packageJson,
  scripts: {
    start: 'node index.js'
  },
  devDependencies: {}
};

fs.writeFileSync(
  path.join('dist', 'package.json'), 
  JSON.stringify(prodPackageJson, null, 2)
);

// Create a simple HTML file for the root
const htmlContent = \`<!DOCTYPE html>
<html>
<head>
    <title>Example App</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 10px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
        }
        .info {
            background: #f7f7f7;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        code {
            background: #e1e1e1;
            padding: 2px 6px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 WebContainer Build Success!</h1>
        <p>This application was successfully built using the WebContainer Compilation Service.</p>
        <div class="info">
            <strong>Build Information:</strong><br>
            <br>
            Build Time: \${new Date().toISOString()}<br>
            Environment: WebContainer<br>
            Output: /dist folder<br>
        </div>
        <p>The Express server is configured and ready to run.</p>
        <p>Start the server with: <code>npm start</code></p>
    </div>
</body>
</html>\`;

fs.writeFileSync(path.join('dist', 'index.html'), htmlContent);
console.log('Created index.html in dist/');

console.log('\\n✅ Build completed successfully!');
console.log('📦 Output directory: ./dist');
console.log(\`📊 Total files: \${fs.readdirSync('dist').length}\`);
`,
      },
    },
  };