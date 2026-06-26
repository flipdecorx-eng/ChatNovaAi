const API_URL = "https://calm-rice-33af.flipdecorx.workers.dev/";

async function sendMessage() {
  const input = document.getElementById("message");
  const chat = document.getElementById("chat");

  const message = input.value.trim();
  if (!message) return;

  chat.innerHTML += `<div class="user">${message}</div>`;
  input.value = "";

  const thinking = document.createElement("div");
  thinking.className = "bot";
  thinking.innerText = "Thinking...";
  chat.appendChild(thinking);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message
      })
    });

    const data = await response.json();
    thinking.innerText = data.reply || data.error || "No response";
  } catch (err) {
    thinking.innerText = "Error: " + err.message;
  }
}

document.getElementById("sendBtn").addEventListener("click", sendMessage);

document.getElementById("message").addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    sendMessage();
  }
});