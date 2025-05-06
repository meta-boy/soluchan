"use server"

import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import { connectToDatabase } from "./mongodb"

// Generate token function remains unchanged
export async function generateToken() {
  try {
    const db = await connectToDatabase()
    const token = nanoid(10) // Generate a 10-character token
    const createdAt = new Date()
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now

    // Store the token in MongoDB
    await db.collection("tokens").insertOne({
      token,
      createdAt,
      expiresAt,
      used: false,
      expired: false,
      gistUrl: null,
    })

    return token
  } catch (error) {
    console.error("Error generating token:", error)
    throw new Error("Failed to generate token")
  }
}

// Validate token function remains unchanged
export async function validateToken(token: string) {
  try {
    const db = await connectToDatabase()

    // Find the token in MongoDB
    const tokenDoc = await db.collection("tokens").findOne({ token, used: false })

    if (!tokenDoc) {
      return false
    }

    // Check if token has expired (tokens expire after 24 hours)
    const tokenAge = Date.now() - new Date(tokenDoc.createdAt).getTime()
    const tokenExpired = tokenAge > 24 * 60 * 60 * 1000 // 24 hours in milliseconds

    if (tokenExpired) {
      // Mark token as expired
      await db.collection("tokens").updateOne({ token }, { $set: { expired: true } })
      return false
    }

    return true // Token is valid and hasn't expired
  } catch (error) {
    console.error("Error validating token:", error)
    throw new Error("Failed to validate token")
  }
}

// Helper function to organize files into their folder structure
interface FileWithPath extends File {
  path?: string;
}

// Updated upload function to better handle folder structure
export async function uploadFiles(formData: FormData) {
  try {
    const token = formData.get("token") as string
    const files = formData.getAll("files") as FileWithPath[]

    if (!token || !files.length) {
      throw new Error("Missing token or files")
    }

    // Validate the token first
    const db = await connectToDatabase()
    const tokenDoc = await db.collection("tokens").findOne({ token, used: false })

    if (!tokenDoc) {
      throw new Error("Invalid or already used token")
    }

    // Process files to identify folder structure
    const filesByPath = new Map<string, File[]>();
    
    // Detect if we have folder structure by checking if any files have path information
    const hasFolderStructure = files.some(file => {
      // Check for path property (added by our folder upload component)
      if ((file as any).path) return true;
      
      // Check if the filename contains path separators
      return file.name.includes('/') || file.name.includes('\\');
    });

    if (hasFolderStructure) {
      // Group files by their path for folder structure
      files.forEach(file => {
        let filePath = "";
        let fileName = file.name;
        
        // Check for path property first (from our enhanced uploader)
        if ((file as any).path) {
          filePath = (file as any).path;
        } 
        // Otherwise try to parse path from filename
        else if (file.name.includes('/')) {
          const parts = file.name.split('/');
          fileName = parts.pop() || "";
          filePath = parts.join('/');
        } else if (file.name.includes('\\')) {
          const parts = file.name.split('\\');
          fileName = parts.pop() || "";
          filePath = parts.join('\\');
        }
        
        if (!filesByPath.has(filePath)) {
          filesByPath.set(filePath, []);
        }
        
        // Create a new file with just the filename
        const newFile = new File([file], fileName, {
          type: file.type,
          lastModified: file.lastModified
        });
        
        filesByPath.get(filePath)?.push(newFile);
      });
    } else {
      // No folder structure, just add all files to the root
      filesByPath.set("", files);
    }

    // Create the gist with the processed files
    const gistUrl = await createGist(filesByPath, hasFolderStructure);

    // Update the token in MongoDB to mark it as used
    await db.collection("tokens").updateOne(
      { token },
      {
        $set: {
          used: true,
          gistUrl,
          usedAt: new Date(),
          fileCount: files.length,
          fileNames: files.map((f) => f.name),
          containsFolders: hasFolderStructure
        },
      },
    )

    revalidatePath(`/${token}`)

    return { success: true, gistUrl }
  } catch (error) {
    console.error("Error uploading files:", error)
    throw new Error(error instanceof Error ? error.message : "Failed to upload files")
  }
}

// Updated createGist function to properly handle folder structure
async function createGist(filesByPath: Map<string, File[]>, hasFolderStructure: boolean) {
  try {
    // GitHub API requires a personal access token
    const githubToken = process.env.GITHUB_TOKEN

    if (!githubToken) {
      throw new Error("GitHub token is not configured")
    }

    // Prepare the files for the GitHub Gist API
    const gistFiles: Record<string, { content: string }> = {}
    
    // Track filenames to handle duplicates
    const fileNameCounts: Record<string, number> = {}

    // Process files by their paths
    for (const [path, pathFiles] of Array.from(filesByPath.entries())) {
      for (const file of pathFiles) {
        // Convert file to text content
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Create the file path for the gist
        let gistFileName = file.name;
        
        // If we have a path and it's not empty, prepend it to create a folder-like structure
        if (path && path.length > 0) {
          // Replace backslashes with forward slashes for consistency
          const normalizedPath = path.replace(/\\/g, '/');
          // Use a slash in the filename to indicate directory structure in Gist
          gistFileName = `${normalizedPath}/${file.name}`;
        }
        
        // Handle duplicate filenames
        if (gistFiles[gistFileName]) {
          // Initialize counter if this is the first duplicate
          if (!fileNameCounts[gistFileName]) {
            fileNameCounts[gistFileName] = 1;
          }
          
          // Increment counter and append to filename
          fileNameCounts[gistFileName]++;
          
          // Split filename and extension to insert the counter before the extension
          const lastDotIndex = gistFileName.lastIndexOf('.');
          if (lastDotIndex !== -1) {
            const name = gistFileName.substring(0, lastDotIndex);
            const extension = gistFileName.substring(lastDotIndex);
            gistFileName = `${name} (${fileNameCounts[gistFileName]})${extension}`;
          } else {
            // No extension, just append the counter
            gistFileName = `${gistFileName} (${fileNameCounts[gistFileName]})`;
          }
        }

        // For text files, convert to string
        // For binary files, you might want to use base64 encoding
        let content = "";
        try {
          content = buffer.toString("utf-8");
        } catch (e) {
          // If conversion fails, use base64 with a note
          content = `Binary file: ${buffer.toString("base64").substring(0, 100)}...`;
        }

        gistFiles[gistFileName] = { content };
      }
    }

    // Create the gist via GitHub API
    const response = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: {
        Authorization: `token ${githubToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        description: hasFolderStructure 
          ? "Uploaded via One-Time Gist Uploader (with folder structure)" 
          : "Uploaded via One-Time Gist Uploader",
        public: false, // Create a secret gist
        files: gistFiles,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`GitHub API error: ${error.message || response.statusText}`)
    }

    const gist = await response.json()
    return gist.html_url // Return the URL of the created gist
  } catch (error) {
    console.error("Error creating gist:", error)
    throw new Error("Failed to create gist")
  }
}