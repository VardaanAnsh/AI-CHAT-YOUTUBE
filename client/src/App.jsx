import { useState } from "react";
import "./App.css";

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [messages,setMessages] = useState([]);
  const [videoId, setVideoId] = useState("iRXx1x7q7ac");
  const [loadingVideo, setLoadingVideo] = useState(false);

  const loadVideo = async () => {
  try {
    setLoadingVideo(true);

    const response = await fetch("http://localhost:3000/api/video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        youtubeUrl,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error);
    }

    const id = new URL(youtubeUrl).searchParams.get("v");

    setVideoId(id);

    console.log("Video loaded:", data);
  } catch (error) {
    console.error("LOAD VIDEO ERROR:", error);
  } finally {
    setLoadingVideo(false);
  }
};

const askQuestion = async () => {
  if (!question.trim() || !videoId) return;

  try {
    const response = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        videoId,
      }),
    });

    const data = await response.json();

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: question,
      },
      {
        role: "assistant",
        content: data.answer,
      },
    ]);

    setQuestion("");
  } catch (error) {
    console.error("CHAT ERROR:", error);
  }
};



  return (
    <div className="app">
      <header className="navbar">
        <div className="logo">
          <span className="logo-icon">▶</span>
          <span>AI YouTube Chat</span>
        </div>

        <button className="new-chat">+ New Chat</button>
      </header>

      <main className="chat-container">
        <section className="hero">
          <div className="hero-icon">🎥</div>

          <h1>Chat with any YouTube video</h1>

          <p>
            Paste a YouTube video and ask questions about its content.
          </p>

          <div className="youtube-input">
            {/* <input
              type="text"
              placeholder="Paste YouTube URL..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            /> */}
            <input
              type="text"
              placeholder="Paste YouTube URL..."
              value={youtubeUrl}
              onChange={(e) => {
                console.log("TYPING:", e.target.value);
                setYoutubeUrl(e.target.value);
              }}
              onFocus={() => console.log("INPUT FOCUSED")}
            />
            
            <button onClick={loadVideo} disabled={loadingVideo}>
              {loadingVideo ? "Loading..." : "Load Video"}
            </button>
          </div>
        </section>

        <div className="messages">
  {messages.map((message, index) => (
    <div
      key={index}
      className={`message ${
        message.role === "user" ? "user-message" : "ai-message"
      }`}
    >
      <div className="avatar">
        {message.role === "user" ? "YOU" : "AI"}
      </div>

      <div className="message-content">
        <span className="message-name">
          {message.role === "user" ? "You" : "AI Assistant"}
        </span>

        <p>{message.content}</p>
      </div>
    </div>
  ))}
</div>

        <div className="question-box">
          <input
            type="text"
            placeholder="Ask anything about the video..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                askQuestion();
              }
            }}
          />

          <button onClick={askQuestion}>↑</button>
        </div>
      </main>
    </div>
  );
}

export default App;