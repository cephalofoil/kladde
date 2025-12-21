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

    // Mock processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock AI response
    const mockResponse = {
      id: `mock_${Date.now()}`,
      prompt: prompt,
      response: `This is a mock AI response to your prompt:\n\n"${prompt}"\n\nIn a real implementation, this would contain the actual AI-generated content based on your prompt and any referenced tiles. The system would process the @ref markers and include the tile content as context for the AI model.`,
      timestamp: new Date().toISOString(),
      status: "completed",
    };

    console.log("Mock AI API called with:", { prompt });
    console.log("Mock response:", mockResponse);

    return NextResponse.json(mockResponse);
  } catch (error) {
    console.error("Mock AI API error:", error);
    return NextResponse.json(
      { error: "Failed to process AI request" },
      { status: 500 },
    );
  }
}
