import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      console.error("CLAUDE_API_KEY environment variable is not set");
      return NextResponse.json(
        { error: "Claude API key not configured. Please set CLAUDE_API_KEY environment variable." },
        { status: 500 },
      );
    }

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Claude API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      return NextResponse.json(
        { 
          error: `Claude API error: ${response.status} ${response.statusText}`,
          details: errorData.error?.message || "Unknown error"
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    
    // Extract text content from Claude's response
    const aiResponse = data.content?.[0]?.text || "No response received from Claude";

    const result = {
      id: `claude_${Date.now()}`,
      prompt: prompt,
      response: aiResponse,
      timestamp: new Date().toISOString(),
      status: "completed",
      model: "claude-3-5-sonnet-20241022",
      usage: data.usage || {},
    };

    console.log("Claude API success:", { 
      promptLength: prompt.length, 
      responseLength: aiResponse.length,
      usage: data.usage 
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Claude API error:", error);
    return NextResponse.json(
      { 
        error: "Failed to process AI request",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 },
    );
  }
}
