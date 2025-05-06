"use client"

import { useState, useCallback } from "react"
import { Folder, Upload, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Add type definitions for the File System Access API
interface FileSystemDirectoryHandle {
  kind: 'directory';
  name: string;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface FileSystemFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
}

type FileSystemHandle = FileSystemDirectoryHandle | FileSystemFileHandle;

// Augment the Window interface
declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}

interface FolderUploadProps {
  onFilesSelected: (files: File[]) => void
}

// Helper class to preserve path information
class FileWithPath extends File {
  path: string;
  
  constructor(fileBits: BlobPart[], name: string, path: string, options?: FilePropertyBag) {
    super(fileBits, name, options);
    this.path = path;
  }
}

export function FolderUpload({ onFilesSelected }: FolderUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Check if browser supports folder upload features
  const isFolderUploadSupported = typeof window !== "undefined" && 
    (("showDirectoryPicker" in window) || 
     ("webkitGetAsEntry" in DataTransferItem.prototype));

  const processEntry = async (entry: FileSystemEntry, currentPath = ""): Promise<File[]> => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        fileEntry.file((file) => {
          // Preserve path information in the file object
          const fullPath = currentPath ? `${currentPath}/${file.name}` : file.name;
          
          // Create a custom file object with path information
          const fileWithPath = new File(
            [file], 
            fullPath, // Use the full path as the filename for now
            { type: file.type, lastModified: file.lastModified }
          );
          
          // Add path property to the file object
          Object.defineProperty(fileWithPath, 'path', {
            value: currentPath,
            writable: false
          });
          
          resolve([fileWithPath]);
        });
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const dirReader = dirEntry.createReader();
        
        // Read all entries in the directory
        dirReader.readEntries(async (entries) => {
          const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
          
          const filePromises = entries.map(subEntry => 
            processEntry(subEntry, newPath)
          );
          
          const fileArrays = await Promise.all(filePromises);
          resolve(fileArrays.flat());
        });
      } else {
        resolve([]);
      }
    });
  };
  
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    
    const items = e.dataTransfer.items;
    if (!items) return;
    
    try {
      const entries = Array.from(items)
        .filter(item => item.webkitGetAsEntry)
        .map(item => item.webkitGetAsEntry())
        .filter(Boolean) as FileSystemEntry[];
      
      if (entries.length === 0) {
        setError("No valid files or folders detected");
        return;
      }
      
      const filePromises = entries.map(entry => processEntry(entry));
      const fileArrays = await Promise.all(filePromises);
      const files = fileArrays.flat();
      
      if (files.length === 0) {
        setError("No files found in the folder");
        return;
      }
      
      onFilesSelected(files);
    } catch (err) {
      setError("Error processing folder: " + (err instanceof Error ? err.message : String(err)));
      console.error("Folder processing error:", err);
    }
  }, [onFilesSelected]);
  
  const handleSelectFolder = async () => {
    try {
      // Check if the File System Access API is available
      if (!("showDirectoryPicker" in window)) {
        setError("Your browser doesn't support folder selection. Try dragging and dropping instead.");
        return;
      }
      
      const dirHandle = await window.showDirectoryPicker();
      const files: File[] = [];
      
      // Recursive function to process directory contents
      const processDirectory = async (dirHandle: FileSystemDirectoryHandle, currentPath = "") => {
        for await (const [name, handle] of dirHandle.entries()) {
          if (handle.kind === "file") {
            const file = await (handle as FileSystemFileHandle).getFile();
            
            // Create path for the file
            const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
            
            // Create a new file with the path information
            const fileWithPath = new File(
              [file], 
              filePath, // Use full path as filename
              { type: file.type, lastModified: file.lastModified }
            );
            
            // Add path property to the file object
            Object.defineProperty(fileWithPath, 'path', {
              value: currentPath,
              writable: false
            });
            
            files.push(fileWithPath);
          } else if (handle.kind === "directory") {
            const newPath = currentPath ? `${currentPath}/${name}` : name;
            await processDirectory(handle as FileSystemDirectoryHandle, newPath);
          }
        }
      };
      
      await processDirectory(dirHandle);
      
      if (files.length === 0) {
        setError("No files found in the folder");
        return;
      }
      
      onFilesSelected(files);
      setError(null);
    } catch (err) {
      // User cancelled or permission denied
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
      console.error(err);
    }
  };
  
  return (
    <div className="space-y-4">
      {!isFolderUploadSupported && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your browser doesn't fully support folder uploads. Please use a modern Chromium-based browser like Chrome or Edge.
          </AlertDescription>
        </Alert>
      )}
      
      <div 
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-gray-300"}
          ${isFolderUploadSupported ? "cursor-pointer" : "cursor-not-allowed opacity-70"}
        `}
        onDragOver={(e) => {
          e.preventDefault();
          if (isFolderUploadSupported) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={isFolderUploadSupported ? handleDrop : undefined}
      >
        <Folder className="h-8 w-8 text-gray-400 mx-auto mb-4" />
        <p className="text-sm text-gray-600 mb-2">
          Drag and drop a folder here
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Or use the button below
        </p>
        
        <Button 
          variant="outline" 
          onClick={handleSelectFolder}
          disabled={!isFolderUploadSupported}
        >
          <Folder className="h-4 w-4 mr-2" />
          Select Folder
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}