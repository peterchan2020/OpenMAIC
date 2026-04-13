/**
 * Prompt Builder for Stateless Generation
 *
 * Builds system prompts and converts messages for the LLM.
 */

import type { StatelessChatRequest } from '@/lib/types/chat';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { WhiteboardActionRecord, AgentTurnSummary } from './director-prompt';
import {
  buildPeerContextSection,
  buildLengthGuidelines,
  buildWhiteboardGuidelines,
  buildStateContext,
  buildVirtualWhiteboardContext,
  DiscussionContext,
  OpenAIMessage,
} from './prompt-helpers';

// ==================== Role Guidelines ====================

const ROLE_GUIDELINES: Record<string, string> = {
  teacher: `Your role in this classroom: LEAD TEACHER.
You are responsible for:
- Controlling the lesson flow, slides, and pacing
- Explaining concepts clearly with examples and analogies
- Asking questions to check understanding
- Using spotlight/laser to direct attention to slide elements
- Using the whiteboard for diagrams and formulas
You can use all available actions. Never announce your actions — just teach naturally.`,

  assistant: `Your role in this classroom: TEACHING ASSISTANT.
You are responsible for:
- Supporting the lead teacher by filling gaps and answering side questions
- Rephrasing explanations in simpler terms when students are confused
- Providing concrete examples and background context
- Using the whiteboard sparingly to supplement (not duplicate) the teacher's content
You play a supporting role — don't take over the lesson.`,

  student: `Your role in this classroom: STUDENT.
You are responsible for:
- Participating actively in discussions
- Asking questions, sharing observations, reacting to the lesson
- Keeping responses SHORT (1-2 sentences max)
- Only using the whiteboard when explicitly invited by the teacher
You are NOT a teacher — your responses should be much shorter than the teacher's.`,
};

// ==================== System Prompt ====================

/**
 * Build system prompt for structured output generation
 *
 * @param agentConfig - The agent configuration
 * @param storeState - Current application state
 * @param discussionContext - Optional discussion context for agent-initiated discussions
 * @returns System prompt string
 */
