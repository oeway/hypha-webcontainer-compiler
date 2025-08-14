### **Usage Document: Hypha Artifact Manager in JavaScript**

This document provides a comprehensive guide to using the `artifact-manager` service in a JavaScript environment, based on the provided API reference.

Important, when calling artifactManager service with kwargs, you need to add _rkwargs: true, e.g.:
await artifactManager.create({artifact_id: "hi", _rkwargs: true})
### **Getting Started**

#### **Step 1: Connecting to the Artifact Manager Service**

First, connect to the Hypha server using the `connectToServer` function from the `hypha-rpc` library. This allows you to get the server object, which is the entry point for retrieving services like the `artifact-manager`.

```javascript
// This example assumes the hypha-rpc-websocket.js library is loaded,
// providing a global `hyphaWebsocket` object.
// import { hyphaWebsocket } from "./path/to/hypha-rpc-websocket.js";

const SERVER_URL = "https://hypha.aicell.io"; // Replace with your server URL

// Connect to the Hypha server
const server = await hyphaWebsocket.connectToServer({
    name: "javascript-client",
    server_url: SERVER_URL
});

// Get the Artifact Manager service from the server object
const artifactManager = await server.getService("public/artifact-manager");
console.log("Connected to the Artifact Manager.");
```

#### **Step 2: Creating a Dataset Gallery Collection**

A "collection" is used to organize datasets. You can create one with specific metadata and permissions.

```javascript
// Define metadata for the dataset gallery
const galleryManifest = {
    name: "Dataset Gallery",
    description: "A collection for organizing datasets",
};

// Create the collection
// Permissions: "*" means everyone, "@" means authenticated users. "r" is read, "r+" is read/create.
const collection = await artifactManager.create({
    alias: "dataset-gallery",
    type: "collection",
    manifest: galleryManifest,
    config: { permissions: { "*": "r", "@": "r+" } }
});

console.log("Dataset Gallery created with ID:", collection.id);
```

> **Tip:** The returned `collection.id` is the unique identifier for the collection (`workspace_id/alias`). You can use this full ID or just the `alias` for subsequent operations within the same workspace.

#### **Step 3: Adding a Dataset to the Gallery**

After creating the gallery, add individual datasets to it. Setting `stage=true` allows you to upload files and make changes before finalizing.

```javascript
// Define metadata for the new dataset
const datasetManifest = {
    name: "Example Dataset",
    description: "A dataset containing example data",
};

// Add the dataset to the gallery and stage it for review
const dataset = await artifactManager.create({
    parent_id: collection.id,
    alias: "example-dataset",
    manifest: datasetManifest,
    stage: true
});

console.log("Dataset added to the gallery.");
```

> **Tip:** The `stage=true` parameter stages the dataset for review. You can edit it before committing it to the collection.

#### **Step 4: Uploading Files to the Dataset**

File uploads use a secure, two-step process involving pre-signed URLs. The `download_weight` parameter can be used to track download statistics.

> **Important:** Adding files to a staged artifact does **NOT** automatically create a new version. To create a new version upon commit, you must explicitly use `version="new"` when editing the artifact.

```javascript
// Assume `fileObject` is a File object from an <input type="file">
// const fileObject = document.getElementById('my-file-input').files[0];

// For this example, we'll create a dummy file in memory
const fileContent = "col1,col2\nval1,val2\n";
const fileObject = new File([fileContent], "data.csv", { type: "text/csv" });

// 1. Generate a pre-signed URL to upload the file
const put_url = await artifactManager.put_file(dataset.id, {
    file_path: "data.csv",
    download_weight: 0.5
});

// 2. Upload the file using an HTTP PUT request with fetch
const response = await fetch(put_url, {
    method: 'PUT',
    body: fileObject
});

if (!response.ok) {
    throw new Error("File upload failed: " + response.statusText);
}
console.log("File uploaded to the dataset.");
```

#### **Step 5: Committing the Dataset**

Once files are uploaded and changes are complete, `commit` the dataset to finalize its state in the collection. This will create the initial version (`v0`).

```javascript
// Commit the dataset to finalize its status
await artifactManager.commit(dataset.id);
console.log("Dataset committed.");
```

#### **Step 6: Listing All Datasets in the Gallery**

Retrieve a list of all datasets within a collection for display or further processing.

```javascript
// List all datasets in the gallery
const datasets = await artifactManager.list(collection.id);
console.log("Datasets in the gallery:", datasets);
```

-----

### **Full Example: Creating and Managing a Dataset Gallery**

