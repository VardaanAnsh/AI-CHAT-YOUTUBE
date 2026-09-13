import { useState } from "react";

function App() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [question, setQuestion] = useState("");

  const askQuestion = async () => {
    const response = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: question
      })
    });

    const data = await response.json();

    console.log(data.answer);
  };

  return (
    <div>
      <h1>AI Chat With YouTube</h1>

      <div>
        <input
          type="text"
          placeholder="Paste YouTube URL"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
        />

        <button>Load Video</button>
      </div>

      <div>
        <input
          type="text"
          placeholder="Ask a question about the video..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <button onClick={askQuestion}>Ask</button>
      </div>
    </div>
  );
}

export default App;