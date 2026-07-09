(function () {
  const form = document.querySelector('#chat-form');
  const input = document.querySelector('#message');
  const messages = document.querySelector('#messages');
  const status = document.querySelector('#status');
  let socket;

  function setStatus(online) {
    status.textContent = online ? 'online' : 'offline';
    status.className = online ? 'status status-online' : 'status status-offline';
    input.disabled = !online;
    form.querySelector('button').disabled = !online;
  }

  function addMessage(text, type) {
    const item = document.createElement('li');
    item.className = `message message-${type}`;
    item.textContent = text;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socket.addEventListener('open', () => {
      setStatus(true);
      addMessage('Connected to the mesh chat.', 'system');
    });

    socket.addEventListener('message', (event) => {
      addMessage(event.data, 'remote');
    });

    socket.addEventListener('close', () => {
      setStatus(false);
      addMessage('Disconnected. Reconnecting...', 'system');
      window.setTimeout(connect, 1500);
    });

    socket.addEventListener('error', () => {
      socket.close();
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(value);
    addMessage(value, 'local');
    input.value = '';
    input.focus();
  });

  setStatus(false);
  connect();
})();