Here is a complete, self-contained JavaScript example using `connectToServer`.

```javascript
// Assumes hypha-rpc-websocket.js library is loaded, providing `hyphaWebsocket`.
async function main() {
    // --- 1. Connect to the service ---
    const SERVER_URL = "https://hypha.aicell.io";
    const server = await hyphaWebsocket.connectToServer({
        name: "javascript-client-full-example",
        server_url: SERVER_URL
    });
    const artifactManager = await server.getService("public/artifact-manager");
    console.log("Connected to the Artifact Manager.");

    // --- 2. Create a collection ---
    const collection = await artifactManager.create({
        type: "collection",
        alias: "dataset-gallery",
        manifest: { name: "Dataset Gallery", description: "A collection for organizing datasets" },
        config: { permissions: { "*": "r+", "@": "r+" } },
        _rkwargs: true
    });
    console.log("Dataset Gallery created.");

    // --- 3. Add a dataset ---
    const dataset = await artifactManager.create({
        parent_id: collection.id,
        alias: "example-dataset",
        manifest: { name: "Example Dataset", description: "A dataset containing example data" },
        stage: true
    });
    console.log("Dataset added to the gallery.");

    // --- 4. Upload a file ---
    const fileObject = new File(["col1,col2\nval1,val2\n"], "data.csv", { type: "text/csv" });
    const put_url = await artifactManager.put_file(dataset.id, { file_path: "data.csv", download_weight: 0.5 });
    const response = await fetch(put_url, { method: 'PUT', body: fileObject });
    if (!response.ok) throw new Error("File upload failed");
    console.log("File uploaded to the dataset.");

    // --- 5. Commit the dataset ---
    await artifactManager.commit(dataset.id);
    console.log("Dataset committed.");

    // --- 6. List all datasets ---
    const datasets = await artifactManager.list(collection.id);
    console.log("Datasets in the gallery:", datasets);
}

main().catch(console.error);
```

-----

### **Advanced Usage: Version Management and Performance**

The artifact manager provides explicit version control to optimize performance and prevent unexpected storage costs.

  * **No Automatic Versioning**: Adding files does not automatically create a new version.
  * **Explicit Intent Required**: You must use `version="new"` when calling `edit` to signal the intent to create a new version.
  * **Fast, Metadata-Only Commits**: Because files are placed directly in their final destination, the `commit` operation is extremely fast.

#### **Version Creation Examples**

```javascript
const updatedManifest = { name: "Updated Dataset Name" };

// --- Example 1: Update existing version (no new version created) ---
await artifactManager.edit({ artifact_id: dataset.id, manifest: updatedManifest, stage: true });
// Add/overwrite files, which go to the existing version's location
// ...
await artifactManager.commit(dataset.id); // This just updates the metadata of the current version


// --- Example 2: Create a new version explicitly ---
await artifactManager.edit({
    artifact_id: dataset.id,
    manifest: updatedManifest,
    stage: true,
    version: "new"  // Signal intent for a new version
});
// Add files, which are now placed in the new version's location
// ...
// Commit and specify the new version name
await artifactManager.commit(dataset.id, { version: "v2.0" });
```

### **Advanced Usage: Enforcing Schema for Dataset Validation**

You can enforce a JSON schema on a collection to ensure all contained datasets are consistent.

```javascript
// 1. Define a schema for datasets in the gallery
const datasetSchema = {
    type: "object",
    properties: {
        name: { type: "string" },
        description: { type: "string" },
        record_type: { type: "string", enum: ["dataset", "model", "application"] },
    },
    required: ["name", "description", "record_type"]
};

// 2. Create a collection with schema validation
const schemaCollection = await artifactManager.create({
    type: "collection",
    alias: "schema-dataset-gallery",
    manifest: { name: "Schema Dataset Gallery", description: "A gallery with schema-enforced datasets" },
    config: { collection_schema: datasetSchema, permissions: { "*": "r+", "@": "r+" } }
});
console.log("Schema-based Dataset Gallery created.");

// 3. Create a valid dataset that conforms to the schema
const validDatasetManifest = {
    name: "Valid Dataset",
    description: "A valid dataset meeting schema requirements",
    record_type: "dataset",
};
const validDataset = await artifactManager.create({
    parent_id: schemaCollection.id,
    alias: "valid-dataset",
    manifest: validDatasetManifest,
    stage: true
});

// This commit will succeed because the manifest is valid
await artifactManager.commit(validDataset.id);
console.log("Valid dataset committed successfully.");
```