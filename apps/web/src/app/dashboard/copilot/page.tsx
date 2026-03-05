'use client'

import { useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { useStudioId } from '@/hooks/use-studio-id'
import { cn } from '@/lib/utils'

const suggestedPrompts = [
  'How is my studio doing financially?',
  'Help me create a financial plan for this year',
  'What if I raised my prices by 10%?',
  'Which classes should I add or cut?',
  "Who's at risk of leaving and why?",
  'Draft a quarterly financial summary',
]

export default function CopilotPage() {
  const { studioId, loading: studioLoading } = useStudioId()
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setInput } = useChat({
    api: '/api/chat',
    body: { studioId },
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant' as const,
        content:
          "I'm your Studio Copilot. I can analyze your finances, spot trends, run what-if scenarios, and help you make better business decisions. What would you like to know?",
        parts: [
          {
            type: 'text' as const,
            text: "I'm your Studio Copilot. I can analyze your finances, spot trends, run what-if scenarios, and help you make better business decisions. What would you like to know?",
          },
        ],
      },
    ],
  })

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function handleSuggestedPrompt(prompt: string) {
    setInput(prompt)
    // Submit on next tick after state update
    setTimeout(() => {
      const form = document.getElementById('copilot-form') as HTMLFormElement
      form?.requestSubmit()
    }, 0)
  }

  if (studioLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!studioId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">No studio found.</p>
      </div>
    )
  }

  const hasConversation = messages.length > 1

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Studio Copilot</h1>
        <p className="text-sm text-muted-foreground">
          Your AI-powered business advisor
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3 whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}
            >
              {msg.parts?.map((part, i) => {
                if (part.type === 'text') {
                  return (
                    <div key={i} className="prose prose-sm dark:prose-invert max-w-none">
                      <MessageContent text={part.text} />
                    </div>
                  )
                }
                if (part.type === 'tool-invocation') {
                  return (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground italic my-1"
                    >
                      <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Analyzing{' '}
                      {part.toolInvocation.toolName.replace(/([A-Z])/g, ' $1').toLowerCase()}...
                    </span>
                  )
                }
                return null
              }) ??
                (msg.content && (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <MessageContent text={msg.content} />
                  </div>
                ))}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-3">
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Thinking...
              </span>
            </div>
          </div>
        )}
      </div>

      {!hasConversation && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSuggestedPrompt(prompt)}
              className="text-left text-sm px-4 py-3 rounded-xl border bg-card hover:bg-muted transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <form
        id="copilot-form"
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border rounded-2xl px-4 py-2 bg-card"
      >
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about your studio..."
          className="flex-1 bg-transparent outline-none text-sm min-h-[44px]"
          disabled={isLoading}
        />
        {isLoading ? (
          <button
            type="button"
            onClick={stop}
            className="px-3 py-1.5 text-sm rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            Send
          </button>
        )}
      </form>
    </div>
  )
}

function MessageContent({ text }: { text: string }) {
  // Simple markdown-like rendering: bold, line breaks
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
