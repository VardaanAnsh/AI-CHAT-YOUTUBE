
import { useState, useEffect, useRef } from "react";
import "./App.css";

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [videoId, setVideoId] = useState("");

  const [loadingVideo, setLoadingVideo] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  const [videoStatus, setVideoStatus] = useState(null);
  const [chatError, setChatError] = useState("");

  const messagesEndRef = useRef(null);
  const questionInputRef = useRef(null);

  // Keep the latest message visible.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loadingChat]);

  const extractVideoId = (url) => {
    try {
      const parsedUrl = new URL(url.trim());

      if (
        parsedUrl.hostname === "youtu.be" ||
        parsedUrl.hostname === "www.youtu.be"
      ) {
        return parsedUrl.pathname.split("/")[1] || null;
      }

      if (
        parsedUrl.hostname === "youtube.com" ||
        parsedUrl.hostname === "www.youtube.com" ||
        parsedUrl.hostname === "m.youtube.com"
      ) {
        if (parsedUrl.pathname === "/watch") {
          return parsedUrl.searchParams.get("v");
        }

        const parts = parsedUrl.pathname.split("/").filter(Boolean);

        if (["shorts", "embed", "live"].includes(parts[0])) {
          return parts[1] || null;
        }
      }

      return null;
    } catch {
      return null;
    }
  };

  const loadVideo = async () => {
    if (loadingVideo) return;

    const id = extractVideoId(youtubeUrl);

    if (!id) {
      setVideoStatus({
        type: "error",
        message: "Please enter a valid YouTube video URL.",
      });
      return;
    }

    try {
      setLoadingVideo(true);
      setVideoStatus({
        type: "loading",
        message: "Processing video and storing transcript...",
      });

      const response = await fetch(
        "http://localhost:3000/api/video",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ youtubeUrl }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to process this video."
        );
      }

      setVideoId(id);

      setVideoStatus({
        type: "success",
        message: "Video processed successfully!",
        numberOfChunks: data.numberOfChunks,
      });

      setMessages([]);
      setChatError("");
      setQuestion("");

      // Focus the chat input after successful ingestion.
      questionInputRef.current?.focus();
    } catch (error) {
      console.error("LOAD VIDEO ERROR:", error);

      setVideoStatus({
        type: "error",
        message: error.message || "Something went wrong.",
      });
    } finally {
      setLoadingVideo(false);
    }
  };

  const askQuestion = async (event) => {
    event?.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || !videoId || loadingChat) {
      return;
    }

    // Display the user's message immediately.
    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedQuestion,
    };

    setMessages((previous) => [...previous, userMessage]);
    setQuestion("");
    setChatError("");
    setLoadingChat(true);

    try {
      const response = await fetch(
        "http://localhost:3000/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: trimmedQuestion,
            videoId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to get a response."
        );
      }

      if (!data.answer) {
        throw new Error("The server returned an empty answer.");
      }

      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
        },
      ]);
    } catch (error) {
      console.error("CHAT ERROR:", error);

      setChatError(
        error.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoadingChat(false);
      questionInputRef.current?.focus();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setQuestion("");
    setChatError("");
    questionInputRef.current?.focus();
  };

  const handleQuestionKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askQuestion();
    }
  };

  return (
    <div className="app">
      <header className="navbar">
        <div className="logo">
          <span className="logo-icon">▶</span>
          <span>AI YouTube Chat</span>
        </div>

        <button
          className="new-chat"
          onClick={startNewChat}
          disabled={messages.length === 0 && !chatError}
        >
          + New Chat
        </button>
      </header>

      <main className="chat-container">
        <section className="hero">
          <div className="hero-label">YOUTUBE • RAG CHAT</div>

          <h1>Chat with any YouTube video</h1>

          <p>
            Load a video, then ask questions about its transcript.
          </p>

          <div className="youtube-input">
            <input
              type="text"
              placeholder="Paste a YouTube URL..."
              value={youtubeUrl}
              onChange={(event) => {
                setYoutubeUrl(event.target.value);
                setVideoStatus(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  loadVideo();
                }
              }}
            />

            <button
              onClick={loadVideo}
              disabled={loadingVideo || !youtubeUrl.trim()}
            >
              {loadingVideo ? (
                <>
                  <span className="button-spinner" />
                  Processing
                </>
              ) : (
                "Load Video"
              )}
            </button>
          </div>

          {videoStatus && (
            <div
              className={`video-status ${videoStatus.type}`}
              role="status"
            >
              {videoStatus.type === "loading" && (
                <span className="status-spinner" />
              )}

              {videoStatus.type === "success" && (
                <span className="status-icon">✓</span>
              )}

              {videoStatus.type === "error" && (
                <span className="status-icon">!</span>
              )}

              <div>
                <strong>{videoStatus.message}</strong>

                {videoStatus.type === "success" &&
                  videoStatus.numberOfChunks !== undefined && (
                    <p>
                      {videoStatus.numberOfChunks} transcript chunks
                      processed.
                    </p>
                  )}
              </div>
            </div>
          )}
        </section>

        <section className="chat-panel">
          <div className="messages">
            {messages.length === 0 && !loadingChat ? (
              <div className="empty-chat">
                <div className="empty-chat-icon">✦</div>

                <h2>
                  {videoId
                    ? "Your video is ready"
                    : "Start a conversation"}
                </h2>

                <p>
                  {videoId
                    ? "Ask a question about the transcript below."
                    : "Load a YouTube video above to begin chatting."}
                </p>

                {videoId && (
                  <div className="suggested-questions">
                    <button
                      onClick={() =>
                        setQuestion("What is this video about?")
                      }
                    >
                      What is this video about?
                    </button>

                    <button
                      onClick={() =>
                        setQuestion("Summarize the key ideas.")
                      }
                    >
                      Summarize the key ideas
                    </button>
                  </div>
                )}
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${
                    message.role === "user"
                      ? "user-message"
                      : "ai-message"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="avatar ai-avatar">✦</div>
                  )}

                  <div className="message-content">
                    <div className="message-name">
                      {message.role === "user" ? "You" : "AI Assistant"}
                    </div>

                    <p>{message.content}</p>
                  </div>

                  {message.role === "user" && (
                    <div className="avatar user-avatar">Y</div>
                  )}
                </div>
              ))
            )}

            {loadingChat && (
              <div className="message ai-message">
                <div className="avatar ai-avatar">✦</div>

                <div className="message-content">
                  <div className="message-name">AI Assistant</div>

                  <div
                    className="typing-indicator"
                    aria-label="AI is generating a response"
                  >
                    <span />
                    <span />
                    <span />
                  </div>

                  <span className="thinking-text">
                    Thinking...
                  </span>
                </div>
              </div>
            )}

            {chatError && (
              <div className="chat-error" role="alert">
                <span>{chatError}</span>

                <button
                  onClick={() => {
                    setChatError("");
                    setQuestion(
                      messages[messages.length - 1]?.content || ""
                    );
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form className="question-box" onSubmit={askQuestion}>
            <textarea
              ref={questionInputRef}
              placeholder={
                videoId
                  ? "Ask anything about the video..."
                  : "Load a video first..."
              }
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleQuestionKeyDown}
              disabled={!videoId || loadingChat}
              rows={1}
            />

            <button
              type="submit"
              disabled={
                !videoId || !question.trim() || loadingChat
              }
              aria-label="Send message"
            >
              {loadingChat ? (
                <span className="button-spinner" />
              ) : (
                "↑"
              )}
            </button>

            <div className="input-hint">
              Enter to send · Shift + Enter for a new line
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default App;