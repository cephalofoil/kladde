"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, Link, Check, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookmarkInputRendererProps {
  initialUrl?: string;
  initialDisplayName?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialFavicon?: string;
  initialSiteName?: string;
  onSave: (bookmarkData: {
    url: string;
    title?: string;
    description?: string;
    favicon?: string;
    siteName?: string;
    imageUrl?: string;
    displayName?: string;
  }) => void;
  onCancel?: () => void;
  width: number;
  height: number;
}

interface UrlValidation {
  isValid: boolean;
  isLoading: boolean;
  error?: string;
}

interface BookmarkMetadata {
  title?: string;
  description?: string;
  favicon?: string;
  siteName?: string;
  imageUrl?: string;
}

export function BookmarkInputRenderer({
  initialUrl = "",
  initialDisplayName = "",
  initialTitle = "",
  initialDescription = "",
  initialFavicon = "",
  initialSiteName = "",
  onSave,
  onCancel,
  width,
  height,
}: BookmarkInputRendererProps) {
  const [url, setUrl] = useState(initialUrl);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [validation, setValidation] = useState<UrlValidation>({ 
    isValid: !!initialUrl, // If we have initial URL, it's valid
    isLoading: false 
  });
  const [metadata, setMetadata] = useState<BookmarkMetadata>({
    title: initialTitle,
    description: initialDescription,
    favicon: initialFavicon,
    siteName: initialSiteName,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // URL validation function
  const validateUrl = (urlString: string): boolean => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Simulate metadata fetching (in real app, this would call an API)
  const fetchMetadata = async (urlString: string): Promise<BookmarkMetadata> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const url = new URL(urlString);
      const domain = url.hostname;
      
      // Mock metadata based on common domains
      const mockMetadata: Record<string, BookmarkMetadata> = {
        'github.com': {
          title: 'GitHub Repository',
          description: 'Where the world builds software',
          siteName: 'GitHub',
          favicon: '🐙',
          imageUrl: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
        },
        'youtube.com': {
          title: 'YouTube Video',
          description: 'Watch videos on YouTube',
          siteName: 'YouTube',
          favicon: '📺',
        },
        'docs.google.com': {
          title: 'Google Docs',
          description: 'Online document editor',
          siteName: 'Google Docs',
          favicon: '📄',
        },
        'figma.com': {
          title: 'Figma Design',
          description: 'Collaborative design tool',
          siteName: 'Figma',
          favicon: '🎨',
        }
      };

      // Return mock data or generate generic metadata
      return mockMetadata[domain] || {
        title: `Website - ${domain}`,
        description: `Content from ${domain}`,
        siteName: domain,
        favicon: '🌐',
      };
    } catch {
      return {
        title: 'Website',
        description: 'External link',
        siteName: 'Unknown',
        favicon: '🔗',
      };
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Validate initial URL if provided
    if (initialUrl.trim()) {
      setUrl(initialUrl);
      const isValid = validateUrl(initialUrl);
      if (isValid) {
        setValidation({ isValid: true, isLoading: true });
        fetchMetadata(initialUrl).then((fetchedMetadata) => {
          setMetadata(fetchedMetadata);
          setValidation({ isValid: true, isLoading: false });
        }).catch(() => {
          setValidation({ 
            isValid: false, 
            isLoading: false, 
            error: "Failed to fetch website information" 
          });
        });
      }
    }
  }, [initialUrl]);

  const handleUrlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);

    if (!newUrl.trim()) {
      setValidation({ isValid: false, isLoading: false });
      setMetadata({});
      return;
    }

    const isValid = validateUrl(newUrl);
    if (!isValid) {
      setValidation({ 
        isValid: false, 
        isLoading: false, 
        error: "Please enter a valid URL (http:// or https://)" 
      });
      setMetadata({});
      return;
    }

    // Start loading metadata
    setValidation({ isValid: true, isLoading: true });
    try {
      const fetchedMetadata = await fetchMetadata(newUrl);
      setMetadata(fetchedMetadata);
      setValidation({ isValid: true, isLoading: false });
    } catch (error) {
      setValidation({ 
        isValid: false, 
        isLoading: false, 
        error: "Failed to fetch website information" 
      });
      setMetadata({});
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && validation.isValid && !validation.isLoading) {
      handleSave();
    }
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  const handleSave = () => {
    if (validation.isValid && url.trim() && !validation.isLoading) {
      onSave({
        url,
        ...metadata,
        displayName: displayName.trim() || undefined,
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
          <span className="text-sm font-medium text-gray-700">Add Bookmark</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!validation.isValid || validation.isLoading || !url.trim()}
            className="h-7 text-xs bg-sky-600 hover:bg-sky-700"
          >
            {validation.isLoading ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Check className="h-3 w-3 mr-1" />
            )}
            Save
          </Button>
          
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-7 text-xs hover:bg-gray-100"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Display Name Input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">
            Display Name (Optional)
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Custom name for this bookmark"
            className="w-full p-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />
        </div>

        {/* URL Input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
            <Link className="h-3 w-3" />
            Website URL
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={handleUrlChange}
              onKeyDown={handleKeyDown}
              placeholder="https://example.com"
              className={`w-full p-3 text-sm bg-white rounded-lg resize-none focus:outline-none focus:ring-2 ${
                !url.trim() 
                  ? "border border-gray-200 focus:ring-sky-500 focus:border-transparent"
                  : validation.isValid 
                    ? "border border-green-300 focus:ring-green-500 focus:border-transparent" 
                    : "border-2 border-red-300 focus:ring-red-500 focus:border-transparent"
              }`}
            />
            
            {/* Status indicator */}
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {validation.isLoading ? (
                <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
              ) : validation.isValid ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : validation.error ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : null}
            </div>
          </div>
          
          {/* Error message */}
          {validation.error && (
            <div className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {validation.error}
            </div>
          )}
        </div>

        {/* Preview */}
        {validation.isValid && !validation.isLoading && metadata.title && (
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                {metadata.favicon ? (
                  <span className="text-lg">{metadata.favicon}</span>
                ) : (
                  <Globe className="h-5 w-5 text-gray-400" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm truncate">
                  {metadata.title}
                </div>
                {metadata.description && (
                  <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {metadata.description}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1 truncate">
                  {metadata.siteName || new URL(url).hostname}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {validation.isLoading && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
              <div className="text-sm text-gray-600">
                Fetching website information...
              </div>
            </div>
          </div>
        )}

        {/* Helper text */}
        <div className="text-xs text-gray-500">
          Paste any website URL to create a bookmark. Press Enter to save or Escape to cancel.
        </div>
      </div>
    </div>
  );
}
