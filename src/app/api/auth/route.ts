import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    
    // Get the admin password from environment variables
    const adminPassword = process.env.ADMIN_PASSWORD
    
    if (!adminPassword) {
      return NextResponse.json(
        { message: "Server configuration error: Admin password not set" },
        { status: 500 }
      )
    }
    
    // Check if the provided password matches the admin password
    if (password !== adminPassword) {
      return NextResponse.json(
        { message: "Invalid password" },
        { status: 401 }
      )
    }
    
    // If password matches, return success
    return NextResponse.json({ authenticated: true })
  } catch (error) {
    console.error("Authentication error:", error)
    return NextResponse.json(
      { message: "An error occurred during authentication" },
      { status: 500 }
    )
  }
}