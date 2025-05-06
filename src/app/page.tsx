"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Link } from "lucide-react"
import { generateToken } from "@/lib/actions"
import { useToast } from "@/hooks/use-toast"

export default function Home() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleGenerateToken = async () => {
    setLoading(true)
    try {
      const newToken = await generateToken()
      setToken(newToken)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate token",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (!token) return

    const url = `${window.location.origin}/${token}`
    navigator.clipboard.writeText(url)

    toast({
      title: "Copied!",
      description: "Link copied to clipboard",
    })
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>One-Time Gist Uploader</CardTitle>
          <CardDescription>Generate a one-time use token for secure file uploads</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {token ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Your one-time upload link:</p>
              <div className="flex items-center gap-2">
                <Input value={`${window.location.origin}/${token}`} readOnly className="font-mono text-sm" />
                <Button size="icon" variant="outline" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This link can only be used once and will expire in 24 hours. Share it with the person who needs to
                upload files.
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <Link className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-muted-foreground">Generate a token to create a one-time use upload link</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleGenerateToken} disabled={loading}>
            {loading ? "Generating..." : token ? "Generate New Token" : "Generate Token"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
