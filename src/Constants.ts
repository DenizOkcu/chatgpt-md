export const HORIZONTAL_RULE_CLASS = "__chatgpt_plugin";
export const ROLE_USER = "user";
export const ROLE_ASSISTANT = "assistant";
export const ROLE_DEVELOPER = "developer";
export const ROLE_SYSTEM = "system";
export const CHAT_FOLDER_TYPE = "chatFolder";
export const CHAT_TEMPLATE_FOLDER_TYPE = "chatTemplateFolder";
export const HORIZONTAL_LINE_MD = `<hr class="${HORIZONTAL_RULE_CLASS}">`;
export const COMMENT_BLOCK_START = `=begin-chatgpt-md-comment\n\n`;
export const COMMENT_BLOCK_END = `=end-chatgpt-md-comment`;
export const DEFAULT_HEADING_LEVEL = 0;
export const CALL_CHATGPT_API_COMMAND_ID = "call-chatgpt-api";
export const ADD_HR_COMMAND_ID = "add-hr";
export const ADD_COMMENT_BLOCK_COMMAND_ID = "add-comment-block";
export const STOP_STREAMING_COMMAND_ID = "stop-streaming";
export const INFER_TITLE_COMMAND_ID = "infer-title";
export const MOVE_TO_CHAT_COMMAND_ID = "move-to-chat";
export const CHOOSE_CHAT_TEMPLATE_COMMAND_ID = "choose-chat-template";
export const CLEAR_CHAT_COMMAND_ID = "clear-chat";
export const ROLE_IDENTIFIER = "role::";
export const AI_SERVICE_OPENAI = "openai";
export const AI_SERVICE_OLLAMA = "ollama";
export const AI_SERVICE_ANTHROPIC = "anthropic";

export const ROLE_HEADER = (headingPrefix: string, role: string) =>
  `\n\n${HORIZONTAL_LINE_MD}\n\n${headingPrefix}${ROLE_IDENTIFIER}${role}\n\n`;