export function buildStructuredPrompt(
  agentConfig: AgentConfig,
  storeState: StatelessChatRequest['storeState'],
  discussionContext?: DiscussionContext,
  whiteboardLedger?: WhiteboardActionRecord[],
  userProfile?: { nickname?: string; bio?: string },
  agentResponses?: AgentTurnSummary[],
): string {
  // Determine current scene type for action filtering
  const currentScene = storeState.currentSceneId
    ? storeState.scenes.find((s) => s.id === storeState.currentSceneId)
    : undefined;
  const sceneType = currentScene?.type;

  // Filter actions by scene type (spotlight/laser only available on slides)
  const effectiveActions = getEffectiveActions(agentConfig.allowedActions, sceneType);
  const actionDescriptions = getActionDescriptions(effectiveActions);

  // Build context about current state
  const stateContext = buildStateContext(storeState);

  // Build virtual whiteboard context from ledger (shows changes by other agents this round)
  const virtualWbContext = buildVirtualWhiteboardContext(storeState, whiteboardLedger);

  // Build student profile section (only when nickname or bio is present)
  const studentProfileSection =
    userProfile?.nickname || userProfile?.bio
      ? `\n# Student Profile
You are teaching ${userProfile.nickname || 'a student'}.${userProfile.bio ? `\nTheir background: ${userProfile.bio}` : ''}
Personalize your teaching based on their background when relevant. Address them by name naturally.\n`
      : '';

  // Build peer context section (what agents already said this round)
  const peerContext = buildPeerContextSection(agentResponses, agentConfig.name);

  // Whether spotlight/laser are available (only on slide scenes)
  const hasSlideActions =
    effectiveActions.includes('spotlight') || effectiveActions.includes('laser');

  // Build format example based on available actions
  const formatExample = hasSlideActions
    ? `[{"type":"action","name":"spotlight","params":{"elementId":"img_1"}},{"type":"text","content":"Your natural speech to students"}]`
    : `[{"type":"action","name":"wb_open","params":{}},{"type":"text","content":"Your natural speech to students"}]`;

  // Ordering principles
  const orderingPrinciples = hasSlideActions
    ? `- spotlight/laser actions should appear BEFORE the corresponding text object (point first, then speak)
- whiteboard actions can interleave WITH text objects (draw while speaking)`
    : `- whiteboard actions can interleave WITH text objects (draw while speaking)`;

  // Good examples — include spotlight/laser examples only for slide scenes
  const spotlightExamples = hasSlideActions
    ? `[{"type":"action","name":"spotlight","params":{"elementId":"img_1"}},{"type":"text","content":"Photosynthesis is the process by which plants convert light energy into chemical energy. Take a look at this diagram."},{"type":"text","content":"During this process, plants absorb carbon dioxide and water to produce glucose and oxygen."}]

[{"type":"action","name":"spotlight","params":{"elementId":"eq_1"}},{"type":"action","name":"laser","params":{"elementId":"eq_2"}},{"type":"text","content":"Compare these two equations — notice how the left side is endothermic while the right side is exothermic."}]

`
    : '';

  // Action usage guidelines — conditional spotlight/laser lines
  const slideActionGuidelines = hasSlideActions
    ? `- spotlight: Use to focus attention on ONE key element. Don't overuse — max 1-2 per response.
- laser: Use to point at elements. Good for directing attention during explanations.
`
    : '';

  const mutualExclusionNote = hasSlideActions
    ? `- IMPORTANT — Whiteboard / Canvas mutual exclusion: The whiteboard and slide canvas are mutually exclusive. When the whiteboard is OPEN, the slide canvas is hidden — spotlight and laser actions targeting slide elements will have NO visible effect. If you need to use spotlight or laser, call wb_close first to reveal the slide canvas. Conversely, if the whiteboard is CLOSED, wb_draw_* actions still work (they implicitly open the whiteboard), but be aware that doing so hides the slide canvas.
- Prefer variety: mix spotlights, laser, and whiteboard for engaging teaching. Don't use the same action type repeatedly.`
    : '';

  const roleGuideline = ROLE_GUIDELINES[agentConfig.role] || ROLE_GUIDELINES.student;

  // Build language constraint from stage language directive
  const langDirective = storeState.stage?.languageDirective;
  const languageConstraint = langDirective ? `\n# Language (CRITICAL)\n${langDirective}\n` : '';

  return `# Role
You are ${agentConfig.name}.

## Your Personality
${agentConfig.persona}

## Your Classroom Role
${roleGuideline}
${studentProfileSection}${peerContext}${languageConstraint}
# Output Format
You MUST output a JSON array for ALL responses. Each element is an object with a \`type\` field:

${formatExample}

## Format Rules
1. Output a single JSON array — no explanation, no code fences
2. \`type:"action"\` objects contain \`name\` and \`params\`
3. \`type:"text"\` objects contain \`content\` (speech text)
4. Action and text objects can freely interleave in any order
5. The \`]\` closing bracket marks the end of your response
6. CRITICAL: ALWAYS start your response with \`[\` — even if your previous message was interrupted. Never continue a partial response as plain text. Every response must be a complete, independent JSON array.

## Ordering Principles
${orderingPrinciples}

## Speech Guidelines (CRITICAL)
- Effects fire concurrently with your speech — students see results as you speak
- Text content is what you SAY OUT LOUD to students - natural teaching speech
- Do NOT say "let me add...", "I'll create...", "now I'm going to..."
- Do NOT describe your actions - just speak naturally as a teacher
- Students see action results appear on screen - you don't need to announce them
- Your speech should flow naturally regardless of whether actions succeed or fail
- NEVER use markdown formatting (blockquotes >, headings #, bold **, lists -, code blocks) in text content — it is spoken aloud, not rendered

## Length & Style (CRITICAL)
${buildLengthGuidelines(agentConfig.role)}

### Good Examples
${spotlightExamples}[{"type":"action","name":"wb_open","params":{}},{"type":"action","name":"wb_draw_text","params":{"content":"Step 1: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂","x":100,"y":100,"fontSize":24}},{"type":"text","content":"Look at this chemical equation — notice how the reactants and products correspond."}]

[{"type":"action","name":"wb_open","params":{}},{"type":"action","name":"wb_draw_latex","params":{"latex":"\\\\frac{-b \\\\pm \\\\sqrt{b^2-4ac}}{2a}","x":100,"y":80,"width":500}},{"type":"text","content":"This is the quadratic formula — it can solve any quadratic equation."},{"type":"action","name":"wb_draw_table","params":{"x":100,"y":250,"width":500,"height":150,"data":[["Variable","Meaning"],["a","Coefficient of x²"],["b","Coefficient of x"],["c","Constant term"]]}},{"type":"text","content":"Each variable's meaning is shown in the table."}]

### Bad Examples (DO NOT do this)
[{"type":"text","content":"Let me open the whiteboard"},{"type":"action",...}] (Don't announce actions!)
[{"type":"text","content":"I'm going to draw a diagram for you..."}] (Don't describe what you're doing!)
[{"type":"text","content":"Action complete, shape has been added"}] (Don't report action results!)

## Whiteboard Guidelines
${buildWhiteboardGuidelines(agentConfig.role)}

# Available Actions
${actionDescriptions}

## Action Usage Guidelines
${slideActionGuidelines}- Whiteboard actions (wb_open, wb_draw_text, wb_draw_shape, wb_draw_chart, wb_draw_latex, wb_draw_table, wb_draw_line, wb_delete, wb_clear, wb_close): Use when explaining concepts that benefit from diagrams, formulas, data charts, tables, connecting lines, or step-by-step derivations. Use wb_draw_latex for math formulas, wb_draw_chart for data visualization, wb_draw_table for structured data.
- WHITEBOARD CLOSE RULE (CRITICAL): Do NOT call wb_close at the end of your response. Leave the whiteboard OPEN so students can read what you drew. Only call wb_close when you specifically need to return to the slide canvas (e.g., to use spotlight or laser on slide elements). Frequent open/close is distracting.
- wb_delete: Use to remove a specific element by its ID (shown in brackets like [id:xxx] in the whiteboard state). Prefer this over wb_clear when only one or a few elements need to be removed.
${mutualExclusionNote}

# Current State
${stateContext}
${virtualWbContext}
Remember: Speak naturally as a teacher. Effects fire concurrently with your speech.${
    discussionContext
      ? agentResponses && agentResponses.length > 0
        ? `

# Discussion Context
Topic: "${discussionContext.topic}"
${discussionContext.prompt ? `Guiding prompt: ${discussionContext.prompt}` : ''}

You are JOINING an ongoing discussion — do NOT re-introduce the topic or greet the students. The discussion has already started. Contribute your unique perspective, ask a follow-up question, or challenge an assumption made by a previous speaker.`
        : `

# Discussion Context
You are initiating a discussion on the following topic: "${discussionContext.topic}"
${discussionContext.prompt ? `Guiding prompt: ${discussionContext.prompt}` : ''}

IMPORTANT: As you are starting this discussion, begin by introducing the topic naturally to the students. Engage them and invite their thoughts. Do not wait for user input - you speak first.`
      : ''
  }`;
}

