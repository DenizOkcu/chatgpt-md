import { AI_SERVICE_OLLAMA, AI_SERVICE_OPENAI, AI_SERVICE_OPENROUTER, ROLE_ASSISTANT } from "src/Constants";
import { Editor } from "obsidian";
import { NotificationService } from "./NotificationService";
import { getHeaderRole, unfinishedCodeBlock } from "src/Utilities/TextHelpers";
import { ApiService } from "./ApiService";

/**
 * ApiResponseParser handles parsing of API responses
 * It centralizes response parsing logic for different API formats
 */
export class ApiResponseParser {
  private notificationService: NotificationService;
  private collectedCitations: Set<string> = new Set(); // Store citations as they come in

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Insert the assistant header at the current cursor position
   */
  insertAssistantHeader(
    editor: Editor,
    headingPrefix: string,
    model: string
  ): {
    initialCursor: { line: number; ch: number };
    newCursor: { line: number; ch: number };
  } {
    const newLine = getHeaderRole(headingPrefix, ROLE_ASSISTANT, model);

    // Store the initial cursor position before inserting the header
    const initialCursor = {
      line: editor.getCursor().line,
      ch: editor.getCursor().ch,
    };

    editor.replaceRange(newLine, initialCursor);

    const newCursor = {
      line: initialCursor.line,
      ch: initialCursor.ch + newLine.length,
    };
    editor.setCursor(newCursor);

    return { initialCursor, newCursor };
  }

  /**
   * Parse a non-streaming API response
   * @param data The response data
   * @param serviceType The AI service type
   * @returns The parsed content
   */
  parseNonStreamingResponse(data: any, serviceType: string): string | any {
    // Check if this is an embeddings response (has an embedding array)
    if (data?.embedding && (Array.isArray(data.embedding) || typeof data.embedding === "object")) {
      // Return the whole response object for embeddings
      return data;
    }

    switch (serviceType) {
      case AI_SERVICE_OPENAI:
        return data.choices[0].message.content;
      case AI_SERVICE_OPENROUTER:
        return data.choices[0].message.content;
      case AI_SERVICE_OLLAMA:
        // Check for Ollama's chat API format which has a message object with content
        if (data.message && data.message.content) {
          return data.message.content;
        }
        // Check for Ollama's generate API format which has a response field
        if (data.response) {
          return data.response;
        }
        // Fallback to stringifying the data
        return JSON.stringify(data);
      default:
        console.warn(`Unknown service type: ${serviceType}`);
        return data?.choices?.[0]?.message?.content || data?.response || JSON.stringify(data);
    }
  }

  /**
   * Process a streaming response line
   * @param line The response line
   * @param currentText The current accumulated text
   * @param editor The editor instance
   * @param initialCursor The initial cursor position
   * @param serviceType The AI service type
   * @param setAtCursor Whether to set the text at cursor
   * @returns The updated text
   */
  processStreamLine(
    line: string,
    currentText: string,
    editor: Editor,
    initialCursor: { line: number; ch: number },
    serviceType: string,
    setAtCursor?: boolean
  ): string {
    switch (serviceType) {
      case AI_SERVICE_OPENAI:
      case AI_SERVICE_OPENROUTER:
        return this.processOpenAIFormat(line, currentText, editor, initialCursor, setAtCursor);
      case AI_SERVICE_OLLAMA:
        return this.processOllamaFormat(line, currentText, editor, initialCursor, setAtCursor);
      default:
        console.warn(`Unknown service type for streaming: ${serviceType}`);
        return currentText;
    }
  }

  /**
   * Process OpenAI format streaming response
   */
  private processOpenAIFormat(
    line: string,
    currentText: string,
    editor: Editor,
    initialCursor: { line: number; ch: number },
    setAtCursor?: boolean
  ): string {
    if (line.trim() === "") return currentText;

    try {
      const json = JSON.parse(line.replace("data: ", ""));

      // Collect citations if they exist in this chunk
      if (json.citations && json.citations.length > 0) {
        console.log("Found citations in chunk:", json.citations);
        for (const citation of json.citations) {
          this.collectedCitations.add(citation);
          console.log("Added citation to set:", citation);
        }
        console.log("Current citations set size:", this.collectedCitations.size);
      }

      if (json.choices && json.choices[0]) {
        const { delta } = json.choices[0];

        // Handle content in delta if it exists
        if (delta && delta.content) {
          // Only update the editor with the new delta content, not the full text
          if (setAtCursor) {
            editor.replaceSelection(delta.content);
          } else {
            // Insert just the new content at the current cursor position
            const cursor = editor.getCursor();
            editor.replaceRange(delta.content, cursor);
            // Move the cursor to the end of the inserted text
            editor.setCursor({
              line: cursor.line,
              ch: cursor.ch + delta.content.length,
            });
          }

          // Return the accumulated text for tracking
          return currentText + delta.content;
        }
      }

      return currentText;
    } catch (e) {
      // Skip lines that aren't valid JSON or don't contain content
      return currentText;
    }
  }

