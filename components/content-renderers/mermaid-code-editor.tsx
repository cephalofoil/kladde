"use client";

import { useState, useRef, useEffect } from "react";
import { generateId } from "@/lib/id";
import { Play, Eye, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MermaidCodeEditorProps {
  initialCode?: string;
  onSave: (code: string) => void;
  onCancel?: () => void;
  width: number;
  height: number;
}

interface MermaidValidation {
  isValid: boolean;
  error?: string;
  svgContent?: string;
}

export function MermaidCodeEditor({
  initialCode = "",
  onSave,
  onCancel,
  width,
  height,
}: MermaidCodeEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [validation, setValidation] = useState<MermaidValidation>({ isValid: true });
  const [showPreview, setShowPreview] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, height * 0.4)}px`;
    }
  };

  // Validate mermaid code
  const validateMermaidCode = async (mermaidCode: string) => {
    if (!mermaidCode.trim()) {
      setValidation({ isValid: true }); // Allow empty code
      return;
    }

    setIsValidating(true);
    try {
      const mermaid = await import("mermaid");
      
      mermaid.default.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "loose",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        flowchart: {
          htmlLabels: true,
          curve: "basis",
        },
      });

      const id = generateId("mermaid-preview");
      const { svg } = await mermaid.default.render(id, mermaidCode);
      
      setValidation({ isValid: true, svgContent: svg });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Invalid mermaid syntax";
      setValidation({ isValid: false, error: errorMessage });
    } finally {
      setIsValidating(false);
    }
  };

  // Debounced validation
  useEffect(() => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }
    
    validationTimeoutRef.current = setTimeout(() => {
      if (showPreview) {
        validateMermaidCode(code);
      }
    }, 500);

    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, [code, showPreview]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [code]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCode(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter to save
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    // Escape to cancel
    if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSave = () => {
    if (validation.isValid && code.trim()) {
      onSave(code);
    }
  };

  const togglePreview = () => {
    setShowPreview(!showPreview);
    if (!showPreview) {
      validateMermaidCode(code);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
          <span className="text-sm font-medium text-gray-700">Mermaid Editor</span>
          {isValidating && (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePreview}
            className="h-7 text-xs hover:bg-gray-100"
          >
            <Eye className="h-3 w-3 mr-1" />
            {showPreview ? "Hide" : "Show"} Preview
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!validation.isValid || !code.trim()}
            className="h-7 text-xs bg-sky-600 hover:bg-sky-700"
          >
            <Play className="h-3 w-3 mr-1" />
            Apply
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

      {/* Content Area */}
      <div className="flex-1 flex gap-3 p-3">
        {/* Code Editor */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-700">Mermaid Code:</span>
            {validation.isValid ? (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Valid
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3 w-3" />
                Error
              </div>
            )}
          </div>
          
          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter your mermaid diagram code here..."
            className={`flex-1 w-full p-3 text-sm font-mono bg-white rounded-lg resize-none focus:outline-none focus:ring-2 ${
              validation.isValid 
                ? "border border-gray-200 focus:ring-sky-500 focus:border-transparent" 
                : "border-2 border-red-300 focus:ring-red-500 focus:border-transparent"
            }`}
            style={{ minHeight: '120px' }}
            autoFocus
          />
          
          {/* Error Display */}
          {!validation.isValid && validation.error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium text-red-800">Syntax Error</div>
                  <div className="text-xs text-red-600 mt-1">{validation.error}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-gray-700">Preview:</span>
            </div>
            
            <div className={`flex-1 bg-white rounded-lg p-4 overflow-hidden ${
              validation.isValid ? "border border-gray-200" : "border-2 border-red-300"
            }`}>
              {isValidating ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-600">Rendering preview...</span>
                  </div>
                </div>
              ) : validation.isValid && validation.svgContent ? (
                <div 
                  className="w-full h-full flex items-center justify-center overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: validation.svgContent }}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <AlertCircle className={`h-8 w-8 ${validation.error ? "text-red-400" : "text-gray-400"}`} />
                    <div className={`text-xs ${validation.error ? "text-red-600" : "text-gray-500"}`}>
                      {validation.error ? "Fix syntax errors to see preview" : "Enter valid mermaid code to see preview"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
