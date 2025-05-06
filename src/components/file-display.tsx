"use client"

import { useState } from "react"
import { File, Folder, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface FileDisplayProps {
  files: File[]
}

interface FileTreeNode {
  name: string
  isDirectory: boolean
  children: Record<string, FileTreeNode>
  file?: File
}

export function FileDisplay({ files }: FileDisplayProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  
  // Build a tree structure from file paths
  const fileTree: FileTreeNode = {
    name: "root",
    isDirectory: true,
    children: {},
  }
  
  // Process each file to build the tree
  files.forEach((file) => {
    // Extract path from filename - assuming paths are using slashes or hyphens
    let pathParts: string[] = []
    let fileName: string = file.name
    
    // Check for path-like structure in the filename
    if (file.name.includes('/') || file.name.includes('\\')) {
      // Handle proper path separator
      const pathSeparator = file.name.includes('/') ? '/' : '\\';
      const parts = file.name.split(pathSeparator);
      pathParts = parts.slice(0, -1);
      fileName = parts[parts.length - 1];
    } else if (file.name.includes('-') && !file.name.startsWith('.')) {
      // For hyphen-separated paths as a fallback
      const parts = file.name.split('-');
      
      // Check if the last part has an extension
      const lastPart = parts[parts.length - 1];
      if (lastPart.includes('.')) {
        // Assume the last part is the filename
        fileName = lastPart;
        pathParts = parts.slice(0, -1);
      } else {
        // If no extension, just use the whole name as a file
        fileName = file.name;
        pathParts = [];
      }
    }
    
    let currentNode = fileTree;
    
    // If there's no path, add the file directly to root
    if (pathParts.length === 0) {
      currentNode.children[fileName] = {
        name: fileName,
        isDirectory: false,
        children: {},
        file,
      };
      return;
    }
    
    // Navigate or create the directory structure
    for (let i = 0; i < pathParts.length; i++) {
      const segment = pathParts[i];
      if (!segment) continue; // Skip empty segments
      
      if (!currentNode.children[segment]) {
        currentNode.children[segment] = {
          name: segment,
          isDirectory: true,
          children: {},
        };
      }
      currentNode = currentNode.children[segment];
    }
    
    // Add the file to the leaf directory
    currentNode.children[fileName] = {
      name: fileName,
      isDirectory: false,
      children: {},
      file,
    };
  });
  
  // Helper to toggle folder expansion
  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };
  
  // Get number of files in a folder (including nested folders)
  const countFiles = (node: FileTreeNode): number => {
    if (!node.isDirectory) return 1;
    
    let count = 0;
    Object.values(node.children).forEach((child) => {
      count += countFiles(child);
    });
    return count;
  };
  
  // Format file size to a readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };
  
  // Check if there are any actual folders
  const hasFolders = Object.values(fileTree.children).some(node => node.isDirectory);
  
  // Helper to render a directory or file
  const renderNode = (node: FileTreeNode, path: string = "", level: number = 0) => {
    // Skip rendering the root
    if (node.name === "root") {
      return (
        <div className="space-y-1">
          {Object.values(node.children)
            .sort((a, b) => {
              // Directories first, then alphabetically
              if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            })
            .map((child) => renderNode(child, child.name, level))}
        </div>
      );
    }
    
    const isExpanded = expandedFolders.has(path);
    const indentation = level * 12; // 12px per level
    
    if (node.isDirectory) {
      const fileCount = countFiles(node);
      return (
        <div key={path} className="font-mono text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 justify-start w-full hover:bg-muted text-left"
            onClick={() => toggleFolder(path)}
            style={{ paddingLeft: `${indentation + 8}px` }}
          >
            <ChevronRight
              className={cn("h-4 w-4 mr-1 transition-transform", 
                isExpanded && "transform rotate-90")}
            />
            <Folder className="h-4 w-4 mr-2 text-amber-500" />
            <span className="truncate">{node.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              ({fileCount} {fileCount === 1 ? "file" : "files"})
            </span>
          </Button>
          
          {isExpanded && (
            <div className="ml-4">
              {Object.values(node.children)
                .sort((a, b) => {
                  // Directories first, then alphabetically
                  if (a.isDirectory !== b.isDirectory) {
                    return a.isDirectory ? -1 : 1;
                  }
                  return a.name.localeCompare(b.name);
                })
                .map((child) => renderNode(child, `${path}/${child.name}`, level + 1))}
            </div>
          )}
        </div>
      );
    } else {
      // Render a file
      const fileSize = node.file ? formatFileSize(node.file.size) : "0 B";
      
      return (
        <div 
          key={path} 
          className="flex items-center py-1 px-2 hover:bg-muted/50 rounded-sm"
          style={{ marginLeft: `${indentation + 8}px` }}
        >
          <File className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />
          <span className="truncate mr-2 text-xs">{node.name}</span>
          <span className="text-xs text-muted-foreground ml-auto">{fileSize}</span>
        </div>
      );
    }
  };

  return (
    <div className="border rounded-md bg-background">
      <div className="p-2 border-b">
        <h3 className="text-sm font-medium">Files {files.length > 0 && `(${files.length})`}</h3>
      </div>
      <div className="p-2 max-h-96 overflow-y-auto">
        {files.length > 0 ? (
          // Render the tree structure
          renderNode(fileTree)
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">No files selected</p>
          </div>
        )}
      </div>
    </div>
  );
}