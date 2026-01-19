import type { Board, BoardData } from "./store-types";
import type { BoardElement } from "./board-types";

/**
 * Represents a search result with its source
 */
export interface SearchResult {
    boardId: string;
    boardName: string;
    workstreamId: string;
    /** The type of match found */
    matchType:
        | "board-name"
        | "tile-title"
        | "tile-content"
        | "text-element"
        | "frame-label";
    /** The matched text snippet */
    matchedText: string;
    /** The element ID if the match is within an element */
    elementId?: string;
    /** The specific tile type if this is a tile match */
    tileType?: string;
    /** Relevance score for sorting (higher is better) */
    score: number;
}

/**
 * Extract searchable text content from a board element
 */
function getElementSearchableContent(element: BoardElement): {
    title?: string;
    content?: string;
    type: SearchResult["matchType"];
    tileType?: string;
} | null {
    switch (element.type) {
        case "text":
            return element.text
                ? { content: element.text, type: "text-element" }
                : null;

        case "frame":
            return element.label
                ? { content: element.label, type: "frame-label" }
                : null;

        case "tile":
            const tileContent = element.tileContent;
            const parts: string[] = [];

            if (tileContent?.richText) parts.push(tileContent.richText);
            if (tileContent?.noteText) parts.push(tileContent.noteText);
            if (tileContent?.code) parts.push(tileContent.code);
            if (tileContent?.chart) parts.push(tileContent.chart);
            if (tileContent?.bookmarkTitle)
                parts.push(tileContent.bookmarkTitle);
            if (tileContent?.bookmarkDescription)
                parts.push(tileContent.bookmarkDescription);
            if (tileContent?.displayName) parts.push(tileContent.displayName);

            // Document tile content
            if (tileContent?.documentContent) {
                if (tileContent.documentContent.title)
                    parts.push(tileContent.documentContent.title);
                if (tileContent.documentContent.description)
                    parts.push(tileContent.documentContent.description);
            }

            return {
                title: element.tileTitle,
                content: parts.length > 0 ? parts.join(" ") : undefined,
                type: element.tileTitle ? "tile-title" : "tile-content",
                tileType: element.tileType,
            };

        default:
            return null;
    }
}

/**
 * Create a snippet around the matched text
 */
function createSnippet(
    text: string,
    query: string,
    maxLength: number = 100,
): string {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerText.indexOf(lowerQuery);

    if (matchIndex === -1) {
        return (
            text.slice(0, maxLength) + (text.length > maxLength ? "..." : "")
        );
    }

    // Calculate snippet window around the match
    const snippetStart = Math.max(0, matchIndex - 30);
    const snippetEnd = Math.min(text.length, matchIndex + query.length + 50);

    let snippet = text.slice(snippetStart, snippetEnd);

    if (snippetStart > 0) snippet = "..." + snippet;
    if (snippetEnd < text.length) snippet = snippet + "...";

    return snippet;
}

/**
 * Search across boards in the current workspace
 */
export function searchWorkspace(
    query: string,
    boards: Map<string, Board>,
    boardData: Map<string, BoardData>,
    workstreamId?: string,
): SearchResult[] {
    if (!query.trim()) return [];

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [boardId, board] of boards) {
        // Filter by workspace if specified
        if (workstreamId && board.workstreamId !== workstreamId) {
            continue;
        }

        // Search board name
        if (board.name.toLowerCase().includes(lowerQuery)) {
            results.push({
                boardId,
                boardName: board.name,
                workstreamId: board.workstreamId,
                matchType: "board-name",
                matchedText: board.name,
                score: 100, // Board name matches have highest priority
            });
        }

        // Search board content
        const data = boardData.get(boardId);
        if (data?.elements) {
            for (const element of data.elements) {
                const searchable = getElementSearchableContent(element);
                if (!searchable) continue;

                // Check title match (higher priority)
                if (searchable.title?.toLowerCase().includes(lowerQuery)) {
                    results.push({
                        boardId,
                        boardName: board.name,
                        workstreamId: board.workstreamId,
                        matchType: "tile-title",
                        matchedText: searchable.title,
                        elementId: element.id,
                        tileType: searchable.tileType,
                        score: 80, // Tile titles have high priority
                    });
                }
                // Check content match
                else if (
                    searchable.content?.toLowerCase().includes(lowerQuery)
                ) {
                    results.push({
                        boardId,
                        boardName: board.name,
                        workstreamId: board.workstreamId,
                        matchType: searchable.type,
                        matchedText: createSnippet(searchable.content, query),
                        elementId: element.id,
                        tileType: searchable.tileType,
                        score:
                            searchable.type === "text-element"
                                ? 60
                                : searchable.type === "frame-label"
                                  ? 70
                                  : 50,
                    });
                }
            }
        }
    }

    // Sort by score (descending) then by board name
    results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.boardName.localeCompare(b.boardName);
    });

    return results;
}

/**
 * Group search results by board for display
 */
export function groupResultsByBoard(
    results: SearchResult[],
): Map<string, SearchResult[]> {
    const grouped = new Map<string, SearchResult[]>();

    for (const result of results) {
        const existing = grouped.get(result.boardId) || [];
        existing.push(result);
        grouped.set(result.boardId, existing);
    }

    return grouped;
}