// ==================== Conversation Summary ====================

/**
 * Summarize conversation history for the director agent
 *
 * Produces a condensed text summary of the last N messages,
 * truncating long messages and including role labels.
 *
 * @param messages - OpenAI-format messages to summarize
 * @param maxMessages - Maximum number of recent messages to include (default 10)
 * @param maxContentLength - Maximum content length per message (default 200)
 */
export function summarizeConversation(
  messages: OpenAIMessage[],
  maxMessages = 10,
  maxContentLength = 200,
): string {
  if (messages.length === 0) {
    return 'No conversation history yet.';
  }

  const recent = messages.slice(-maxMessages);
  const lines = recent.map((msg) => {
    const roleLabel =
      msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
    const content =
      msg.content.length > maxContentLength
        ? msg.content.slice(0, maxContentLength) + '...'
        : msg.content;
    return `[${roleLabel}] ${content}`;
  });

  return lines.join('\n');
}

// ==================== Message Conversion ====================

/**
 * Convert UI messages to OpenAI format
 * Includes tool call information so the model knows what actions were taken
 */
export function convertMessagesToOpenAI(
  messages: StatelessChatRequest['messages'],
  currentAgentId?: string,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  return messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => {
      if (msg.role === 'assistant') {
        // Assistant messages use JSON array format to serve as few-shot examples
        // that match the expected output format from the system prompt
        const items: Array<{ type: string; [key: string]: string }> = [];

        if (msg.parts) {
          for (const part of msg.parts) {
            const p = part as Record<string, unknown>;

            if (p.type === 'text' && p.text) {
              items.push({ type: 'text', content: p.text as string });
            } else if ((p.type as string)?.startsWith('action-') && p.state === 'result') {
              const actionName = (p.actionName ||
                (p.type as string).replace('action-', '')) as string;
              const output = p.output as Record<string, unknown> | undefined;
              const isSuccess = output?.success === true;
              const resultSummary = isSuccess
                ? output?.data
                  ? `result: ${JSON.stringify(output.data).slice(0, 100)}`
                  : 'success'
                : (output?.error as string) || 'failed';
              items.push({
                type: 'action',
                name: actionName,
                result: resultSummary,
              });
            }
          }
        }

        const content = items.length > 0 ? JSON.stringify(items) : '';
        const msgAgentId = msg.metadata?.agentId;

        // When currentAgentId is provided and this message is from a DIFFERENT agent,
        // convert to user role with agent name attribution
        if (currentAgentId && msgAgentId && msgAgentId !== currentAgentId) {
          const agentName = msg.metadata?.senderName || msgAgentId;
          return {
            role: 'user' as const,
            content: content ? `[${agentName}]: ${content}` : '',
          };
        }

        return {
          role: 'assistant' as const,
          content,
        };
      }

      // User messages: keep plain text concatenation
      const contentParts: string[] = [];

      if (msg.parts) {
        for (const part of msg.parts) {
          const p = part as Record<string, unknown>;

          if (p.type === 'text' && p.text) {
            contentParts.push(p.text as string);
          } else if ((p.type as string)?.startsWith('action-') && p.state === 'result') {
            const actionName = (p.actionName ||
              (p.type as string).replace('action-', '')) as string;
            const output = p.output as Record<string, unknown> | undefined;
            const isSuccess = output?.success === true;
            const resultSummary = isSuccess
              ? output?.data
                ? `result: ${JSON.stringify(output.data).slice(0, 100)}`
                : 'success'
              : (output?.error as string) || 'failed';
            contentParts.push(`[Action ${actionName}: ${resultSummary}]`);
          }
        }
      }

      // Extract speaker name from metadata (e.g. other agents' messages in discussion)
      const senderName = msg.metadata?.senderName;
      let content = contentParts.join('\n');
      if (senderName) {
        content = `[${senderName}]: ${content}`;
      }

      // Annotate interrupted messages so the LLM knows context was cut short
      const isInterrupted =
        (msg as unknown as Record<string, unknown>).metadata &&
        ((msg as unknown as Record<string, unknown>).metadata as Record<string, unknown>)
          ?.interrupted;
      return {
        role: 'user' as const,
        content: isInterrupted
          ? `${content}\n[This response was interrupted — do NOT continue it. Start a new JSON array response.]`
          : content,
      };
    })
    .filter((msg) => {
      // Drop empty messages and messages with only dots/ellipsis/whitespace
      // (produced by failed agent streams)
      const stripped = msg.content.replace(/[.\s…]+/g, '');
      return stripped.length > 0;
    });
}

// Re-export types from prompt-helpers for convenience
export type { DiscussionContext, OpenAIMessage } from './prompt-helpers';

// Import getActionDescriptions and getEffectiveActions from tool-schemas
import { getActionDescriptions, getEffectiveActions } from './tool-schemas';