  /**
   * Process Ollama format streaming response
   */
  private processOllamaFormat(
    line: string,
    currentText: string,
    editor: Editor,
    initialCursor: { line: number; ch: number },
    setAtCursor?: boolean
  ): string {
    if (line.trim() === "") return currentText;

    try {
      const json = JSON.parse(line);

      // Check for Ollama's chat API format which has a message object with content
      if (json.message && json.message.content) {
        const content = json.message.content;

        // Only update the editor with the new content, not the full text
        if (setAtCursor) {
          editor.replaceSelection(content);
        } else {
          // Insert just the new content at the current cursor position
          const cursor = editor.getCursor();
          editor.replaceRange(content, cursor);
          // Move the cursor to the end of the inserted text
          editor.setCursor({
            line: cursor.line,
            ch: cursor.ch + content.length,
          });
        }

        // Return the accumulated text for tracking
        return currentText + content;
      }

      // Check for Ollama's generate API format which has a response field
      if (json.response) {
        // Only update the editor with the new response content, not the full text
        if (setAtCursor) {
          editor.replaceSelection(json.response);
        } else {
          // Insert just the new content at the current cursor position
          const cursor = editor.getCursor();
          editor.replaceRange(json.response, cursor);
          // Move the cursor to the end of the inserted text
          editor.setCursor({
            line: cursor.line,
            ch: cursor.ch + json.response.length,
          });
        }

        // Return the accumulated text for tracking
        return currentText + json.response;
      }

      return currentText;
    } catch (e) {
      // Skip lines that aren't valid JSON or don't contain content
      return currentText;
    }
  }

  /**
   * Process a complete streaming response
   * @param response The response object
   * @param serviceType The AI service type
   * @param editor The editor instance
   * @param initialCursor The initial cursor position before inserting the assistant header
   * @param setAtCursor Whether to set the text at cursor
   * @param apiService The API service instance to check if streaming was aborted
   * @returns The complete text and whether streaming was aborted
   */
  async processStreamResponse(
    response: Response,
    serviceType: string,
    editor: Editor,
    cursorPositions: {
      initialCursor: { line: number; ch: number };
      newCursor: { line: number; ch: number };
    },
    setAtCursor?: boolean,
    apiService?: ApiService
  ): Promise<{ text: string; wasAborted: boolean }> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let text = "";
    let wasAborted = false;

    try {
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: [DONE]")) continue;
          if (line.startsWith("data:")) {
            text = this.processStreamLine(line, text, editor, cursorPositions.newCursor, serviceType, setAtCursor);
          } else if (line.trim() !== "") {
            // For Ollama and other non-OpenAI formats
            text = this.processStreamLine(line, text, editor, cursorPositions.newCursor, serviceType, setAtCursor);
          }
        }
      }
    } catch (error) {
      console.error("Error processing stream:", error);
    }

    // Check if streaming was aborted - moved outside try/catch for cleaner code
    if (apiService && apiService.wasAborted()) {
      wasAborted = true;
      apiService.resetAbortedFlag();

      // Remove the partial assistant response by restoring the editor to its state before the response
      if (!setAtCursor) {
        // Remove everything from the initial cursor position (before the assistant header) to the current cursor position
        editor.replaceRange("", cursorPositions.initialCursor, editor.getCursor());
      }

      return { text: "", wasAborted };
    }

    // Handle normal completion (not aborted)
    // Check for unfinished code blocks and add closing backticks if needed
    if (unfinishedCodeBlock(text)) {
      // Add closing code block
      const cursor = editor.getCursor();
      editor.replaceRange("\n```", cursor);
      text += "\n```";
    }

    // Now append any collected citations after the entire response is complete
    if (this.collectedCitations.size > 0) {
      console.log("Completed streaming response, appending citations");
      console.log("Citations to append:", Array.from(this.collectedCitations));

      const citations = Array.from(this.collectedCitations);

      const citationsText =
        "\n\n**Sources:**\n" +
        citations
          .map((citation: string, index: number) => {
            return `${index + 1}. [${citation}](${citation})`;
          })
          .join("\n");

      // Add citations at the current cursor position
      const cursor = editor.getCursor();
      editor.replaceRange(citationsText, cursor);
      editor.setCursor({ line: cursor.line, ch: cursor.ch + citationsText.length });

      // Append to text variable to include citations in returned text
      text += citationsText;

      // Clear the collected citations after they've been appended
      this.collectedCitations.clear();
      console.log("Citations set cleared after appending to response");
    }

    // Clean up any trailing content if not setting at cursor
    if (!setAtCursor) {
      const cursor = editor.getCursor();
      editor.replaceRange("", cursor, {
        line: Infinity,
        ch: Infinity,
      });
    }

    return { text, wasAborted };
  }
}
