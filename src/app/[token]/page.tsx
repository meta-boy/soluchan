"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Upload, AlertTriangle, Check, Folder } from "lucide-react"
import { validateToken, uploadFiles } from "@/lib/actions"
import { useToast } from "@/hooks/use-toast"
import { FolderUpload } from "@/components/folder-upload"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileDisplay } from "@/components/file-display"

export default function UploadPage({ params }: { params: { token: string } }) {
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [gistUrl, setGistUrl] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const checkToken = async () => {
      try {
        const valid = await validateToken(params.token)
        setIsValid(valid)
        if (!valid) {
          toast({
            title: "Invalid Token",
            description: "This upload link is invalid or has already been used",
            variant: "destructive",
          })
        }
      } catch (error) {
        setIsValid(false)
        toast({
          title: "Error",
          description: "Failed to validate token",
          variant: "destructive",
        })
      }
    }

    checkToken()
  }, [params.token, toast])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleFolderFiles = (folderFiles: File[]) => {
    setFiles(folderFiles)
    
    // Show a toast to confirm files were selected
    toast({
      title: "Folder Selected",
      description: `${folderFiles.length} files found in folder`,
    })
  }

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to upload",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i])
      }
      formData.append("token", params.token)

      const result = await uploadFiles(formData)
      setGistUrl(result.gistUrl)
      setIsSuccess(true)
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your files",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  if (isValid === null) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p>Validating token...</p>
      </div>
    )
  }

  if (isValid === false) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Invalid Token</AlertTitle>
          <AlertDescription>This upload link is invalid or has already been used.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            This is a one-time use upload link. Once files are uploaded, this link will no longer work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="bg-green-50 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="font-medium text-lg">Upload Successful!</h3>
              {gistUrl && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Your Gist URL:</p>
                  <a
                    href={gistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all"
                  >
                    {gistUrl}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Tabs defaultValue="files" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="files">
                    <Upload className="h-4 w-4 mr-2" />
                    Files
                  </TabsTrigger>
                  <TabsTrigger value="folder">
                    <Folder className="h-4 w-4 mr-2" />
                    Folder
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="files" className="mt-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-600 mb-2">Select files or drag and drop</p>
                    <input type="file" id="file-upload" multiple className="hidden" onChange={handleFileChange} />
                    <Button variant="outline" onClick={() => document.getElementById("file-upload")?.click()}>
                      Select Files
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="folder" className="mt-4">
                  <FolderUpload onFilesSelected={handleFolderFiles} />
                </TabsContent>
              </Tabs>

              {files && files.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Selected Files: {files.length}</p>
                  <FileDisplay files={files} />
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          {!isSuccess && (
            <Button className="w-full" onClick={handleUpload} disabled={isUploading || !files || files.length === 0}>
              {isUploading ? "Uploading..." : "Upload Files"}
            </Button>
          )}
          {isSuccess && (
            <Button className="w-full" variant="outline" onClick={() => router.push("/")}>
              Return Home
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  )
}