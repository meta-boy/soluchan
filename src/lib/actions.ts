"use server"

import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import { connectToDatabase } from "./mongodb"

// Update the generateToken function to include expiration time:

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

// Update the validateToken function to check for token expiration:

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

// Update the uploadFiles function to better handle file processing:

export async function uploadFiles(formData: FormData) {
  try {
    const token = formData.get("token") as string
    const files = formData.getAll("files") as File[]

    if (!token || !files.length) {
      throw new Error("Missing token or files")
    }

    // Validate the token first
    const db = await connectToDatabase()
    const tokenDoc = await db.collection("tokens").findOne({ token, used: false })

    if (!tokenDoc) {
      throw new Error("Invalid or already used token")
    }

    // Create a gist with the files
    const gistUrl = await createGist(files)

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

// Replace the placeholder createGist function with this implementation:

async function createGist(files: File[]) {
  try {
    // GitHub API requires a personal access token
    const githubToken = process.env.GITHUB_TOKEN

    if (!githubToken) {
      throw new Error("GitHub token is not configured")
    }

    // Prepare the files for the GitHub Gist API
    const gistFiles: Record<string, { content: string }> = {}

    // Process each file
    for (const file of files) {
      // Convert file to text content
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // For text files, convert to string
      // For binary files, you might want to use base64 encoding
      // This is a simple implementation that works for text files
      let content = ""
      try {
        content = buffer.toString("utf-8")
      } catch (e) {
        // If conversion fails, use base64
        content = `Binary file: ${buffer.toString("base64").substring(0, 100)}...`
      }

      gistFiles[file.name] = { content }
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
        description: "Uploaded via One-Time Gist Uploader",
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
